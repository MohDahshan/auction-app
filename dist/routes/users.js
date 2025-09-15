"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search;
        const offset = (page - 1) * limit;
        let query = (0, database_1.db)('users').select('*');
        let countQuery = (0, database_1.db)('users');
        if (search) {
            query = query.where(function () {
                this.where('name', 'ilike', `%${search}%`)
                    .orWhere('email', 'ilike', `%${search}%`);
            });
            countQuery = countQuery.where(function () {
                this.where('name', 'ilike', `%${search}%`)
                    .orWhere('email', 'ilike', `%${search}%`);
            });
        }
        const totalResult = await countQuery.count('* as count').first();
        const total = parseInt(totalResult?.count) || 0;
        const pages = Math.ceil(total / limit);
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
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await (0, database_1.db)('users')
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
    }
    catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        });
    }
});
router.post('/', async (req, res) => {
    try {
        const { email, name, phone, password } = req.body;
        if (!email || !name || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email, name, and password are required'
            });
        }
        const existingUser = await (0, database_1.db)('users').where('email', email).first();
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }
        const [newUser] = await (0, database_1.db)('users')
            .insert({
            email,
            name,
            phone,
            password_hash: password,
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
    }
    catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create user'
        });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, phone, wallet_balance, is_active } = req.body;
        const updateData = {};
        if (email !== undefined)
            updateData.email = email;
        if (name !== undefined)
            updateData.name = name;
        if (phone !== undefined)
            updateData.phone = phone;
        if (wallet_balance !== undefined)
            updateData.wallet_balance = wallet_balance;
        if (is_active !== undefined)
            updateData.is_active = is_active;
        const [updatedUser] = await (0, database_1.db)('users')
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
    }
    catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update user'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCount = await (0, database_1.db)('users').where('id', id).del();
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
    }
    catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete user'
        });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map