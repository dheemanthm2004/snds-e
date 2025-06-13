import { User, ApiKey } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthUtils } from '../utils/auth';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { RegisterPayload, LoginPayload, ApiKeyPayload } from '../types';

export class AuthService {
  // Register new user
  static async register(payload: RegisterPayload): Promise<{ user: Omit<User, 'password'>; token: string }> {
    try {
      const { email, password, name } = payload;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new AppError('User already exists with this email', 409, 'USER_EXISTS');
      }

      // Validate password strength
      const passwordValidation = AuthUtils.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new AppError(
          'Password does not meet requirements',
          400,
          'WEAK_PASSWORD',
          { errors: passwordValidation.errors }
        );
      }

      // Hash password
      const hashedPassword = await AuthUtils.hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          name: AuthUtils.sanitizeInput(name),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Generate JWT token
      const token = AuthUtils.generateToken(user as User);

      logger.info(`New user registered: ${user.email}`, { userId: user.id });

      return { user, token };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Registration failed:', error);
      throw new AppError('Registration failed', 500, 'REGISTRATION_FAILED');
    }
  }

  // Login user
  static async login(payload: LoginPayload): Promise<{ user: Omit<User, 'password'>; token: string }> {
    try {
      const { email, password } = payload;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      if (!user.isActive) {
        throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
      }

      // Verify password
      const isPasswordValid = await AuthUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Generate JWT token
      const token = AuthUtils.generateToken(user);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      logger.info(`User logged in: ${user.email}`, { userId: user.id });

      return { user: userWithoutPassword, token };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Login failed:', error);
      throw new AppError('Login failed', 500, 'LOGIN_FAILED');
    }
  }

  // Create API key
  static async createApiKey(userId: string, payload: ApiKeyPayload): Promise<ApiKey> {
    try {
      const { name, expiresAt } = payload;

      // Generate unique API key
      let apiKey: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        apiKey = AuthUtils.generateApiKey();
        const existing = await prisma.apiKey.findUnique({
          where: { key: apiKey },
        });
        isUnique = !existing;
        attempts++;
      } while (!isUnique && attempts < maxAttempts);

      if (!isUnique) {
        throw new AppError('Failed to generate unique API key', 500, 'API_KEY_GENERATION_FAILED');
      }

      // Create API key
      const newApiKey = await prisma.apiKey.create({
        data: {
          name: AuthUtils.sanitizeInput(name),
          key: apiKey!,
          userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      logger.info(`API key created: ${name}`, { userId, apiKeyId: newApiKey.id });

      return newApiKey;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('API key creation failed:', error);
      throw new AppError('Failed to create API key', 500, 'API_KEY_CREATION_FAILED');
    }
  }

  // Get user's API keys
  static async getUserApiKeys(userId: string): Promise<Omit<ApiKey, 'key'>[]> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          isActive: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return apiKeys;
    } catch (error) {
      logger.error('Failed to fetch API keys:', error);
      throw new AppError('Failed to fetch API keys', 500, 'API_KEYS_FETCH_FAILED');
    }
  }

  // Deactivate API key
  static async deactivateApiKey(userId: string, apiKeyId: string): Promise<void> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: apiKeyId,
          userId,
        },
      });

      if (!apiKey) {
        throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
      }

      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { isActive: false },
      });

      logger.info(`API key deactivated: ${apiKey.name}`, { userId, apiKeyId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('API key deactivation failed:', error);
      throw new AppError('Failed to deactivate API key', 500, 'API_KEY_DEACTIVATION_FAILED');
    }
  }

  // Delete API key
  static async deleteApiKey(userId: string, apiKeyId: string): Promise<void> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: apiKeyId,
          userId,
        },
      });

      if (!apiKey) {
        throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
      }

      await prisma.apiKey.delete({
        where: { id: apiKeyId },
      });

      logger.info(`API key deleted: ${apiKey.name}`, { userId, apiKeyId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('API key deletion failed:', error);
      throw new AppError('Failed to delete API key', 500, 'API_KEY_DELETION_FAILED');
    }
  }

  // Get user profile
  static async getUserProfile(userId: string): Promise<Omit<User, 'password'>> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to fetch user profile:', error);
      throw new AppError('Failed to fetch user profile', 500, 'PROFILE_FETCH_FAILED');
    }
  }

  // Update user profile
  static async updateUserProfile(
    userId: string,
    updates: { name?: string; email?: string }
  ): Promise<Omit<User, 'password'>> {
    try {
      const { name, email } = updates;

      // Check if email is already taken by another user
      if (email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: email.toLowerCase(),
            NOT: { id: userId },
          },
        });

        if (existingUser) {
          throw new AppError('Email already taken', 409, 'EMAIL_TAKEN');
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name && { name: AuthUtils.sanitizeInput(name) }),
          ...(email && { email: email.toLowerCase() }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info(`User profile updated: ${updatedUser.email}`, { userId });

      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Profile update failed:', error);
      throw new AppError('Failed to update profile', 500, 'PROFILE_UPDATE_FAILED');
    }
  }

  // Change password
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify current password
      const isCurrentPasswordValid = await AuthUtils.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }

      // Validate new password
      const passwordValidation = AuthUtils.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(
          'New password does not meet requirements',
          400,
          'WEAK_PASSWORD',
          { errors: passwordValidation.errors }
        );
      }

      // Hash new password
      const hashedNewPassword = await AuthUtils.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      logger.info(`Password changed for user: ${user.email}`, { userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Password change failed:', error);
      throw new AppError('Failed to change password', 500, 'PASSWORD_CHANGE_FAILED');
    }
  }

  // Verify token
  static async verifyToken(token: string): Promise<Omit<User, 'password'>> {
    try {
      const decoded = AuthUtils.verifyToken(token);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.isActive) {
        throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Token verification failed:', error);
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
  }
}