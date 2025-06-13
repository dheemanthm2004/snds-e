import { Request } from 'express';
import { User } from '@prisma/client';

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  user?: User;
  apiKey?: string;
}

// Notification types
export interface NotificationPayload {
  to: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  subject?: string;
  message: string;
  templateId?: string;
  variables?: Record<string, any>;
  sendAt?: string;
  metadata?: Record<string, any>;
}

export interface BatchNotificationPayload {
  name: string;
  recipients: string[];
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  subject?: string;
  message: string;
  templateId?: string;
  variables?: Record<string, any>;
}

// Template types
export interface TemplatePayload {
  name: string;
  subject?: string;
  content: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  variables?: string[];
}

// Auth types
export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ApiKeyPayload {
  name: string;
  expiresAt?: string;
}

// Analytics types
export interface AnalyticsData {
  totalNotifications: number;
  successfulNotifications: number;
  failedNotifications: number;
  successRate: number;
  channelBreakdown: {
    email: number;
    sms: number;
    inApp: number;
  };
  recentActivity: any[];
  trends: {
    daily: any[];
    weekly: any[];
  };
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    queue: 'active' | 'inactive';
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    queueStats: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  };
}

// Error types
export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
}

// Queue job types
export interface NotificationJob {
  id: string;
  to: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  subject?: string;
  message: string;
  templateId?: string;
  variables?: Record<string, any>;
  userId?: string;
  metadata?: Record<string, any>;
  attempt?: number;
}

export interface BatchJob {
  batchId: string;
  recipients: string[];
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  subject?: string;
  message: string;
  templateId?: string;
  variables?: Record<string, any>;
  userId?: string;
}

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination types
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter types
export interface NotificationFilters {
  channel?: 'EMAIL' | 'SMS' | 'IN_APP';
  status?: 'SUCCESS' | 'FAILED' | 'PENDING';
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
}

export interface TemplateFilters {
  channel?: 'EMAIL' | 'SMS' | 'IN_APP';
  isActive?: boolean;
  userId?: string;
}