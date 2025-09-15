"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const productFilters = [
    (0, express_validator_1.query)('category').optional().isString(),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('search').optional().isString()
];
const createProductValidation = [
    (0, express_validator_1.body)('name').isLength({ min: 3, max: 255 }).withMessage('Name must be between 3 and 255 characters'),
    (0, express_validator_1.body)('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    (0, express_validator_1.body)('brand').optional().isLength({ max: 100 }).withMessage('Brand must be less than 100 characters'),
    (0, express_validator_1.body)('category').isLength({ min: 2, max: 100 }).withMessage('Category must be between 2 and 100 characters'),
    (0, express_validator_1.body)('market_price').isInt({ min: 1 }).withMessage('Market price must be a positive integer'),
    (0, express_validator_1.body)('image_url').optional().isURL().withMessage('Image URL must be a valid URL'),
    (0, express_validator_1.body)('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
];
router.get('/', productFilters, auth_1.optionalAuth, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
            return;
        }
        const { category, page = 1, limit = 20, search } = req.query;
        let query = (0, database_1.db)('products')
            .select('*')
            .where('is_active', true)
            .orderBy('created_at', 'desc');
        if (category) {
            query = query.where('category', category);
        }
        if (search) {
            query = query.where(function () {
                this.where('name', 'ilike', `%${search}%`)
                    .orWhere('description', 'ilike', `%${search}%`)
                    .orWhere('brand', 'ilike', `%${search}%`);
            });
        }
        const totalQuery = (0, database_1.db)('products')
            .where('is_active', true)
            .count('* as count');
        if (category) {
            totalQuery.where('category', category);
        }
        if (search) {
            totalQuery.where(function () {
                this.where('name', 'ilike', `%${search}%`)
                    .orWhere('description', 'ilike', `%${search}%`)
                    .orWhere('brand', 'ilike', `%${search}%`);
            });
        }
        const [{ count: total }] = await totalQuery;
        const totalCount = parseInt(total, 10);
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
    }
    catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await (0, database_1.db)('products')
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
    }
    catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/', auth_1.authenticateToken, createProductValidation, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
            return;
        }
        const { name, description, brand, category, market_price, image_url, is_active = true } = req.body;
        const [product] = await (0, database_1.db)('products')
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
    }
    catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.put('/:id', auth_1.authenticateToken, createProductValidation, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
            return;
        }
        const { id } = req.params;
        const { name, description, brand, category, market_price, image_url, is_active } = req.body;
        const existingProduct = await (0, database_1.db)('products').where({ id }).first();
        if (!existingProduct) {
            res.status(404).json({
                success: false,
                error: 'Product not found'
            });
            return;
        }
        const activeAuctions = await (0, database_1.db)('auctions')
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
        const [updatedProduct] = await (0, database_1.db)('products')
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
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await (0, database_1.db)('products').where({ id }).first();
        if (!product) {
            res.status(404).json({
                success: false,
                error: 'Product not found'
            });
            return;
        }
        const activeAuctions = await (0, database_1.db)('auctions')
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
        await (0, database_1.db)('products')
            .where({ id })
            .update({
            is_active: false,
            updated_at: new Date()
        });
        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/categories/list', async (req, res) => {
    try {
        const categories = await (0, database_1.db)('products')
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
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map