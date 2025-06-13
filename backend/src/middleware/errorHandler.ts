import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { ApiError } from '../types';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Log the error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle different types of errors
  if (error instanceof AppError) {
    // Custom application errors
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma database errors
    ({ statusCode, message, code, details } = handlePrismaError(error));
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    // Prisma validation errors
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
    details = { originalError: error.message };
  } else if (error.name === 'ValidationError') {
    // Mongoose/validation errors
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = extractValidationErrors(error);
  } else if (error.name === 'JsonWebTokenError') {
    // JWT errors
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    // JWT expiration errors
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (error.name === 'CastError') {
    // MongoDB cast errors
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  } else if (error.name === 'SyntaxError' && 'body' in error) {
    // JSON parsing errors
    statusCode = 400;
    message = 'Invalid JSON format';
    code = 'INVALID_JSON';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong';
    details = undefined;
  }

  // Send error response
  const errorResponse: ApiError = {
    message,
    code,
    statusCode,
    ...(details && { details }),
  };

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
    }),
  });
};

// Handle Prisma errors
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  code: string;
  details?: any;
} {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return {
        statusCode: 409,
        message: 'Resource already exists',
        code: 'DUPLICATE_RESOURCE',
        details: {
          field: error.meta?.target,
        },
      };

    case 'P2025':
      // Record not found
      return {
        statusCode: 404,
        message: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND',
      };

    case 'P2003':
      // Foreign key constraint violation
      return {
        statusCode: 400,
        message: 'Invalid reference to related resource',
        code: 'INVALID_REFERENCE',
        details: {
          field: error.meta?.field_name,
        },
      };

    case 'P2014':
      // Required relation violation
      return {
        statusCode: 400,
        message: 'Required relation missing',
        code: 'MISSING_RELATION',
        details: {
          relation: error.meta?.relation_name,
        },
      };

    case 'P2000':
      // Value too long
      return {
        statusCode: 400,
        message: 'Value too long for field',
        code: 'VALUE_TOO_LONG',
        details: {
          field: error.meta?.column_name,
        },
      };

    case 'P2001':
      // Record does not exist
      return {
        statusCode: 404,
        message: 'Record does not exist',
        code: 'RECORD_NOT_FOUND',
      };

    default:
      return {
        statusCode: 500,
        message: 'Database error',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? { prismaCode: error.code } : undefined,
      };
  }
}

// Extract validation errors
function extractValidationErrors(error: any): any {
  if (error.errors) {
    const validationErrors: any = {};
    Object.keys(error.errors).forEach((key) => {
      validationErrors[key] = error.errors[key].message;
    });
    return validationErrors;
  }
  return undefined;
}

// Not found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error helper
export const createValidationError = (message: string, field?: string): AppError => {
  return new AppError(
    message,
    400,
    'VALIDATION_ERROR',
    field ? { field } : undefined
  );
};

// Authorization error helper
export const createAuthError = (message: string = 'Unauthorized'): AppError => {
  return new AppError(message, 401, 'UNAUTHORIZED');
};

// Forbidden error helper
export const createForbiddenError = (message: string = 'Forbidden'): AppError => {
  return new AppError(message, 403, 'FORBIDDEN');
};

// Not found error helper
export const createNotFoundError = (resource: string = 'Resource'): AppError => {
  return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
};

// Conflict error helper
export const createConflictError = (message: string): AppError => {
  return new AppError(message, 409, 'CONFLICT');
};

// Rate limit error helper
export const createRateLimitError = (message: string = 'Too many requests'): AppError => {
  return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
};

// Service unavailable error helper
export const createServiceUnavailableError = (message: string = 'Service temporarily unavailable'): AppError => {
  return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
};