// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
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

export interface NotificationLog {
  id: string;
  to: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  subject?: string;
  message: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  error?: string;
  attempt: number;
  templateId?: string;
  variables?: Record<string, any>;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Template types
export interface Template {
  id: string;
  name: string;
  subject?: string;
  content: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  variables: string[];
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatePayload {
  name: string;
  subject?: string;
  content: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  variables?: string[];
}

// API Key types
export interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
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
  recentActivity: NotificationLog[];
  trends: {
    daily: Array<{
      date: string;
      total: number;
      successful: number;
      failed: number;
    }>;
    weekly: Array<{
      week: string;
      total: number;
      successful: number;
      failed: number;
    }>;
  };
}

// Batch notification types
export interface BatchNotification {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  subject?: string;
  message: string;
  recipients: string[];
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  templateId?: string;
  variables?: Record<string, any>;
  userId?: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// API Response types
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

// Socket types
export interface SocketNotification {
  id: string;
  to: string;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, any>;
  timestamp: string;
  read?: boolean;
}

// Form types
export interface FormState {
  isSubmitting: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

// Dashboard types
export interface DashboardStats {
  totalNotifications: number;
  successRate: number;
  activeTemplates: number;
  connectedUsers: number;
  recentNotifications: NotificationLog[];
  channelStats: {
    email: { sent: number; success: number };
    sms: { sent: number; success: number };
    inApp: { sent: number; success: number };
  };
}

// Chart data types
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  total: number;
  successful: number;
  failed: number;
}

// Navigation types
export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  current?: boolean;
  badge?: number;
}

// Theme types
export interface ThemeConfig {
  mode: 'light' | 'dark';
  primaryColor: string;
  accentColor: string;
}

// Settings types
export interface UserSettings {
  notifications: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
  theme: ThemeConfig;
  language: string;
  timezone: string;
}