import express from 'express';
import { db } from '../config/database';

const router = express.Router();

// Get all users with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let query = db('users').select('*');
    let countQuery = db('users');

    // Add search functionality
    if (search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
      });
      
      countQuery = countQuery.where(function() {
        this.where('name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
      });
    }

    // Get total count for pagination
    const totalResult = await countQuery.count('* as count').first();
    const total = parseInt(totalResult?.count as string) || 0;
    const pages = Math.ceil(total / limit);

    // Get users with pagination
    const users = await query
      .select([
        'id',
        'email',
        'name',
        'phone',
        'wallet_balance',
        'is_active',
        'created_at',
        'last_login_at'
      ])
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db('users')
      .select([
        'id',
        'email',
        'name',
        'phone',
        'wallet_balance',
        'is_active',
        'created_at',
        'last_login_at'
      ])
      .where('id', id)
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const { email, name, phone, password } = req.body;

    // Basic validation
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, name, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await db('users').where('email', email).first();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Create user (password should be hashed in real app)
    const [newUser] = await db('users')
      .insert({
        email,
        name,
        phone,
        password_hash: password, // In real app, hash this!
        wallet_balance: 500
      })
      .returning([
        'id',
        'email',
        'name',
        'phone',
        'wallet_balance',
        'is_active',
        'created_at'
      ]);

    return res.status(201).json({
      success: true,
      data: newUser
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, phone, wallet_balance, is_active } = req.body;

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (wallet_balance !== undefined) updateData.wallet_balance = wallet_balance;
    if (is_active !== undefined) updateData.is_active = is_active;

    const [updatedUser] = await db('users')
      .where('id', id)
      .update(updateData)
      .returning([
        'id',
        'email',
        'name',
        'phone',
        'wallet_balance',
        'is_active',
        'created_at',
        'last_login_at'
      ]);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCount = await db('users').where('id', id).del();

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

export default router;
