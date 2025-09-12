import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Validation rules
const productFilters = [
  query('category').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString()
];

// Get all products with filters
router.get('/', productFilters, optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const {
      category,
      page = 1,
      limit = 20,
      search
    } = req.query;

    let query = db('products')
      .select('*')
      .where('is_active', true)
      .orderBy('created_at', 'desc');

    // Apply filters
    if (category) {
      query = query.where('category', category as string);
    }

    if (search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`)
            .orWhere('brand', 'ilike', `%${search}%`);
      });
    }

    // Get total count for pagination
    const totalQuery = db('products')
      .where('is_active', true)
      .count('* as count');

    if (category) {
      totalQuery.where('category', category as string);
    }

    if (search) {
      totalQuery.where(function() {
        this.where('name', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`)
            .orWhere('brand', 'ilike', `%${search}%`);
      });
    }

    const [{ count: total }] = await totalQuery;
    const totalCount = parseInt(total as string, 10);

    // Apply pagination
    const offset = (Number(page) - 1) * Number(limit);
    const products = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get single product by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await db('products')
      .where({ id, is_active: true })
      .first();

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
      return;
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get product categories
router.get('/categories/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await db('products')
      .select('category')
      .where('is_active', true)
      .whereNotNull('category')
      .groupBy('category')
      .orderBy('category');

    const categoryList = categories.map(row => row.category);

    res.json({
      success: true,
      data: categoryList
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
