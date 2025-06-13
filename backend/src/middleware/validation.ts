import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formattedErrors,
    });
    return;
  }
  
  next();
};

// Common validation rules
export const emailValidation = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email address');

export const passwordValidation = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

export const nameValidation = body('name')
  .trim()
  .isLength({ min: 2, max: 50 })
  .withMessage('Name must be between 2 and 50 characters')
  .matches(/^[a-zA-Z\s]+$/)
  .withMessage('Name can only contain letters and spaces');

// Auth validation schemas
export const registerValidation = [
  emailValidation,
  passwordValidation,
  nameValidation,
  handleValidationErrors,
];

export const loginValidation = [
  emailValidation,
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

// Notification validation schemas
export const notificationValidation = [
  body('to')
    .notEmpty()
    .withMessage('Recipient is required')
    .custom((value, { req }) => {
      const channel = req.body.channel;
      if (channel === 'EMAIL') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error('Invalid email format');
        }
      } else if (channel === 'SMS') {
        if (!/^\+?[1-9]\d{1,14}$/.test(value.replace(/\s/g, ''))) {
          throw new Error('Invalid phone number format');
        }
      }
      return true;
    }),
  
  body('channel')
    .isIn(['EMAIL', 'SMS', 'IN_APP'])
    .withMessage('Channel must be EMAIL, SMS, or IN_APP'),
  
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must not exceed 200 characters'),
  
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
  
  body('templateId')
    .optional()
    .isString()
    .withMessage('Template ID must be a string'),
  
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  
  body('sendAt')
    .optional()
    .isISO8601()
    .withMessage('Send date must be a valid ISO8601 date')
    .custom((value) => {
      const sendDate = new Date(value);
      const now = new Date();
      if (sendDate <= now) {
        throw new Error('Send date must be in the future');
      }
      return true;
    }),
  
  handleValidationErrors,
];

// Batch notification validation
export const batchNotificationValidation = [
  body('name')
    .notEmpty()
    .withMessage('Batch name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Batch name must be between 1 and 100 characters'),
  
  body('recipients')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Recipients must be an array with 1-1000 items'),
  
  body('recipients.*')
    .notEmpty()
    .withMessage('Each recipient must not be empty'),
  
  body('channel')
    .isIn(['EMAIL', 'SMS', 'IN_APP'])
    .withMessage('Channel must be EMAIL, SMS, or IN_APP'),
  
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must not exceed 200 characters'),
  
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
  
  body('templateId')
    .optional()
    .isString()
    .withMessage('Template ID must be a string'),
  
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  
  handleValidationErrors,
];

// Template validation
export const templateValidation = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Template name must be between 1 and 100 characters'),
  
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must not exceed 200 characters'),
  
  body('content')
    .notEmpty()
    .withMessage('Template content is required')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Template content must be between 1 and 10000 characters'),
  
  body('channel')
    .isIn(['EMAIL', 'SMS', 'IN_APP'])
    .withMessage('Channel must be EMAIL, SMS, or IN_APP'),
  
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),
  
  body('variables.*')
    .optional()
    .isString()
    .withMessage('Each variable must be a string'),
  
  handleValidationErrors,
];

// API Key validation
export const apiKeyValidation = [
  body('name')
    .notEmpty()
    .withMessage('API key name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('API key name must be between 1 and 100 characters'),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid ISO8601 date')
    .custom((value) => {
      const expireDate = new Date(value);
      const now = new Date();
      if (expireDate <= now) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    }),
  
  handleValidationErrors,
];

// Parameter validation
export const idParamValidation = [
  param('id')
    .notEmpty()
    .withMessage('ID parameter is required')
    .isString()
    .withMessage('ID must be a string'),
  handleValidationErrors,
];

// Query validation
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isString()
    .withMessage('Sort by must be a string'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  handleValidationErrors,
];

// Filter validation
export const notificationFilterValidation = [
  query('channel')
    .optional()
    .isIn(['EMAIL', 'SMS', 'IN_APP'])
    .withMessage('Channel must be EMAIL, SMS, or IN_APP'),
  
  query('status')
    .optional()
    .isIn(['SUCCESS', 'FAILED', 'PENDING'])
    .withMessage('Status must be SUCCESS, FAILED, or PENDING'),
  
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO8601 date'),
  
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO8601 date'),
  
  handleValidationErrors,
];

// Custom validation helpers
export const validateRecipientFormat = (channel: string, recipient: string): boolean => {
  switch (channel) {
    case 'EMAIL':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
    case 'SMS':
      return /^\+?[1-9]\d{1,14}$/.test(recipient.replace(/\s/g, ''));
    case 'IN_APP':
      return recipient.length > 0;
    default:
      return false;
  }
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const validateTemplateVariables = (content: string, variables: string[]): boolean => {
  const templateVars = content.match(/\{\{(\w+)\}\}/g) || [];
  const extractedVars = templateVars.map(v => v.replace(/[{}]/g, ''));
  
  return extractedVars.every(v => variables.includes(v));
};