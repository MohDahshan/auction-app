"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const database_1 = require("../config/database");
class SocketService {
    constructor(server) {
        this.connectedUsers = new Map();
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: config_1.config.socket.corsOrigin,
                methods: ['GET', 'POST'],
                credentials: true
            }
        });
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication token required'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
                const user = await (0, database_1.db)('users')
                    .where({ id: decoded.userId, is_active: true })
                    .first();
                if (!user) {
                    return next(new Error('Invalid token or user not found'));
                }
                const { password_hash, ...userWithoutPassword } = user;
                socket.user = userWithoutPassword;
                next();
            }
            catch (error) {
                next(new Error('Authentication failed'));
            }
        });
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User ${socket.user.name} connected with socket ${socket.id}`);
            this.connectedUsers.set(socket.user.id, socket.id);
            socket.on('auction:join', async (data) => {
                try {
                    const { auctionId } = data;
                    const auction = await (0, database_1.db)('auctions')
                        .where({ id: auctionId, status: 'live' })
                        .first();
                    if (!auction) {
                        socket.emit('error', { message: 'Auction not found or not live' });
                        return;
                    }
                    socket.join(`auction:${auctionId}`);
                    const auctionData = await this.getAuctionData(auctionId);
                    socket.emit('auction:joined', auctionData);
                    console.log(`User ${socket.user.name} joined auction ${auctionId}`);
                }
                catch (error) {
                    console.error('Join auction error:', error);
                    socket.emit('error', { message: 'Failed to join auction' });
                }
            });
            socket.on('auction:leave', (data) => {
                const { auctionId } = data;
                socket.leave(`auction:${auctionId}`);
                console.log(`User ${socket.user.name} left auction ${auctionId}`);
            });
            socket.on('auction:bid', async (data) => {
                try {
                    const { auctionId, amount } = data;
                    const userId = socket.user.id;
                    const auction = await (0, database_1.db)('auctions')
                        .where({ id: auctionId, status: 'live' })
                        .first();
                    if (!auction) {
                        socket.emit('bid:error', { message: 'Auction not found or not live' });
                        return;
                    }
                    if (new Date() > new Date(auction.end_time)) {
                        socket.emit('bid:error', { message: 'Auction has ended' });
                        return;
                    }
                    const existingBid = await (0, database_1.db)('bids')
                        .where({ auction_id: auctionId, user_id: userId })
                        .first();
                    if (!existingBid) {
                        socket.emit('bid:error', { message: 'Must join auction before bidding' });
                        return;
                    }
                    const highestBid = await (0, database_1.db)('bids')
                        .where('auction_id', auctionId)
                        .max('amount as highest_bid')
                        .first();
                    const currentHighest = highestBid?.highest_bid || auction.starting_bid;
                    if (amount <= currentHighest) {
                        socket.emit('bid:error', {
                            message: `Bid must be higher than current highest bid of ${currentHighest}`
                        });
                        return;
                    }
                    const user = await (0, database_1.db)('users').where({ id: userId }).first();
                    if (user.wallet_balance < amount) {
                        socket.emit('bid:error', { message: 'Insufficient wallet balance' });
                        return;
                    }
                    await database_1.db.transaction(async (trx) => {
                        if (existingBid.amount > 0) {
                            await trx('users')
                                .where({ id: userId })
                                .increment('wallet_balance', existingBid.amount);
                            await trx('transactions').insert({
                                user_id: userId,
                                auction_id: auctionId,
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
                            .where({ auction_id: auctionId, user_id: userId })
                            .update({
                            amount,
                            bid_time: new Date(),
                            is_winning: true
                        });
                        await trx('bids')
                            .where('auction_id', auctionId)
                            .whereNot('user_id', userId)
                            .update({ is_winning: false });
                        await trx('transactions').insert({
                            user_id: userId,
                            auction_id: auctionId,
                            type: 'bid',
                            amount: -amount,
                            description: `Bid placed in auction: ${auction.title}`,
                            status: 'completed'
                        });
                        await trx('auctions')
                            .where({ id: auctionId })
                            .increment('total_bids', 1);
                    });
                    const updatedBid = await (0, database_1.db)('bids')
                        .select([
                        'bids.*',
                        'users.name as user_name'
                    ])
                        .leftJoin('users', 'bids.user_id', 'users.id')
                        .where({ auction_id: auctionId, user_id: userId })
                        .first();
                    this.io.to(`auction:${auctionId}`).emit('auction:new_bid', {
                        bid: updatedBid,
                        auction: await this.getAuctionData(auctionId)
                    });
                    await this.notifyOutbidUsers(auctionId, userId, amount);
                    console.log(`Bid placed: ${socket.user.name} bid ${amount} on auction ${auctionId}`);
                }
                catch (error) {
                    console.error('Bid placement error:', error);
                    socket.emit('bid:error', { message: 'Failed to place bid' });
                }
            });
            socket.on('disconnect', () => {
                this.connectedUsers.delete(socket.user.id);
                console.log(`User ${socket.user.name} disconnected`);
            });
        });
    }
    async getAuctionData(auctionId) {
        const auction = await (0, database_1.db)('auctions')
            .select([
            'auctions.*',
            'products.name as product_name',
            'products.image_url as product_image',
            'products.market_price',
            'products.category'
        ])
            .leftJoin('products', 'auctions.product_id', 'products.id')
            .where('auctions.id', auctionId)
            .first();
        const highestBid = await (0, database_1.db)('bids')
            .where('auction_id', auctionId)
            .max('amount as highest_bid')
            .first();
        const bids = await (0, database_1.db)('bids')
            .select([
            'bids.*',
            'users.name as user_name'
        ])
            .leftJoin('users', 'bids.user_id', 'users.id')
            .where('auction_id', auctionId)
            .orderBy('amount', 'desc')
            .limit(10);
        return {
            ...auction,
            current_bid: highestBid?.highest_bid || auction.starting_bid,
            bids
        };
    }
    async notifyOutbidUsers(auctionId, newBidderId, newBidAmount) {
        try {
            const outbidUsers = await (0, database_1.db)('bids')
                .select(['user_id', 'users.name'])
                .leftJoin('users', 'bids.user_id', 'users.id')
                .where({
                auction_id: auctionId,
                is_winning: false
            })
                .whereNot('user_id', newBidderId);
            for (const user of outbidUsers) {
                const socketId = this.connectedUsers.get(user.user_id);
                if (socketId) {
                    this.io.to(socketId).emit('user:outbid', {
                        auctionId,
                        newBidAmount,
                        message: 'You have been outbid!'
                    });
                }
            }
        }
        catch (error) {
            console.error('Error notifying outbid users:', error);
        }
    }
    async endAuction(auctionId) {
        try {
            const auction = await (0, database_1.db)('auctions')
                .where({ id: auctionId })
                .first();
            if (!auction)
                return;
            const winningBid = await (0, database_1.db)('bids')
                .select([
                'bids.*',
                'users.name as user_name'
            ])
                .leftJoin('users', 'bids.user_id', 'users.id')
                .where('auction_id', auctionId)
                .orderBy('amount', 'desc')
                .first();
            await (0, database_1.db)('auctions')
                .where({ id: auctionId })
                .update({
                status: 'ended',
                winner_id: winningBid?.user_id,
                final_bid: winningBid?.amount
            });
            this.io.to(`auction:${auctionId}`).emit('auction:ended', {
                auction: await this.getAuctionData(auctionId),
                winner: winningBid
            });
            console.log(`Auction ${auctionId} ended. Winner: ${winningBid?.user_name || 'None'}`);
        }
        catch (error) {
            console.error('Error ending auction:', error);
        }
    }
    getIO() {
        return this.io;
    }
}
exports.SocketService = SocketService;
//# sourceMappingURL=socketService.js.map