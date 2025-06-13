import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { cache } from '../utils/redis';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';

// Configuration
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

// Custom rate limiter using Redis
export class RedisRateLimiter {
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = WINDOW_MS, maxRequests: number = MAX_REQUESTS) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async isAllowed(identifier: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
      const key = `rate_limit:${identifier}:${windowStart}`;

      // Get current count
      const current = await cache.increment(key, Math.ceil(this.windowMs / 1000));
      
      const remaining = Math.max(0, this.maxRequests - current);
      const resetTime = windowStart + this.windowMs;

      return {
        allowed: current <= this.maxRequests,
        remaining,
        resetTime
      };
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: this.maxRequests,
        resetTime: Date.now() + this.windowMs
      };
    }
  }

  middleware() {
    return async (req: Request, res: Response, next: Function) => {
      try {
        // Get identifier (IP address or user ID if authenticated)
        const authReq = req as AuthenticatedRequest;
        const identifier = authReq.user?.id || req.ip || 'anonymous';

        const result = await this.isAllowed(identifier);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.maxRequests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        });

        if (!result.allowed) {
          logger.warn(`Rate limit exceeded for ${identifier}`, {
            identifier,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
          });

          res.status(429).json({
            success: false,
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Rate limiter middleware error:', error);
        // On error, allow the request
        next();
      }
    };
  }
}

// Default rate limiter
export const defaultRateLimiter = new RedisRateLimiter();

// Specific rate limiters for different endpoints
export const authRateLimiter = new RedisRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5 // 5 attempts
);

export const notificationRateLimiter = new RedisRateLimiter(
  60 * 1000, // 1 minute
  10 // 10 notifications per minute
);

export const batchRateLimiter = new RedisRateLimiter(
  60 * 60 * 1000, // 1 hour
  5 // 5 batch operations per hour
);

// Express rate limiter fallback (if Redis is not available)
export const expressRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  message: {
    success: false,
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user?.id || req.ip || 'anonymous';
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Express rate limit exceeded for ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

// Middleware factory for custom rate limits
export const createRateLimiter = (windowMs: number, maxRequests: number) => {
  return new RedisRateLimiter(windowMs, maxRequests).middleware();
};

// IP-based rate limiter for public endpoints
export const ipRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: {
    success: false,
    error: 'Too many requests from this IP',
    code: 'IP_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for sensitive operations
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: {
    success: false,
    error: 'Rate limit exceeded for sensitive operation',
    code: 'STRICT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});