import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { cache } from '../utils/redis';

interface InAppNotification {
  id: string;
  to: string;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, any>;
  timestamp: string;
  read?: boolean;
}

interface NotificationOptions {
  to: string;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, any>;
  persistent?: boolean; // Whether to store for offline users
  ttl?: number; // Time to live in seconds for persistent notifications
}

export class InAppService {
  private static instance: InAppService;
  private io: Server | null = null;
  private isConfigured: boolean = false;

  private constructor() {}

  public static getInstance(): InAppService {
    if (!InAppService.instance) {
      InAppService.instance = new InAppService();
    }
    return InAppService.instance;
  }

  public setSocketServer(server: Server): void {
    this.io = server;
    this.isConfigured = true;
    this.setupSocketHandlers();
    logger.info('✅ In-app notification service initialized');
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.debug(`User connected: ${socket.id}`);

      // Join user to their personal room
      socket.on('join', (userId: string) => {
        socket.join(`user:${userId}`);
        logger.debug(`User ${userId} joined personal room`);
        
        // Send any pending notifications
        this.sendPendingNotifications(userId);
      });

      // Handle notification read status
      socket.on('mark_read', async (data: { notificationId: string; userId: string }) => {
        await this.markNotificationAsRead(data.notificationId, data.userId);
      });

      // Handle bulk mark as read
      socket.on('mark_all_read', async (userId: string) => {
        await this.markAllNotificationsAsRead(userId);
      });

      socket.on('disconnect', () => {
        logger.debug(`User disconnected: ${socket.id}`);
      });
    });
  }

  public async sendNotification(options: NotificationOptions): Promise<{ delivered: boolean; stored?: boolean }> {
    if (!this.isConfigured) {
      throw new AppError('In-app service not configured', 503, 'INAPP_SERVICE_UNAVAILABLE');
    }

    try {
      const notification: InAppNotification = {
        id: this.generateNotificationId(),
        to: options.to,
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        data: options.data,
        timestamp: new Date().toISOString(),
        read: false,
      };

      // Try to deliver immediately if user is online
      const delivered = await this.deliverNotification(notification);

      // Store for offline delivery if persistent or user is offline
      let stored = false;
      if (options.persistent || !delivered) {
        stored = await this.storeNotification(notification, options.ttl);
      }

      logger.info(`📱 In-app notification processed`, {
        to: options.to,
        delivered,
        stored,
        type: options.type,
      });

      return { delivered, stored };
    } catch (error: any) {
      logger.error(`❌ Failed to send in-app notification to ${options.to}:`, error);
      throw new AppError('Failed to send in-app notification', 500, 'INAPP_SEND_FAILED', {
        originalError: error.message,
      });
    }
  }

  public async sendTemplateNotification(
    to: string,
    template: string,
    variables: Record<string, any> = {},
    options: Partial<NotificationOptions> = {}
  ): Promise<{ delivered: boolean; stored?: boolean }> {
    try {
      // Replace template variables
      let processedMessage = template;
      let processedTitle = options.title || '';

      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedMessage = processedMessage.replace(placeholder, String(value));
        processedTitle = processedTitle.replace(placeholder, String(value));
      });

      return await this.sendNotification({
        ...options,
        to,
        title: processedTitle || options.title,
        message: processedMessage,
      });
    } catch (error) {
      logger.error('Failed to send template in-app notification:', error);
      throw error;
    }
  }

  public async sendBulkNotifications(
    notifications: Array<{
      to: string;
      template: string;
      variables?: Record<string, any>;
      options?: Partial<NotificationOptions>;
    }>
  ): Promise<Array<{ to: string; success: boolean; delivered?: boolean; error?: string }>> {
    const results: Array<{ to: string; success: boolean; delivered?: boolean; error?: string }> = [];

    for (const notif of notifications) {
      try {
        const result = await this.sendTemplateNotification(
          notif.to,
          notif.template,
          notif.variables,
          notif.options
        );

        results.push({
          to: notif.to,
          success: true,
          delivered: result.delivered,
        });
      } catch (error: any) {
        results.push({
          to: notif.to,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  private async deliverNotification(notification: InAppNotification): Promise<boolean> {
    if (!this.io) return false;

    try {
      const userRoom = `user:${notification.to}`;
      const sockets = await this.io.in(userRoom).fetchSockets();

      if (sockets.length === 0) {
        // User is not online
        return false;
      }

      // Send to all user's connected devices
      this.io.to(userRoom).emit('notification', notification);
      
      return true;
    } catch (error) {
      logger.error('Failed to deliver notification:', error);
      return false;
    }
  }

  private async storeNotification(notification: InAppNotification, ttl?: number): Promise<boolean> {
    try {
      const key = `notifications:${notification.to}`;
      const notificationKey = `notification:${notification.id}`;

      // Store individual notification
      await cache.set(notificationKey, notification, ttl || 86400); // Default 24 hours

      // Add to user's notification list
      const userNotifications = await cache.get<string[]>(key) || [];
      userNotifications.unshift(notification.id);

      // Keep only last 100 notifications
      if (userNotifications.length > 100) {
        const removedIds = userNotifications.splice(100);
        // Clean up old notifications
        for (const id of removedIds) {
          await cache.del(`notification:${id}`);
        }
      }

      await cache.set(key, userNotifications, ttl || 86400);
      
      return true;
    } catch (error) {
      logger.error('Failed to store notification:', error);
      return false;
    }
  }

  private async sendPendingNotifications(userId: string): Promise<void> {
    try {
      const notifications = await this.getUserNotifications(userId, false); // Only unread
      
      if (notifications.length > 0) {
        const userRoom = `user:${userId}`;
        this.io?.to(userRoom).emit('pending_notifications', notifications);
        
        logger.debug(`Sent ${notifications.length} pending notifications to user ${userId}`);
      }
    } catch (error) {
      logger.error('Failed to send pending notifications:', error);
    }
  }

  public async getUserNotifications(
    userId: string,
    includeRead: boolean = true,
    limit: number = 50
  ): Promise<InAppNotification[]> {
    try {
      const key = `notifications:${userId}`;
      const notificationIds = await cache.get<string[]>(key) || [];

      const notifications: InAppNotification[] = [];
      
      for (const id of notificationIds.slice(0, limit)) {
        const notification = await cache.get<InAppNotification>(`notification:${id}`);
        if (notification && (includeRead || !notification.read)) {
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to get user notifications:', error);
      return [];
    }
  }

  public async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await cache.get<InAppNotification>(`notification:${notificationId}`);
      
      if (notification && notification.to === userId) {
        notification.read = true;
        await cache.set(`notification:${notificationId}`, notification);
        
        // Emit read status update
        const userRoom = `user:${userId}`;
        this.io?.to(userRoom).emit('notification_read', { notificationId });
      }
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
    }
  }

  public async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const notifications = await this.getUserNotifications(userId, false); // Only unread
      
      for (const notification of notifications) {
        notification.read = true;
        await cache.set(`notification:${notification.id}`, notification);
      }

      // Emit bulk read status update
      const userRoom = `user:${userId}`;
      this.io?.to(userRoom).emit('all_notifications_read');
      
      logger.debug(`Marked ${notifications.length} notifications as read for user ${userId}`);
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
    }
  }

  public async getUnreadCount(userId: string): Promise<number> {
    try {
      const notifications = await this.getUserNotifications(userId, false);
      return notifications.length;
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      return 0;
    }
  }

  public async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await cache.get<InAppNotification>(`notification:${notificationId}`);
      
      if (notification && notification.to === userId) {
        // Remove from user's notification list
        const key = `notifications:${userId}`;
        const notificationIds = await cache.get<string[]>(key) || [];
        const updatedIds = notificationIds.filter(id => id !== notificationId);
        await cache.set(key, updatedIds);

        // Delete the notification
        await cache.del(`notification:${notificationId}`);

        // Emit deletion event
        const userRoom = `user:${userId}`;
        this.io?.to(userRoom).emit('notification_deleted', { notificationId });
      }
    } catch (error) {
      logger.error('Failed to delete notification:', error);
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async testConnection(): Promise<boolean> {
    return this.isConfigured && this.io !== null;
  }

  public getConnectionStatus(): boolean {
    return this.isConfigured;
  }

  public getConnectedUsers(): number {
    if (!this.io) return 0;
    return this.io.sockets.sockets.size;
  }

  // Generate preview
  public generatePreview(
    template: string,
    variables: Record<string, any> = {}
  ): { content: string } {
    let processedMessage = template;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedMessage = processedMessage.replace(placeholder, String(value));
    });

    return {
      content: processedMessage,
    };
  }
}

// Export singleton instance
export const inAppService = InAppService.getInstance();