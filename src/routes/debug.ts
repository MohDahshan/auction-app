import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';

const router = Router();

// Debug endpoint to check user data
router.get('/user/:email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.params;
    
    const user = await db('users').where({ email }).first();
    
    if (!user) {
      res.json({
        success: false,
        message: 'User not found',
        email
      });
      return;
    }

    // Test password hash
    const testPassword = 'admin123';
    const isValidPassword = await bcrypt.compare(testPassword, user.password_hash);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_active: user.is_active,
        email_verified: user.email_verified,
        created_at: user.created_at
      },
      password_test: {
        test_password: testPassword,
        hash_in_db: user.password_hash,
        is_valid: isValidPassword
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test password hash generation
router.get('/test-hash/:password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.params;
    const hash = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare(password, hash);
    
    res.json({
      password,
      hash,
      is_valid: isValid
    });
  } catch (error) {
    console.error('Hash test error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user password hash
router.post('/update-password/:email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.params;
    const { password } = req.body;
    
    if (!password) {
      res.status(400).json({
        success: false,
        error: 'Password is required'
      });
      return;
    }

    // Generate new hash
    const password_hash = await bcrypt.hash(password, 12);
    
    // Update user
    const updated = await db('users')
      .where({ email })
      .update({ password_hash })
      .returning('*');

    if (updated.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Test the new hash
    const isValid = await bcrypt.compare(password, password_hash);

    res.json({
      success: true,
      message: 'Password updated successfully',
      user: {
        email: updated[0].email,
        name: updated[0].name
      },
      password_test: {
        password,
        new_hash: password_hash,
        is_valid: isValid
      }
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
