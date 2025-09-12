import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { config } from '../config';
import { db } from '../config/database';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { User, LoginRequest, RegisterRequest, AuthTokens } from '../types';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('phone').optional().isMobilePhone('any')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

// Helper function to generate tokens
const generateTokens = (userId: string): AuthTokens => {
  const access_token = jwt.sign({ userId }, config.jwt.secret as string, {
    expiresIn: config.jwt.expiresIn
  } as SignOptions);
  
  const refresh_token = jwt.sign({ userId }, config.jwt.refreshSecret as string, {
    expiresIn: config.jwt.refreshExpiresIn
  } as SignOptions);

  return {
    access_token,
    refresh_token,
    expires_in: 24 * 60 * 60 // 24 hours in seconds
  };
};

// Register endpoint
router.post('/register', registerValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { email, password, name, phone }: RegisterRequest = req.body;

    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, config.bcrypt.rounds);

    // Create user
    const [user] = await db('users')
      .insert({
        email,
        password_hash,
        name,
        phone,
        wallet_balance: 500 // Starting balance
      })
      .returning('*');

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Remove password hash from response
    const { password_hash: _, ...userResponse } = user;

    res.status(201).json({
      success: true,
      data: {
        user: userResponse,
        tokens
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Login endpoint
router.post('/login', loginValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { email, password }: LoginRequest = req.body;

    // Find user
    const user = await db('users').where({ email, is_active: true }).first();
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    // Update last login
    await db('users')
      .where({ id: user.id })
      .update({ last_login_at: new Date() });

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Remove password hash from response
    const { password_hash: _, ...userResponse } = user;

    res.json({
      success: true,
      data: {
        user: userResponse,
        tokens
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user endpoint
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
      return;
    }

    const decoded = jwt.verify(refresh_token, config.jwt.refreshSecret as string) as { userId: string };
    
    // Verify user still exists and is active
    const user = await db('users')
      .where({ id: decoded.userId, is_active: true })
      .first();

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
      return;
    }

    // Generate new tokens
    const tokens = generateTokens(user.id);

    res.json({
      success: true,
      data: { tokens },
      message: 'Tokens refreshed successfully'
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
      return;
    }

    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Logout endpoint (optional - mainly for client-side token cleanup)
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
