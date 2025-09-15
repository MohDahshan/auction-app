import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { optionalAuth, AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// Validation rules
const productFilters = [
  query('category').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString()
];

const createProductValidation = [
  body('name').isLength({ min: 3, max: 255 }).withMessage('Name must be between 3 and 255 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('brand').optional().isLength({ max: 100 }).withMessage('Brand must be less than 100 characters'),
  body('category').isLength({ min: 2, max: 100 }).withMessage('Category must be between 2 and 100 characters'),
  body('market_price').isInt({ min: 1 }).withMessage('Market price must be a positive integer'),
  body('image_url').optional().isURL().withMessage('Image URL must be a valid URL'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
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

// Create new product
router.post('/', authenticateToken, createProductValidation, async (req: AuthRequest, res: Response): Promise<void> => {
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
      name,
      description,
      brand,
      category,
      market_price,
      image_url,
      is_active = true
    } = req.body;

    const [product] = await db('products')
      .insert({
        name,
        description,
        brand,
        category,
        market_price,
        image_url,
        is_active
      })
      .returning('*');

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update product
router.put('/:id', authenticateToken, createProductValidation, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { id } = req.params;
    const {
      name,
      description,
      brand,
      category,
      market_price,
      image_url,
      is_active
    } = req.body;

    // Check if product exists
    const existingProduct = await db('products').where({ id }).first();
    if (!existingProduct) {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
      return;
    }

    // Check if product is used in any active auctions
    const activeAuctions = await db('auctions')
      .where({ product_id: id })
      .whereIn('status', ['upcoming', 'live'])
      .first();

    if (activeAuctions && !is_active) {
      res.status(400).json({
        success: false,
        error: 'Cannot deactivate product that is used in active auctions'
      });
      return;
    }

    const [updatedProduct] = await db('products')
      .where({ id })
      .update({
        name,
        description,
        brand,
        category,
        market_price,
        image_url,
        is_active,
        updated_at: new Date()
      })
      .returning('*');

    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete product (soft delete)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await db('products').where({ id }).first();
    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
      return;
    }

    // Check if product is used in any active auctions
    const activeAuctions = await db('auctions')
      .where({ product_id: id })
      .whereIn('status', ['upcoming', 'live'])
      .first();

    if (activeAuctions) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete product that is used in active auctions'
      });
      return;
    }

    // Soft delete by setting is_active to false
    await db('products')
      .where({ id })
      .update({
        is_active: false,
        updated_at: new Date()
      });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
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
