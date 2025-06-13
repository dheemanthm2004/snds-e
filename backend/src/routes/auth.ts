import { Router } from 'express';
import { AuthService } from '../services/authService';
import { authenticate, requireAdmin } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { 
  registerValidation, 
  loginValidation, 
  apiKeyValidation,
  handleValidationErrors 
} from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply rate limiting to auth routes
router.use(authRateLimiter.middleware());

// Register new user
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  const { user, token } = await AuthService.register(req.body);
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      token,
    },
  });
}));

// Login user
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  const { user, token } = await AuthService.login(req.body);
  
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user,
      token,
    },
  });
}));

// Get current user profile
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = await AuthService.getUserProfile(req.user!.id);
  
  res.json({
    success: true,
    data: { user },
  });
}));

// Update user profile
router.put('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = await AuthService.updateUserProfile(req.user!.id, req.body);
  
  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user },
  });
}));

// Change password
router.post('/change-password', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  
  await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
  
  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

// Create API key
router.post('/api-keys', authenticate, apiKeyValidation, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const apiKey = await AuthService.createApiKey(req.user!.id, req.body);
  
  res.status(201).json({
    success: true,
    message: 'API key created successfully',
    data: { apiKey },
  });
}));

// Get user's API keys
router.get('/api-keys', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const apiKeys = await AuthService.getUserApiKeys(req.user!.id);
  
  res.json({
    success: true,
    data: { apiKeys },
  });
}));

// Deactivate API key
router.patch('/api-keys/:id/deactivate', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  await AuthService.deactivateApiKey(req.user!.id, req.params.id);
  
  res.json({
    success: true,
    message: 'API key deactivated successfully',
  });
}));

// Delete API key
router.delete('/api-keys/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  await AuthService.deleteApiKey(req.user!.id, req.params.id);
  
  res.json({
    success: true,
    message: 'API key deleted successfully',
  });
}));

// Verify token (for frontend to check if token is still valid)
router.post('/verify', asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Token is required',
      code: 'TOKEN_REQUIRED',
    });
  }
  
  const user = await AuthService.verifyToken(token);
  
  res.json({
    success: true,
    message: 'Token is valid',
    data: { user },
  });
}));

export default router;