import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

// Types
import {
  ApiResponse,
  LoginCredentials,
  RegisterData,
  User,
  NotificationPayload,
  BatchNotificationPayload,
  TemplatePayload,
  ApiKeyPayload,
  NotificationLog,
  Template,
  ApiKey,
  AnalyticsData,
  BatchNotification,
  PaginationOptions,
  NotificationFilters,
} from '../types';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadTokenFromStorage();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          this.clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }

        // Show error toast for non-401 errors
        if (error.response?.status !== 401) {
          const message = error.response?.data?.error || error.message || 'An error occurred';
          toast.error(message);
        }

        return Promise.reject(error);
      }
    );
  }

  private loadTokenFromStorage() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.setToken(token);
      }
    }
  }

  public setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  public clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  // Generic request method
  private async request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config);
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
  }

  async register(data: RegisterData): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request({
      method: 'POST',
      url: '/auth/register',
      data,
    });
  }

  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    return this.request({
      method: 'GET',
      url: '/auth/profile',
    });
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    return this.request({
      method: 'PUT',
      url: '/auth/profile',
      data,
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse> {
    return this.request({
      method: 'POST',
      url: '/auth/change-password',
      data,
    });
  }

  async verifyToken(token: string): Promise<ApiResponse<{ user: User }>> {
    return this.request({
      method: 'POST',
      url: '/auth/verify',
      data: { token },
    });
  }

  // API Key endpoints
  async createApiKey(data: ApiKeyPayload): Promise<ApiResponse<{ apiKey: ApiKey }>> {
    return this.request({
      method: 'POST',
      url: '/auth/api-keys',
      data,
    });
  }

  async getApiKeys(): Promise<ApiResponse<{ apiKeys: ApiKey[] }>> {
    return this.request({
      method: 'GET',
      url: '/auth/api-keys',
    });
  }

  async deactivateApiKey(id: string): Promise<ApiResponse> {
    return this.request({
      method: 'PATCH',
      url: `/auth/api-keys/${id}/deactivate`,
    });
  }

  async deleteApiKey(id: string): Promise<ApiResponse> {
    return this.request({
      method: 'DELETE',
      url: `/auth/api-keys/${id}`,
    });
  }

  // Notification endpoints
  async sendNotification(data: NotificationPayload): Promise<ApiResponse> {
    return this.request({
      method: 'POST',
      url: '/notifications',
      data,
    });
  }

  async sendBatchNotification(data: BatchNotificationPayload): Promise<ApiResponse<{ batchId: string }>> {
    return this.request({
      method: 'POST',
      url: '/notifications/batch',
      data,
    });
  }

  async getNotificationLogs(
    options?: PaginationOptions & NotificationFilters
  ): Promise<ApiResponse<{ logs: NotificationLog[]; total: number }>> {
    return this.request({
      method: 'GET',
      url: '/notifications/logs',
      params: options,
    });
  }

  async getNotificationById(id: string): Promise<ApiResponse<{ notification: NotificationLog }>> {
    return this.request({
      method: 'GET',
      url: `/notifications/${id}`,
    });
  }

  async retryNotification(id: string): Promise<ApiResponse> {
    return this.request({
      method: 'POST',
      url: `/notifications/${id}/retry`,
    });
  }

  // Batch notification endpoints
  async getBatchNotifications(
    options?: PaginationOptions
  ): Promise<ApiResponse<{ batches: BatchNotification[]; total: number }>> {
    return this.request({
      method: 'GET',
      url: '/notifications/batches',
      params: options,
    });
  }

  async getBatchNotificationById(id: string): Promise<ApiResponse<{ batch: BatchNotification }>> {
    return this.request({
      method: 'GET',
      url: `/notifications/batches/${id}`,
    });
  }

  async cancelBatchNotification(id: string): Promise<ApiResponse> {
    return this.request({
      method: 'POST',
      url: `/notifications/batches/${id}/cancel`,
    });
  }

  // Template endpoints
  async createTemplate(data: TemplatePayload): Promise<ApiResponse<{ template: Template }>> {
    return this.request({
      method: 'POST',
      url: '/templates',
      data,
    });
  }

  async getTemplates(
    options?: PaginationOptions & { channel?: string; isActive?: boolean }
  ): Promise<ApiResponse<{ templates: Template[]; total: number }>> {
    return this.request({
      method: 'GET',
      url: '/templates',
      params: options,
    });
  }

  async getTemplateById(id: string): Promise<ApiResponse<{ template: Template }>> {
    return this.request({
      method: 'GET',
      url: `/templates/${id}`,
    });
  }

  async updateTemplate(id: string, data: Partial<TemplatePayload>): Promise<ApiResponse<{ template: Template }>> {
    return this.request({
      method: 'PUT',
      url: `/templates/${id}`,
      data,
    });
  }

  async deleteTemplate(id: string): Promise<ApiResponse> {
    return this.request({
      method: 'DELETE',
      url: `/templates/${id}`,
    });
  }

  async previewTemplate(
    id: string,
    variables?: Record<string, any>
  ): Promise<ApiResponse<{ preview: { subject?: string; content: string; html?: string } }>> {
    return this.request({
      method: 'POST',
      url: `/templates/${id}/preview`,
      data: { variables },
    });
  }

  // Analytics endpoints
  async getAnalytics(
    period?: 'day' | 'week' | 'month' | 'year'
  ): Promise<ApiResponse<{ analytics: AnalyticsData }>> {
    return this.request({
      method: 'GET',
      url: '/analytics',
      params: { period },
    });
  }

  async getDashboardStats(): Promise<ApiResponse<{ stats: any }>> {
    return this.request({
      method: 'GET',
      url: '/analytics/dashboard',
    });
  }

  async getChannelStats(): Promise<ApiResponse<{ stats: any }>> {
    return this.request({
      method: 'GET',
      url: '/analytics/channels',
    });
  }

  async exportData(
    type: 'notifications' | 'templates' | 'analytics',
    format: 'csv' | 'json' = 'csv'
  ): Promise<Blob> {
    const response = await this.client.request({
      method: 'GET',
      url: `/analytics/export/${type}`,
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  }

  // Health check
  async getHealth(): Promise<ApiResponse> {
    return this.request({
      method: 'GET',
      url: '/health',
    });
  }

  async getDetailedHealth(): Promise<ApiResponse> {
    return this.request({
      method: 'GET',
      url: '/health/detailed',
    });
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export individual API functions for easier use
export const authApi = {
  login: (credentials: LoginCredentials) => apiClient.login(credentials),
  register: (data: RegisterData) => apiClient.register(data),
  getProfile: () => apiClient.getProfile(),
  updateProfile: (data: Partial<User>) => apiClient.updateProfile(data),
  changePassword: (data: { currentPassword: string; newPassword: string }) => apiClient.changePassword(data),
  verifyToken: (token: string) => apiClient.verifyToken(token),
};

export const notificationApi = {
  send: (data: NotificationPayload) => apiClient.sendNotification(data),
  sendBatch: (data: BatchNotificationPayload) => apiClient.sendBatchNotification(data),
  getLogs: (options?: PaginationOptions & NotificationFilters) => apiClient.getNotificationLogs(options),
  getById: (id: string) => apiClient.getNotificationById(id),
  retry: (id: string) => apiClient.retryNotification(id),
  getBatches: (options?: PaginationOptions) => apiClient.getBatchNotifications(options),
  getBatchById: (id: string) => apiClient.getBatchNotificationById(id),
  cancelBatch: (id: string) => apiClient.cancelBatchNotification(id),
};

export const templateApi = {
  create: (data: TemplatePayload) => apiClient.createTemplate(data),
  getAll: (options?: PaginationOptions & { channel?: string; isActive?: boolean }) => apiClient.getTemplates(options),
  getById: (id: string) => apiClient.getTemplateById(id),
  update: (id: string, data: Partial<TemplatePayload>) => apiClient.updateTemplate(id, data),
  delete: (id: string) => apiClient.deleteTemplate(id),
  preview: (id: string, variables?: Record<string, any>) => apiClient.previewTemplate(id, variables),
};

export const analyticsApi = {
  get: (period?: 'day' | 'week' | 'month' | 'year') => apiClient.getAnalytics(period),
  getDashboard: () => apiClient.getDashboardStats(),
  getChannels: () => apiClient.getChannelStats(),
  export: (type: 'notifications' | 'templates' | 'analytics', format: 'csv' | 'json' = 'csv') => 
    apiClient.exportData(type, format),
};

export const apiKeyApi = {
  create: (data: ApiKeyPayload) => apiClient.createApiKey(data),
  getAll: () => apiClient.getApiKeys(),
  deactivate: (id: string) => apiClient.deactivateApiKey(id),
  delete: (id: string) => apiClient.deleteApiKey(id),
};

export default apiClient;