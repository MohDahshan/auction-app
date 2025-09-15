"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const bidValidation = [
    (0, express_validator_1.body)('amount').isInt({ min: 1 }).withMessage('Bid amount must be a positive integer')
];
const createAuctionValidation = [
    (0, express_validator_1.body)('product_id').isUUID().withMessage('Product ID must be a valid UUID'),
    (0, express_validator_1.body)('title').isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
    (0, express_validator_1.body)('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    (0, express_validator_1.body)('entry_fee').isInt({ min: 1 }).withMessage('Entry fee must be a positive integer'),
    (0, express_validator_1.body)('min_wallet').isInt({ min: 0 }).withMessage('Minimum wallet must be a non-negative integer'),
    (0, express_validator_1.body)('starting_bid').isInt({ min: 1 }).withMessage('Starting bid must be a positive integer'),
    (0, express_validator_1.body)('start_time').isISO8601().withMessage('Start time must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('end_time').isISO8601().withMessage('End time must be a valid ISO 8601 date')
];
const auctionFilters = [
    (0, express_validator_1.query)('status').optional().isIn(['upcoming', 'live', 'ended']),
    (0, express_validator_1.query)('category').optional().isString(),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 })
];
router.get('/', auctionFilters, auth_1.optionalAuth, async (req, res) => {
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
        const { status, category, page = 1, limit = 20 } = req.query;
        let query = (0, database_1.db)('auctions')
            .select([
            'auctions.*',
            'products.name as product_name',
            'products.image_url as product_image',
            'products.market_price',
            'products.category',
            'users.name as winner_name'
        ])
            .leftJoin('products', 'auctions.product_id', 'products.id')
            .leftJoin('users', 'auctions.winner_id', 'users.id')
            .orderBy('auctions.created_at', 'desc');
        if (status) {
            query = query.where('auctions.status', status);
        }
        if (category) {
            query = query.where('products.category', category);
        }
        const totalQuery = (0, database_1.db)('auctions')
            .leftJoin('products', 'auctions.product_id', 'products.id')
            .count('* as count');
        if (status) {
            totalQuery.where('auctions.status', status);
        }
        if (category) {
            totalQuery.where('products.category', category);
        }
        const [{ count: total }] = await totalQuery;
        const totalCount = parseInt(total, 10);
        const offset = (page - 1) * limit;
        const auctions = await query.limit(limit).offset(offset);
        const auctionIds = auctions.map(auction => auction.id);
        const highestBids = await (0, database_1.db)('bids')
            .select('auction_id')
            .max('amount as highest_bid')
            .whereIn('auction_id', auctionIds)
            .groupBy('auction_id');
        const bidMap = highestBids.reduce((acc, bid) => {
            acc[bid.auction_id] = bid.highest_bid;
            return acc;
        }, {});
        const auctionsWithBids = auctions.map(auction => ({
            ...auction,
            current_bid: bidMap[auction.id] || auction.starting_bid,
            product: {
                name: auction.product_name,
                image_url: auction.product_image,
                market_price: auction.market_price,
                category: auction.category
            }
        }));
        res.json({
            success: true,
            data: auctionsWithBids,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });
    }
    catch (error) {
        console.error('Get auctions error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/', auth_1.authenticateToken, createAuctionValidation, async (req, res) => {
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
        const { product_id, title, description, entry_fee, min_wallet, starting_bid, start_time, end_time } = req.body;
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);
        const now = new Date();
        if (startDate <= now) {
            res.status(400).json({
                success: false,
                error: 'Start time must be in the future'
            });
            return;
        }
        if (endDate <= startDate) {
            res.status(400).json({
                success: false,
                error: 'End time must be after start time'
            });
            return;
        }
        const product = await (0, database_1.db)('products')
            .where({ id: product_id, is_active: true })
            .first();
        if (!product) {
            res.status(404).json({
                success: false,
                error: 'Product not found or inactive'
            });
            return;
        }
        const [auction] = await (0, database_1.db)('auctions')
            .insert({
            product_id,
            title,
            description,
            entry_fee,
            min_wallet,
            starting_bid,
            start_time: startDate,
            end_time: endDate,
            status: 'upcoming'
        })
            .returning('*');
        const auctionWithProduct = await (0, database_1.db)('auctions')
            .select([
            'auctions.*',
            'products.name as product_name',
            'products.image_url as product_image',
            'products.market_price',
            'products.category',
            'products.brand'
        ])
            .leftJoin('products', 'auctions.product_id', 'products.id')
            .where('auctions.id', auction.id)
            .first();
        res.status(201).json({
            success: true,
            data: {
                ...auctionWithProduct,
                product: {
                    name: auctionWithProduct.product_name,
                    image_url: auctionWithProduct.product_image,
                    market_price: auctionWithProduct.market_price,
                    category: auctionWithProduct.category,
                    brand: auctionWithProduct.brand
                }
            },
            message: 'Auction created successfully'
        });
    }
    catch (error) {
        console.error('Create auction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const auction = await (0, database_1.db)('auctions')
            .select([
            'auctions.*',
            'products.name as product_name',
            'products.description as product_description',
            'products.image_url as product_image',
            'products.market_price',
            'products.category',
            'products.brand',
            'users.name as winner_name'
        ])
            .leftJoin('products', 'auctions.product_id', 'products.id')
            .leftJoin('users', 'auctions.winner_id', 'users.id')
            .where('auctions.id', id)
            .first();
        if (!auction) {
            res.status(404).json({
                success: false,
                error: 'Auction not found'
            });
            return;
        }
        const highestBid = await (0, database_1.db)('bids')
            .where('auction_id', id)
            .max('amount as highest_bid')
            .first();
        const bids = await (0, database_1.db)('bids')
            .select([
            'bids.*',
            'users.name as user_name'
        ])
            .leftJoin('users', 'bids.user_id', 'users.id')
            .where('auction_id', id)
            .orderBy('amount', 'desc')
            .limit(10);
        let userBid = null;
        if (req.user) {
            userBid = await (0, database_1.db)('bids')
                .where({
                auction_id: id,
                user_id: req.user.id
            })
                .first();
        }
        const auctionWithDetails = {
            ...auction,
            current_bid: highestBid?.highest_bid || auction.starting_bid,
            product: {
                name: auction.product_name,
                description: auction.product_description,
                image_url: auction.product_image,
                market_price: auction.market_price,
                category: auction.category,
                brand: auction.brand
            },
            bids,
            user_bid: userBid
        };
        res.json({
            success: true,
            data: auctionWithDetails
        });
    }
    catch (error) {
        console.error('Get auction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/:id/join', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const auction = await (0, database_1.db)('auctions')
            .where({ id, status: 'live' })
            .first();
        if (!auction) {
            res.status(404).json({
                success: false,
                error: 'Auction not found or not live'
            });
            return;
        }
        const user = await (0, database_1.db)('users').where({ id: userId }).first();
        if (user.wallet_balance < auction.entry_fee) {
            res.status(400).json({
                success: false,
                error: 'Insufficient wallet balance'
            });
            return;
        }
        const existingBid = await (0, database_1.db)('bids')
            .where({ auction_id: id, user_id: userId })
            .first();
        if (existingBid) {
            res.status(400).json({
                success: false,
                error: 'Already participating in this auction'
            });
            return;
        }
        await database_1.db.transaction(async (trx) => {
            await trx('users')
                .where({ id: userId })
                .decrement('wallet_balance', auction.entry_fee);
            await trx('transactions').insert({
                user_id: userId,
                auction_id: id,
                type: 'entry_fee',
                amount: -auction.entry_fee,
                description: `Entry fee for auction: ${auction.title}`,
                status: 'completed'
            });
            await trx('auctions')
                .where({ id })
                .increment('total_participants', 1);
        });
        res.json({
            success: true,
            message: 'Successfully joined auction'
        });
    }
    catch (error) {
        console.error('Join auction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.post('/:id/bid', auth_1.authenticateToken, bidValidation, async (req, res) => {
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
        const { amount } = req.body;
        const userId = req.user.id;
        const auction = await (0, database_1.db)('auctions')
            .where({ id, status: 'live' })
            .first();
        if (!auction) {
            res.status(404).json({
                success: false,
                error: 'Auction not found or not live'
            });
            return;
        }
        if (new Date() > new Date(auction.end_time)) {
            res.status(400).json({
                success: false,
                error: 'Auction has ended'
            });
            return;
        }
        const existingBid = await (0, database_1.db)('bids')
            .where({ auction_id: id, user_id: userId })
            .first();
        if (!existingBid) {
            res.status(400).json({
                success: false,
                error: 'Must join auction before bidding'
            });
            return;
        }
        const highestBid = await (0, database_1.db)('bids')
            .where('auction_id', id)
            .max('amount as highest_bid')
            .first();
        const currentHighest = highestBid?.highest_bid || auction.starting_bid;
        if (amount <= currentHighest) {
            res.status(400).json({
                success: false,
                error: `Bid must be higher than current highest bid of ${currentHighest}`
            });
            return;
        }
        const user = await (0, database_1.db)('users').where({ id: userId }).first();
        if (user.wallet_balance < amount) {
            res.status(400).json({
                success: false,
                error: 'Insufficient wallet balance'
            });
            return;
        }
        await database_1.db.transaction(async (trx) => {
            if (existingBid.amount > 0) {
                await trx('users')
                    .where({ id: userId })
                    .increment('wallet_balance', existingBid.amount);
                await trx('transactions').insert({
                    user_id: userId,
                    auction_id: id,
                    type: 'refund',
                    amount: existingBid.amount,
                    description: `Refund for previous bid in auction: ${auction.title}`,
                    status: 'completed'
                });
            }
            await trx('users')
                .where({ id: userId })
                .decrement('wallet_balance', amount);
            await trx('bids')
                .where({ auction_id: id, user_id: userId })
                .update({
                amount,
                bid_time: new Date(),
                is_winning: true
            });
            await trx('bids')
                .where('auction_id', id)
                .whereNot('user_id', userId)
                .update({ is_winning: false });
            await trx('transactions').insert({
                user_id: userId,
                auction_id: id,
                type: 'bid',
                amount: -amount,
                description: `Bid placed in auction: ${auction.title}`,
                status: 'completed'
            });
            await trx('auctions')
                .where({ id })
                .increment('total_bids', 1);
        });
        const updatedBid = await (0, database_1.db)('bids')
            .select([
            'bids.*',
            'users.name as user_name'
        ])
            .leftJoin('users', 'bids.user_id', 'users.id')
            .where({ auction_id: id, user_id: userId })
            .first();
        res.json({
            success: true,
            data: updatedBid,
            message: 'Bid placed successfully'
        });
    }
    catch (error) {
        console.error('Place bid error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.put('/:id', auth_1.authenticateToken, createAuctionValidation, async (req, res) => {
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
        const { product_id, title, description, entry_fee, min_wallet, starting_bid, start_time, end_time } = req.body;
        const existingAuction = await (0, database_1.db)('auctions').where({ id }).first();
        if (!existingAuction) {
            res.status(404).json({
                success: false,
                error: 'Auction not found'
            });
            return;
        }
        if (existingAuction.status !== 'upcoming') {
            res.status(400).json({
                success: false,
                error: 'Cannot edit auction that is live or has ended'
            });
            return;
        }
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);
        const now = new Date();
        if (startDate <= now) {
            res.status(400).json({
                success: false,
                error: 'Start time must be in the future'
            });
            return;
        }
        if (endDate <= startDate) {
            res.status(400).json({
                success: false,
                error: 'End time must be after start time'
            });
            return;
        }
        const product = await (0, database_1.db)('products')
            .where({ id: product_id, is_active: true })
            .first();
        if (!product) {
            res.status(404).json({
                success: false,
                error: 'Product not found or inactive'
            });
            return;
        }
        const [updatedAuction] = await (0, database_1.db)('auctions')
            .where({ id })
            .update({
            product_id,
            title,
            description,
            entry_fee,
            min_wallet,
            starting_bid,
            start_time: startDate,
            end_time: endDate,
            updated_at: new Date()
        })
            .returning('*');
        const auctionWithProduct = await (0, database_1.db)('auctions')
            .select([
            'auctions.*',
            'products.name as product_name',
            'products.image_url as product_image',
            'products.market_price',
            'products.category',
            'products.brand'
        ])
            .leftJoin('products', 'auctions.product_id', 'products.id')
            .where('auctions.id', id)
            .first();
        res.json({
            success: true,
            data: {
                ...auctionWithProduct,
                product: {
                    name: auctionWithProduct.product_name,
                    image_url: auctionWithProduct.product_image,
                    market_price: auctionWithProduct.market_price,
                    category: auctionWithProduct.category,
                    brand: auctionWithProduct.brand
                }
            },
            message: 'Auction updated successfully'
        });
    }
    catch (error) {
        console.error('Update auction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const auction = await (0, database_1.db)('auctions').where({ id }).first();
        if (!auction) {
            res.status(404).json({
                success: false,
                error: 'Auction not found'
            });
            return;
        }
        if (auction.status === 'live') {
            res.status(400).json({
                success: false,
                error: 'Cannot delete live auction'
            });
            return;
        }
        await database_1.db.transaction(async (trx) => {
            if (auction.total_participants > 0) {
                const participants = await trx('bids')
                    .select('user_id')
                    .where('auction_id', id)
                    .groupBy('user_id');
                for (const participant of participants) {
                    await trx('users')
                        .where({ id: participant.user_id })
                        .increment('wallet_balance', auction.entry_fee);
                    await trx('transactions').insert({
                        user_id: participant.user_id,
                        auction_id: id,
                        type: 'refund',
                        amount: auction.entry_fee,
                        description: `Refund for cancelled auction: ${auction.title}`,
                        status: 'completed'
                    });
                }
                const activeBids = await trx('bids')
                    .where({ auction_id: id })
                    .where('amount', '>', 0);
                for (const bid of activeBids) {
                    await trx('users')
                        .where({ id: bid.user_id })
                        .increment('wallet_balance', bid.amount);
                    await trx('transactions').insert({
                        user_id: bid.user_id,
                        auction_id: id,
                        type: 'refund',
                        amount: bid.amount,
                        description: `Bid refund for cancelled auction: ${auction.title}`,
                        status: 'completed'
                    });
                }
            }
            await trx('bids').where('auction_id', id).del();
            await trx('auctions').where({ id }).del();
        });
        res.json({
            success: true,
            message: 'Auction deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete auction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/:id/bids', async (req, res) => {
    try {
        const { id } = req.params;
        const bids = await (0, database_1.db)('bids')
            .select([
            'bids.*',
            'users.name as user_name'
        ])
            .leftJoin('users', 'bids.user_id', 'users.id')
            .where('auction_id', id)
            .orderBy('amount', 'desc');
        res.json({
            success: true,
            data: bids
        });
    }
    catch (error) {
        console.error('Get bids error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auctions.js.map