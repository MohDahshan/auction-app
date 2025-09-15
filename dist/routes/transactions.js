"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const transactionFilters = [
    (0, express_validator_1.query)('type').optional().isIn(['entry_fee', 'bid', 'refund', 'deposit', 'withdrawal']),
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'completed', 'failed']),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('user_id').optional().isUUID()
];
const createTransactionValidation = [
    (0, express_validator_1.body)('user_id').isUUID().withMessage('User ID must be a valid UUID'),
    (0, express_validator_1.body)('type').isIn(['entry_fee', 'bid', 'refund', 'deposit', 'withdrawal']).withMessage('Invalid transaction type'),
    (0, express_validator_1.body)('amount').isInt().withMessage('Amount must be an integer'),
    (0, express_validator_1.body)('description').isLength({ min: 3, max: 500 }).withMessage('Description must be between 3 and 500 characters'),
    (0, express_validator_1.body)('status').optional().isIn(['pending', 'completed', 'failed']).withMessage('Invalid status'),
    (0, express_validator_1.body)('auction_id').optional().isUUID().withMessage('Auction ID must be a valid UUID')
];
router.get('/', transactionFilters, auth_1.authenticateToken, async (req, res) => {
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
        const { type, status, user_id, page = 1, limit = 20 } = req.query;
        let query = (0, database_1.db)('transactions')
            .select([
            'transactions.*',
            'users.name as user_name',
            'users.email as user_email',
            'auctions.title as auction_title'
        ])
            .leftJoin('users', 'transactions.user_id', 'users.id')
            .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
            .orderBy('transactions.created_at', 'desc');
        if (type) {
            query = query.where('transactions.type', type);
        }
        if (status) {
            query = query.where('transactions.status', status);
        }
        if (user_id) {
            query = query.where('transactions.user_id', user_id);
        }
        const totalQuery = (0, database_1.db)('transactions').count('* as count');
        if (type) {
            totalQuery.where('type', type);
        }
        if (status) {
            totalQuery.where('status', status);
        }
        if (user_id) {
            totalQuery.where('user_id', user_id);
        }
        const [{ count: total }] = await totalQuery;
        const totalCount = parseInt(total, 10);
        const offset = (Number(page) - 1) * Number(limit);
        const transactions = await query.limit(Number(limit)).offset(offset);
        res.json({
            success: true,
            data: transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await (0, database_1.db)('transactions')
            .select([
            'transactions.*',
            'users.name as user_name',
            'users.email as user_email',
            'auctions.title as auction_title'
        ])
            .leftJoin('users', 'transactions.user_id', 'users.id')
            .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
            .where('transactions.id', id)
            .first();
        if (!transaction) {
            res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
            return;
        }
        res.json({
            success: true,
            data: transaction
        });
    }
    catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/', auth_1.authenticateToken, createTransactionValidation, async (req, res) => {
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
        const { user_id, type, amount, description, status = 'completed', auction_id } = req.body;
        const user = await (0, database_1.db)('users').where({ id: user_id }).first();
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        if (auction_id) {
            const auction = await (0, database_1.db)('auctions').where({ id: auction_id }).first();
            if (!auction) {
                res.status(404).json({
                    success: false,
                    error: 'Auction not found'
                });
                return;
            }
        }
        await database_1.db.transaction(async (trx) => {
            const [transaction] = await trx('transactions')
                .insert({
                user_id,
                auction_id,
                type,
                amount,
                description,
                status
            })
                .returning('*');
            if (status === 'completed' && ['deposit', 'withdrawal', 'refund'].includes(type)) {
                if (type === 'deposit' || type === 'refund') {
                    await trx('users')
                        .where({ id: user_id })
                        .increment('wallet_balance', Math.abs(amount));
                }
                else if (type === 'withdrawal') {
                    const currentUser = await trx('users').where({ id: user_id }).first();
                    if (currentUser.wallet_balance < Math.abs(amount)) {
                        throw new Error('Insufficient wallet balance');
                    }
                    await trx('users')
                        .where({ id: user_id })
                        .decrement('wallet_balance', Math.abs(amount));
                }
            }
            const transactionWithDetails = await trx('transactions')
                .select([
                'transactions.*',
                'users.name as user_name',
                'users.email as user_email',
                'auctions.title as auction_title'
            ])
                .leftJoin('users', 'transactions.user_id', 'users.id')
                .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
                .where('transactions.id', transaction.id)
                .first();
            res.status(201).json({
                success: true,
                data: transactionWithDetails,
                message: 'Transaction created successfully'
            });
        });
    }
    catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});
router.put('/:id', auth_1.authenticateToken, createTransactionValidation, async (req, res) => {
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
        const { user_id, type, amount, description, status, auction_id } = req.body;
        const existingTransaction = await (0, database_1.db)('transactions').where({ id }).first();
        if (!existingTransaction) {
            res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
            return;
        }
        if (existingTransaction.status === 'completed' &&
            ['deposit', 'withdrawal', 'refund', 'bid', 'entry_fee'].includes(existingTransaction.type)) {
            res.status(400).json({
                success: false,
                error: 'Cannot edit completed financial transactions'
            });
            return;
        }
        const user = await (0, database_1.db)('users').where({ id: user_id }).first();
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        if (auction_id) {
            const auction = await (0, database_1.db)('auctions').where({ id: auction_id }).first();
            if (!auction) {
                res.status(404).json({
                    success: false,
                    error: 'Auction not found'
                });
                return;
            }
        }
        const [updatedTransaction] = await (0, database_1.db)('transactions')
            .where({ id })
            .update({
            user_id,
            auction_id,
            type,
            amount,
            description,
            status,
            updated_at: new Date()
        })
            .returning('*');
        const transactionWithDetails = await (0, database_1.db)('transactions')
            .select([
            'transactions.*',
            'users.name as user_name',
            'users.email as user_email',
            'auctions.title as auction_title'
        ])
            .leftJoin('users', 'transactions.user_id', 'users.id')
            .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
            .where('transactions.id', id)
            .first();
        res.json({
            success: true,
            data: transactionWithDetails,
            message: 'Transaction updated successfully'
        });
    }
    catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await (0, database_1.db)('transactions').where({ id }).first();
        if (!transaction) {
            res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
            return;
        }
        if (transaction.status === 'completed' &&
            ['deposit', 'withdrawal', 'refund', 'bid', 'entry_fee'].includes(transaction.type)) {
            res.status(400).json({
                success: false,
                error: 'Cannot delete completed financial transactions'
            });
            return;
        }
        await (0, database_1.db)('transactions').where({ id }).del();
        res.json({
            success: true,
            message: 'Transaction deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/stats/summary', auth_1.authenticateToken, async (req, res) => {
    try {
        const stats = await (0, database_1.db)('transactions')
            .select([
            database_1.db.raw('COUNT(*) as total_transactions'),
            database_1.db.raw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income'),
            database_1.db.raw('SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_outgoing'),
            database_1.db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_transactions'),
            database_1.db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_transactions'),
            database_1.db.raw('COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failed_transactions')
        ])
            .first();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Get transaction stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=transactions.js.map