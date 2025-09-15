"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const user = await (0, database_1.db)('users').where({ email }).first();
        if (!user) {
            res.json({
                success: false,
                message: 'User not found',
                email
            });
            return;
        }
        const testPassword = 'admin123';
        const isValidPassword = await bcryptjs_1.default.compare(testPassword, user.password_hash);
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
    }
    catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/test-hash/:password', async (req, res) => {
    try {
        const { password } = req.params;
        const hash = await bcryptjs_1.default.hash(password, 12);
        const isValid = await bcryptjs_1.default.compare(password, hash);
        res.json({
            password,
            hash,
            is_valid: isValid
        });
    }
    catch (error) {
        console.error('Hash test error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/update-password/:email', async (req, res) => {
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
        const password_hash = await bcryptjs_1.default.hash(password, 12);
        const updated = await (0, database_1.db)('users')
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
        const isValid = await bcryptjs_1.default.compare(password, password_hash);
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
    }
    catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=debug.js.map