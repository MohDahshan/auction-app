"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const config_1 = require("../config");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const registerValidation = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    (0, express_validator_1.body)('phone').optional().isMobilePhone('any')
];
const loginValidation = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required')
];
const generateTokens = (userId) => {
    const access_token = jsonwebtoken_1.default.sign({ userId }, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.expiresIn
    });
    const refresh_token = jsonwebtoken_1.default.sign({ userId }, config_1.config.jwt.refreshSecret, {
        expiresIn: config_1.config.jwt.refreshExpiresIn
    });
    return {
        access_token,
        refresh_token,
        expires_in: 24 * 60 * 60
    };
};
router.post('/register', registerValidation, async (req, res) => {
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
        const { email, password, name, phone } = req.body;
        const existingUser = await (0, database_1.db)('users').where({ email }).first();
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
            return;
        }
        const password_hash = await bcryptjs_1.default.hash(password, config_1.config.bcrypt.rounds);
        const [user] = await (0, database_1.db)('users')
            .insert({
            email,
            password_hash,
            name,
            phone,
            wallet_balance: 500
        })
            .returning('*');
        const tokens = generateTokens(user.id);
        const { password_hash: _, ...userResponse } = user;
        res.status(201).json({
            success: true,
            data: {
                user: userResponse,
                tokens
            },
            message: 'User registered successfully'
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/login', loginValidation, async (req, res) => {
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
        const { email, password } = req.body;
        const user = await (0, database_1.db)('users').where({ email, is_active: true }).first();
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
            return;
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isValidPassword) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
            return;
        }
        await (0, database_1.db)('users')
            .where({ id: user.id })
            .update({ last_login_at: new Date() });
        const tokens = generateTokens(user.id);
        const { password_hash: _, ...userResponse } = user;
        res.json({
            success: true,
            data: {
                user: userResponse,
                tokens
            },
            message: 'Login successful'
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: req.user
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            res.status(401).json({
                success: false,
                error: 'Refresh token required'
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(refresh_token, config_1.config.jwt.refreshSecret);
        const user = await (0, database_1.db)('users')
            .where({ id: decoded.userId, is_active: true })
            .first();
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
            return;
        }
        const tokens = generateTokens(user.id);
        res.json({
            success: true,
            data: { tokens },
            message: 'Tokens refreshed successfully'
        });
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
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
router.post('/logout', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map