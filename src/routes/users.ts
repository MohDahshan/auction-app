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

export default router;
