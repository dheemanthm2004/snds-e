import twilio from 'twilio';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

interface SmsOptions {
  to: string;
  message: string;
  from?: string;
}

export class SmsService {
  private static instance: SmsService;
  private client: twilio.Twilio | null = null;
  private isConfigured: boolean = false;
  private fromNumber: string;

  private constructor() {
    this.initializeClient();
    this.fromNumber = process.env.TWILIO_PHONE || '';
  }

  public static getInstance(): SmsService {
    if (!SmsService.instance) {
      SmsService.instance = new SmsService();
    }
    return SmsService.instance;
  }

  private initializeClient(): void {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        logger.warn('Twilio credentials not configured');
        this.isConfigured = false;
        return;
      }

      this.client = twilio(accountSid, authToken);
      this.isConfigured = true;
      logger.info('✅ SMS service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize SMS service:', error);
      this.isConfigured = false;
    }
  }

  public async sendSms(options: SmsOptions): Promise<{ sid: string; status: string }> {
    if (!this.isConfigured || !this.client) {
      throw new AppError('SMS service not configured', 503, 'SMS_SERVICE_UNAVAILABLE');
    }

    try {
      // Validate phone number format
      const formattedNumber = this.formatPhoneNumber(options.to);
      
      // Validate message length (SMS limit is 1600 characters for concatenated messages)
      if (options.message.length > 1600) {
        throw new AppError('Message too long for SMS', 400, 'SMS_MESSAGE_TOO_LONG');
      }

      const message = await this.client.messages.create({
        body: options.message,
        from: options.from || this.fromNumber,
        to: formattedNumber,
      });

      logger.info(`📱 SMS sent successfully`, {
        to: formattedNumber,
        sid: message.sid,
        status: message.status,
        segments: message.numSegments,
      });

      return {
        sid: message.sid,
        status: message.status,
      };
    } catch (error: any) {
      logger.error(`❌ Failed to send SMS to ${options.to}:`, {
        error: error.message,
        code: error.code,
        moreInfo: error.moreInfo,
      });

      // Handle specific Twilio errors
      if (error.code === 21211) {
        throw new AppError('Invalid phone number', 400, 'INVALID_PHONE_NUMBER');
      } else if (error.code === 21408) {
        throw new AppError('Permission denied for phone number', 400, 'PHONE_PERMISSION_DENIED');
      } else if (error.code === 21610) {
        throw new AppError('Phone number is blacklisted', 400, 'PHONE_BLACKLISTED');
      } else if (error.code === 30001) {
        throw new AppError('Message queue is full', 503, 'SMS_QUEUE_FULL');
      } else if (error.code === 30002) {
        throw new AppError('Account suspended', 503, 'SMS_ACCOUNT_SUSPENDED');
      } else if (error.code === 30003) {
        throw new AppError('Unreachable destination', 400, 'SMS_UNREACHABLE');
      }

      throw new AppError('Failed to send SMS', 500, 'SMS_SEND_FAILED', {
        originalError: error.message,
        twilioCode: error.code,
      });
    }
  }

  public async sendTemplateSms(
    to: string,
    template: string,
    variables: Record<string, any> = {}
  ): Promise<{ sid: string; status: string }> {
    try {
      // Replace template variables
      let processedMessage = template;

      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedMessage = processedMessage.replace(placeholder, String(value));
      });

      return await this.sendSms({
        to,
        message: processedMessage,
      });
    } catch (error) {
      logger.error('Failed to send template SMS:', error);
      throw error;
    }
  }

  public async sendBulkSms(
    messages: Array<{
      to: string;
      template: string;
      variables?: Record<string, any>;
    }>
  ): Promise<Array<{ to: string; success: boolean; sid?: string; error?: string }>> {
    const results: Array<{ to: string; success: boolean; sid?: string; error?: string }> = [];

    for (const msg of messages) {
      try {
        const result = await this.sendTemplateSms(
          msg.to,
          msg.template,
          msg.variables
        );

        results.push({
          to: msg.to,
          success: true,
          sid: result.sid,
        });
      } catch (error: any) {
        results.push({
          to: msg.to,
          success: false,
          error: error.message,
        });
      }

      // Add delay to respect rate limits
      await this.delay(1000); // 1 second delay between messages
    }

    return results;
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    // If number doesn't start with +, add country code
    if (!formatted.startsWith('+')) {
      // Default to US country code if not specified
      formatted = '+1' + formatted;
    }

    return formatted;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      return false;
    }

    try {
      // Test by fetching account info
      await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
      return true;
    } catch (error) {
      logger.error('SMS service test failed:', error);
      return false;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConfigured;
  }

  // Phone number validation
  public static validatePhoneNumber(phoneNumber: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    return phoneRegex.test(cleaned);
  }

  // Phone number sanitization
  public static sanitizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[^\d+]/g, '');
  }

  // Generate SMS preview
  public generatePreview(
    template: string,
    variables: Record<string, any> = {}
  ): { content: string; characterCount: number; segmentCount: number } {
    let processedMessage = template;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedMessage = processedMessage.replace(placeholder, String(value));
    });

    // Calculate SMS segments (160 chars for GSM 7-bit, 70 for UCS-2)
    const characterCount = processedMessage.length;
    let segmentCount = 1;

    if (characterCount > 160) {
      // For concatenated SMS, each segment is 153 characters (7 chars for header)
      segmentCount = Math.ceil(characterCount / 153);
    }

    return {
      content: processedMessage,
      characterCount,
      segmentCount,
    };
  }

  // Get SMS delivery status
  public async getMessageStatus(messageSid: string): Promise<{
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    if (!this.isConfigured || !this.client) {
      throw new AppError('SMS service not configured', 503, 'SMS_SERVICE_UNAVAILABLE');
    }

    try {
      const message = await this.client.messages(messageSid).fetch();
      
      return {
        status: message.status,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
      };
    } catch (error: any) {
      logger.error('Failed to fetch SMS status:', error);
      throw new AppError('Failed to fetch SMS status', 500, 'SMS_STATUS_FETCH_FAILED');
    }
  }
}

// Export singleton instance
export const smsService = SmsService.getInstance();