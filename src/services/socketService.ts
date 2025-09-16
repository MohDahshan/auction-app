import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../config/database';
import { User } from '../types';
import { Socket } from "socket.io";

interface AuthenticatedSocket extends Socket {
  user?: User;
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.socket.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Allow guest connections for viewing auctions
        if (token === 'guest') {
          socket.user = {
            id: 'guest',
            name: 'Guest User',
            email: 'guest@example.com',
            is_guest: true
          };
          return next();
        }

        const decoded = jwt.verify(token, config.jwt.secret as string) as { userId: string };
        
        const user = await db('users')
          .where({ id: decoded.userId, is_active: true })
          .first();

        if (!user) {
          return next(new Error('Invalid token or user not found'));
        }

        const { password_hash, ...userWithoutPassword } = user;
        socket.user = userWithoutPassword;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: any) => {
      console.log(`User ${socket.user.name} connected with socket ${socket.id}`);
      
      // Store user connection
      this.connectedUsers.set(socket.user.id, socket.id);

      // Join auction room
      socket.on('auction:join', async (data: { auctionId: string }) => {
        try {
          const { auctionId } = data;
          
          // Verify auction exists and is live
          const auction = await db('auctions')
            .where({ id: auctionId, status: 'live' })
            .first();

          if (!auction) {
            socket.emit('error', { message: 'Auction not found or not live' });
            return;
          }

          // Join auction room
          socket.join(`auction:${auctionId}`);
          
          // Send current auction state
          const auctionData = await this.getAuctionData(auctionId);
          socket.emit('auction:joined', auctionData);
          
          console.log(`User ${socket.user.name} joined auction ${auctionId}`);
        } catch (error) {
          console.error('Join auction error:', error);
          socket.emit('error', { message: 'Failed to join auction' });
        }
      });

      // Leave auction room
      socket.on('auction:leave', (data: { auctionId: string }) => {
        const { auctionId } = data;
        socket.leave(`auction:${auctionId}`);
        console.log(`User ${socket.user.name} left auction ${auctionId}`);
      });

      // Handle bid placement
      socket.on('auction:bid', async (data: { auctionId: string; amount: number }) => {
        try {
          const { auctionId, amount } = data;
          const userId = socket.user.id;

          // Check if user is guest
          if (socket.user.is_guest) {
            socket.emit('bid:error', { message: 'Please login to place bids' });
            return;
          }

          // Validate bid (similar to REST API logic)
          const auction = await db('auctions')
            .where({ id: auctionId, status: 'live' })
            .first();

          if (!auction) {
            socket.emit('bid:error', { message: 'Auction not found or not live' });
            return;
          }

          // Check if auction has ended
          if (new Date() > new Date(auction.end_time)) {
            socket.emit('bid:error', { message: 'Auction has ended' });
            return;
          }

          // Check if user has joined the auction
          const existingBid = await db('bids')
            .where({ auction_id: auctionId, user_id: userId })
            .first();

          if (!existingBid) {
            socket.emit('bid:error', { message: 'Must join auction before bidding' });
            return;
          }

          // Get current highest bid
          const highestBid = await db('bids')
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

          // Check wallet balance
          const user = await db('users').where({ id: userId }).first();
          if (user.wallet_balance < amount) {
            socket.emit('bid:error', { message: 'Insufficient wallet balance' });
            return;
          }

          // Process bid in transaction
          await db.transaction(async (trx: any) => {
            // Refund previous bid if exists
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

            // Deduct new bid amount
            await trx('users')
              .where({ id: userId })
              .decrement('wallet_balance', amount);

            // Update bid record
            await trx('bids')
              .where({ auction_id: auctionId, user_id: userId })
              .update({
                amount,
                bid_time: new Date(),
                is_winning: true
              });

            // Mark other bids as not winning
            await trx('bids')
              .where('auction_id', auctionId)
              .whereNot('user_id', userId)
              .update({ is_winning: false });

            // Create transaction record
            await trx('transactions').insert({
              user_id: userId,
              auction_id: auctionId,
              type: 'bid',
              amount: -amount,
              description: `Bid placed in auction: ${auction.title}`,
              status: 'completed'
            });

            // Update auction stats
            await trx('auctions')
              .where({ id: auctionId })
              .increment('total_bids', 1);
          });

          // Get updated bid data
          const updatedBid = await db('bids')
            .select([
              'bids.*',
              'users.name as user_name'
            ])
            .leftJoin('users', 'bids.user_id', 'users.id')
            .where({ auction_id: auctionId, user_id: userId })
            .first();

          // Broadcast new bid to all users in auction room
          this.io.to(`auction:${auctionId}`).emit('auction:new_bid', {
            bid: updatedBid,
            auction: await this.getAuctionData(auctionId)
          });

          // Notify outbid users
          await this.notifyOutbidUsers(auctionId, userId, amount);

          console.log(`Bid placed: ${socket.user.name} bid ${amount} on auction ${auctionId}`);
        } catch (error) {
          console.error('Bid placement error:', error);
          socket.emit('bid:error', { message: 'Failed to place bid' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.connectedUsers.delete(socket.user.id);
        console.log(`User ${socket.user.name} disconnected`);
      });
    });
  }

  private async getAuctionData(auctionId: string): Promise<any> {
    const auction = await db('auctions')
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

    const highestBid = await db('bids')
      .where('auction_id', auctionId)
      .max('amount as highest_bid')
      .first();

    const bids = await db('bids')
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

  private async notifyOutbidUsers(auctionId: string, newBidderId: string, newBidAmount: number): Promise<void> {
    try {
      // Get all users who were previously winning but are now outbid
      const outbidUsers = await db('bids')
        .select(['user_id', 'users.name'])
        .leftJoin('users', 'bids.user_id', 'users.id')
        .where({
          auction_id: auctionId,
          is_winning: false
        })
        .whereNot('user_id', newBidderId);

      // Send outbid notifications
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
    } catch (error) {
      console.error('Error notifying outbid users:', error);
    }
  }

  // Method to end auction and notify all participants
  public async endAuction(auctionId: string): Promise<void> {
    try {
      // Get auction details
      const auction = await db('auctions')
        .where({ id: auctionId })
        .first();

      if (!auction) return;

      // Get winning bid
      const winningBid = await db('bids')
        .select([
          'bids.*',
          'users.name as user_name'
        ])
        .leftJoin('users', 'bids.user_id', 'users.id')
        .where('auction_id', auctionId)
        .orderBy('amount', 'desc')
        .first();

      // Update auction status
      await db('auctions')
        .where({ id: auctionId })
        .update({
          status: 'ended',
          winner_id: winningBid?.user_id,
          final_bid: winningBid?.amount
        });

      // Broadcast auction end to all participants
      this.io.to(`auction:${auctionId}`).emit('auction:ended', {
        auction: await this.getAuctionData(auctionId),
        winner: winningBid
      });

      console.log(`Auction ${auctionId} ended. Winner: ${winningBid?.user_name || 'None'}`);
    } catch (error) {
      console.error('Error ending auction:', error);
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
