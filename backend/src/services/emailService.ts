import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter;
  private isConfigured: boolean = false;

  private constructor() {
    this.initializeTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initializeTransporter(): void {
    try {
      const config = {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        pool: true, // Use connection pooling
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10, // Max 10 emails per second
      };

      this.transporter = nodemailer.createTransporter(config);
      this.verifyConnection();
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      this.isConfigured = false;
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.isConfigured = true;
      logger.info('✅ Email service connected successfully');
    } catch (error) {
      this.isConfigured = false;
      logger.error('❌ Email service connection failed:', error);
    }
  }

  public async sendEmail(options: EmailOptions): Promise<{ messageId: string; accepted: string[] }> {
    if (!this.isConfigured) {
      throw new AppError('Email service not configured', 503, 'EMAIL_SERVICE_UNAVAILABLE');
    }

    try {
      const mailOptions = {
        from: options.from || `"Dheenotifications" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments,
        headers: {
          'X-Mailer': 'Dheenotifications v2.0',
          'X-Priority': '3',
        },
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info(`📧 Email sent successfully`, {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      });

      return {
        messageId: info.messageId,
        accepted: info.accepted,
      };
    } catch (error: any) {
      logger.error(`❌ Failed to send email to ${options.to}:`, {
        error: error.message,
        code: error.code,
        command: error.command,
      });

      // Handle specific SMTP errors
      if (error.code === 'EAUTH') {
        throw new AppError('Email authentication failed', 500, 'EMAIL_AUTH_FAILED');
      } else if (error.code === 'ECONNECTION') {
        throw new AppError('Email server connection failed', 500, 'EMAIL_CONNECTION_FAILED');
      } else if (error.responseCode === 550) {
        throw new AppError('Invalid recipient email address', 400, 'INVALID_EMAIL');
      } else if (error.responseCode === 552) {
        throw new AppError('Email size limit exceeded', 400, 'EMAIL_SIZE_LIMIT');
      }

      throw new AppError('Failed to send email', 500, 'EMAIL_SEND_FAILED', {
        originalError: error.message,
      });
    }
  }

  public async sendTemplateEmail(
    to: string,
    subject: string,
    template: string,
    variables: Record<string, any> = {}
  ): Promise<{ messageId: string; accepted: string[] }> {
    try {
      // Replace template variables
      let processedSubject = subject;
      let processedTemplate = template;

      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedSubject = processedSubject.replace(placeholder, String(value));
        processedTemplate = processedTemplate.replace(placeholder, String(value));
      });

      // Convert plain text to HTML if needed
      const html = this.convertToHtml(processedTemplate);

      return await this.sendEmail({
        to,
        subject: processedSubject,
        text: processedTemplate,
        html,
      });
    } catch (error) {
      logger.error('Failed to send template email:', error);
      throw error;
    }
  }

  public async sendBulkEmails(
    emails: Array<{
      to: string;
      subject: string;
      template: string;
      variables?: Record<string, any>;
    }>
  ): Promise<Array<{ to: string; success: boolean; messageId?: string; error?: string }>> {
    const results: Array<{ to: string; success: boolean; messageId?: string; error?: string }> = [];

    for (const email of emails) {
      try {
        const result = await this.sendTemplateEmail(
          email.to,
          email.subject,
          email.template,
          email.variables
        );

        results.push({
          to: email.to,
          success: true,
          messageId: result.messageId,
        });
      } catch (error: any) {
        results.push({
          to: email.to,
          success: false,
          error: error.message,
        });
      }

      // Add small delay to avoid overwhelming the SMTP server
      await this.delay(100);
    }

    return results;
  }

  private convertToHtml(text: string): string {
    // Simple text to HTML conversion
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p><\/p>/g, '');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.verifyConnection();
      return this.isConfigured;
    } catch (error) {
      return false;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConfigured;
  }

  // Email validation
  public static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Email sanitization
  public static sanitizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  // Generate email preview
  public generatePreview(
    subject: string,
    template: string,
    variables: Record<string, any> = {}
  ): { subject: string; content: string; html: string } {
    let processedSubject = subject;
    let processedTemplate = template;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedSubject = processedSubject.replace(placeholder, String(value));
      processedTemplate = processedTemplate.replace(placeholder, String(value));
    });

    return {
      subject: processedSubject,
      content: processedTemplate,
      html: this.convertToHtml(processedTemplate),
    };
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();