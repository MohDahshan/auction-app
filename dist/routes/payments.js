"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("../config");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const stripe = new stripe_1.default(config_1.config.stripe.secretKey, {
    apiVersion: '2023-10-16'
});
const paymentValidation = [
    (0, express_validator_1.body)('amount').isInt({ min: 100 }).withMessage('Amount must be at least 100 coins'),
    (0, express_validator_1.body)('currency').optional().isIn(['usd', 'eur', 'sar']).withMessage('Invalid currency')
];
router.post('/create-intent', auth_1.authenticateToken, paymentValidation, async (req, res) => {
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
        const { amount, currency = 'usd' } = req.body;
        const userId = req.user.id;
        const priceInCents = Math.round(amount * 10);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: priceInCents,
            currency,
            metadata: {
                userId,
                coinAmount: amount.toString(),
                type: 'coin_purchase'
            },
            automatic_payment_methods: {
                enabled: true
            }
        });
        await (0, database_1.db)('transactions').insert({
            user_id: userId,
            type: 'purchase',
            amount,
            description: `Purchase ${amount} coins`,
            status: 'pending',
            stripe_payment_intent_id: paymentIntent.id,
            metadata: {
                currency,
                price_in_cents: priceInCents
            }
        });
        res.json({
            success: true,
            data: {
                client_secret: paymentIntent.client_secret,
                payment_intent_id: paymentIntent.id,
                amount: priceInCents,
                currency
            }
        });
    }
    catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create payment intent'
        });
    }
});
router.post('/confirm', auth_1.authenticateToken, async (req, res) => {
    try {
        const { payment_intent_id } = req.body;
        const userId = req.user.id;
        if (!payment_intent_id) {
            res.status(400).json({
                success: false,
                error: 'Payment intent ID is required'
            });
            return;
        }
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        if (paymentIntent.status !== 'succeeded') {
            res.status(400).json({
                success: false,
                error: 'Payment not completed'
            });
            return;
        }
        if (paymentIntent.metadata.userId !== userId) {
            res.status(403).json({
                success: false,
                error: 'Unauthorized payment confirmation'
            });
            return;
        }
        const existingTransaction = await (0, database_1.db)('transactions')
            .where({
            stripe_payment_intent_id: payment_intent_id,
            status: 'completed'
        })
            .first();
        if (existingTransaction) {
            res.status(400).json({
                success: false,
                error: 'Payment already processed'
            });
            return;
        }
        const coinAmount = parseInt(paymentIntent.metadata.coinAmount, 10);
        await database_1.db.transaction(async (trx) => {
            await trx('users')
                .where({ id: userId })
                .increment('wallet_balance', coinAmount);
            await trx('transactions')
                .where({ stripe_payment_intent_id: payment_intent_id })
                .update({
                status: 'completed',
                updated_at: new Date()
            });
        });
        const updatedUser = await (0, database_1.db)('users')
            .select(['id', 'name', 'email', 'wallet_balance'])
            .where({ id: userId })
            .first();
        res.json({
            success: true,
            data: {
                coins_added: coinAmount,
                new_balance: updatedUser.wallet_balance
            },
            message: `Successfully added ${coinAmount} coins to your wallet`
        });
    }
    catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to confirm payment'
        });
    }
});
router.get('/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const transactions = await (0, database_1.db)('transactions')
            .select([
            'id',
            'type',
            'amount',
            'description',
            'status',
            'created_at'
        ])
            .where({ user_id: userId })
            .orderBy('created_at', 'desc')
            .limit(Number(limit))
            .offset(offset);
        const [{ count: total }] = await (0, database_1.db)('transactions')
            .where({ user_id: userId })
            .count('* as count');
        res.json({
            success: true,
            data: transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: parseInt(total, 10),
                pages: Math.ceil(parseInt(total, 10) / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment history'
        });
    }
});
router.post('/webhook', async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, config_1.config.stripe.webhookSecret);
        }
        catch (err) {
            console.error('Webhook signature verification failed:', err);
            res.status(400).send('Webhook signature verification failed');
            return;
        }
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                console.log('Payment succeeded:', paymentIntent.id);
                await (0, database_1.db)('transactions')
                    .where({
                    stripe_payment_intent_id: paymentIntent.id,
                    status: 'pending'
                })
                    .update({
                    status: 'completed',
                    updated_at: new Date()
                });
                break;
            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                console.log('Payment failed:', failedPayment.id);
                await (0, database_1.db)('transactions')
                    .where({
                    stripe_payment_intent_id: failedPayment.id,
                    status: 'pending'
                })
                    .update({
                    status: 'failed',
                    updated_at: new Date()
                });
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
});
router.get('/packages', async (req, res) => {
    try {
        const packages = [
            {
                id: 'starter',
                name: 'Starter Pack',
                coins: 100,
                price: 10.00,
                currency: 'usd',
                popular: false
            },
            {
                id: 'popular',
                name: 'Popular Pack',
                coins: 500,
                price: 45.00,
                currency: 'usd',
                popular: true,
                bonus: 50
            },
            {
                id: 'premium',
                name: 'Premium Pack',
                coins: 1000,
                price: 80.00,
                currency: 'usd',
                popular: false,
                bonus: 200
            },
            {
                id: 'ultimate',
                name: 'Ultimate Pack',
                coins: 2500,
                price: 180.00,
                currency: 'usd',
                popular: false,
                bonus: 750
            }
        ];
        res.json({
            success: true,
            data: packages
        });
    }
    catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get coin packages'
        });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map