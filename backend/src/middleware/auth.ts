import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthUtils } from '../utils/auth';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';

// JWT Authentication Middleware
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
      return;
    }

    // Verify JWT token
    const decoded = AuthUtils.verifyToken(token);
    
    // Get user from database
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
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
      return;
    }

    // Add user to request object
    req.user = user as any;
    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.message === 'Token has expired') {
      res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.message === 'Invalid token') {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  }
};

// API Key Authentication Middleware
export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'API_KEY_REQUIRED'
      });
      return;
    }

    // Find API key in database
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        }
      }
    });

    if (!apiKeyRecord) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
      return;
    }

    if (!apiKeyRecord.isActive) {
      res.status(401).json({
        success: false,
        error: 'API key is deactivated',
        code: 'API_KEY_DEACTIVATED'
      });
      return;
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: 'API key has expired',
        code: 'API_KEY_EXPIRED'
      });
      return;
    }

    if (!apiKeyRecord.user.isActive) {
      res.status(401).json({
        success: false,
        error: 'User account is deactivated',
        code: 'USER_DEACTIVATED'
      });
      return;
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() }
    });

    // Add user and API key to request object
    req.user = apiKeyRecord.user as any;
    req.apiKey = apiKey;
    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Combined authentication middleware (JWT or API Key)
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  if (authHeader) {
    // Try JWT authentication
    await authenticateToken(req, res, next);
  } else if (apiKey) {
    // Try API key authentication
    await authenticateApiKey(req, res, next);
  } else {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide either Bearer token or X-API-Key header',
      code: 'AUTH_REQUIRED'
    });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

// Admin only middleware
export const requireAdmin = requireRole(['ADMIN']);

// Optional authentication middleware (doesn't fail if no auth provided)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  if (authHeader || apiKey) {
    // If auth is provided, validate it
    await authenticate(req, res, next);
  } else {
    // If no auth provided, continue without user
    next();
  }
};