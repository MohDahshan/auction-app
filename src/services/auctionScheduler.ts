import { db } from '../config/database';
import { SocketService } from './socketService';

export class AuctionScheduler {
  private socketService: SocketService;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  constructor(socketService: SocketService) {
    this.socketService = socketService;
  }

  public start(): void {
    console.log('🕐 Starting Auction Scheduler...');
    
    // Run initial check
    this.checkAuctions();
    
    // Set up recurring checks
    this.schedulerInterval = setInterval(() => {
      this.checkAuctions();
    }, this.CHECK_INTERVAL);
    
    console.log(`✅ Auction Scheduler started - checking every ${this.CHECK_INTERVAL / 1000} seconds`);
  }

  public stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('🛑 Auction Scheduler stopped');
    }
  }

  private async checkAuctions(): Promise<void> {
    try {
      await Promise.all([
        this.startScheduledAuctions(),
        this.endLiveAuctions()
      ]);
    } catch (error) {
      console.error('❌ Error in auction scheduler:', error);
    }
  }

  private async startScheduledAuctions(): Promise<void> {
    try {
      const now = new Date();
      
      // Find auctions that should start now
      const auctionsToStart = await db('auctions')
        .select([
          'auctions.*',
          'products.name as product_name',
          'products.image_url as product_image',
          'products.market_price',
          'products.category'
        ])
        .leftJoin('products', 'auctions.product_id', 'products.id')
        .where('auctions.status', 'upcoming')
        .where('auctions.start_time', '<=', now)
        .where('auctions.is_active', true);

      for (const auction of auctionsToStart) {
        await this.startAuction(auction);
      }

      if (auctionsToStart.length > 0) {
        console.log(`🚀 Started ${auctionsToStart.length} scheduled auctions`);
      }
    } catch (error) {
      console.error('❌ Error starting scheduled auctions:', error);
    }
  }

  private async endLiveAuctions(): Promise<void> {
    try {
      const now = new Date();
      
      // Find auctions that should end now
      const auctionsToEnd = await db('auctions')
        .select([
          'auctions.*',
          'products.name as product_name'
        ])
        .leftJoin('products', 'auctions.product_id', 'products.id')
        .where('auctions.status', 'live')
        .where('auctions.end_time', '<=', now)
        .where('auctions.is_active', true);

      for (const auction of auctionsToEnd) {
        await this.endAuction(auction);
      }

      if (auctionsToEnd.length > 0) {
        console.log(`🏁 Ended ${auctionsToEnd.length} live auctions`);
      }
    } catch (error) {
      console.error('❌ Error ending live auctions:', error);
    }
  }

  private async startAuction(auction: any): Promise<void> {
    try {
      console.log(`🚀 Starting auction: ${auction.title} (ID: ${auction.id})`);

      // Update auction status to live
      await db('auctions')
        .where({ id: auction.id })
        .update({
          status: 'live',
          updated_at: new Date()
        });

      // Get updated auction data
      const updatedAuction = {
        ...auction,
        status: 'live',
        current_bid: auction.starting_bid,
        bidders: 0,
        timeLeft: Math.floor((new Date(auction.end_time).getTime() - new Date().getTime()) / 1000)
      };

      // Broadcast auction started event
      const io = this.socketService.getIO();
      io.emit('auction_started', {
        auction: updatedAuction,
        message: `Auction "${auction.title}" has started!`
      });

      // Broadcast auction status change
      io.emit('auction_status_changed', {
        auction: updatedAuction,
        previousStatus: 'scheduled',
        newStatus: 'live'
      });

      // Broadcast updated auctions lists
      await this.broadcastAuctionListUpdates();

      console.log(`✅ Successfully started auction: ${auction.title}`);
    } catch (error) {
      console.error(`❌ Error starting auction ${auction.id}:`, error);
    }
  }

  private async endAuction(auction: any): Promise<void> {
    try {
      console.log(`🏁 Ending auction: ${auction.title} (ID: ${auction.id})`);

      // Get winning bid
      const winningBid = await db('bids')
        .select([
          'bids.*',
          'users.name as user_name',
          'users.email as user_email'
        ])
        .leftJoin('users', 'bids.user_id', 'users.id')
        .where('auction_id', auction.id)
        .orderBy('amount', 'desc')
        .first();

      // Update auction status
      await db('auctions')
        .where({ id: auction.id })
        .update({
          status: 'ended',
          winner_id: winningBid?.user_id || null,
          final_bid: winningBid?.amount || auction.starting_bid,
          updated_at: new Date()
        });

      // Process winner and refunds
      if (winningBid) {
        await this.processAuctionWinner(auction, winningBid);
      }
      
      await this.refundLosingBids(auction.id, winningBid?.user_id);

      // Get updated auction data
      const updatedAuction = {
        ...auction,
        status: 'ended',
        winner_id: winningBid?.user_id || null,
        final_bid: winningBid?.amount || auction.starting_bid,
        winner: winningBid?.user_name || null
      };

      // Broadcast auction ended event
      const io = this.socketService.getIO();
      io.emit('auction_ended', {
        auction: updatedAuction,
        winner: winningBid,
        message: winningBid 
          ? `Auction "${auction.title}" won by ${winningBid.user_name}!`
          : `Auction "${auction.title}" ended with no bids`
      });

      // Broadcast auction status change
      io.emit('auction_status_changed', {
        auction: updatedAuction,
        previousStatus: 'live',
        newStatus: 'ended'
      });

      // Broadcast to auction room
      io.to(`auction:${auction.id}`).emit('auction:ended', {
        auction: updatedAuction,
        winner: winningBid
      });

      // Broadcast updated auctions lists
      await this.broadcastAuctionListUpdates();

      console.log(`✅ Successfully ended auction: ${auction.title}. Winner: ${winningBid?.user_name || 'None'}`);
    } catch (error) {
      console.error(`❌ Error ending auction ${auction.id}:`, error);
    }
  }

  private async processAuctionWinner(auction: any, winningBid: any): Promise<void> {
    try {
      // Create transaction record for the winner
      await db('transactions').insert({
        user_id: winningBid.user_id,
        auction_id: auction.id,
        type: 'auction_win',
        amount: -winningBid.amount,
        description: `Won auction: ${auction.title}`,
        status: 'completed',
        created_at: new Date()
      });

      console.log(`💰 Processed winner: ${winningBid.user_name} won ${auction.title} for ${winningBid.amount} coins`);
    } catch (error) {
      console.error('❌ Error processing auction winner:', error);
    }
  }

  private async refundLosingBids(auctionId: string, winnerId?: string): Promise<void> {
    try {
      // Get all losing bids
      const losingBids = await db('bids')
        .select([
          'bids.*',
          'users.name as user_name'
        ])
        .leftJoin('users', 'bids.user_id', 'users.id')
        .where('auction_id', auctionId)
        .where('amount', '>', 0);

      if (winnerId) {
        losingBids.filter(bid => bid.user_id !== winnerId);
      }

      // Process refunds
      for (const bid of losingBids) {
        if (bid.user_id !== winnerId && bid.amount > 0) {
          await db.transaction(async (trx: any) => {
            // Refund the bid amount
            await trx('users')
              .where({ id: bid.user_id })
              .increment('wallet_balance', bid.amount);

            // Create refund transaction record
            await trx('transactions').insert({
              user_id: bid.user_id,
              auction_id: auctionId,
              type: 'refund',
              amount: bid.amount,
              description: `Refund for losing bid in auction`,
              status: 'completed',
              created_at: new Date()
            });
          });

          console.log(`💸 Refunded ${bid.amount} coins to ${bid.user_name}`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing refunds:', error);
    }
  }

  private async broadcastAuctionListUpdates(): Promise<void> {
    try {
      const io = this.socketService.getIO();

      // Get updated auction lists
      const [liveAuctions, upcomingAuctions, endedAuctions] = await Promise.all([
        this.getAuctionsByStatus('live'),
        this.getAuctionsByStatus('upcoming'),
        this.getAuctionsByStatus('ended')
      ]);

      // Broadcast updated lists
      io.emit('auctions_updated', {
        type: 'live',
        auctions: liveAuctions
      });

      io.emit('auctions_updated', {
        type: 'upcoming',
        auctions: upcomingAuctions
      });

      io.emit('auctions_updated', {
        type: 'ended',
        auctions: endedAuctions
      });

    } catch (error) {
      console.error('❌ Error broadcasting auction list updates:', error);
    }
  }

  private async getAuctionsByStatus(status: string): Promise<any[]> {
    return await db('auctions')
      .select([
        'auctions.*',
        'products.name as product_name',
        'products.image_url as product_image',
        'products.market_price',
        'products.category'
      ])
      .leftJoin('products', 'auctions.product_id', 'products.id')
      .where('auctions.status', status)
      .where('auctions.is_active', true)
      .orderBy('auctions.created_at', 'desc')
      .limit(10);
  }

  // Method to manually trigger auction checks (useful for testing)
  public async triggerCheck(): Promise<void> {
    console.log('🔄 Manual auction check triggered');
    await this.checkAuctions();
  }

  // Get scheduler status
  public getStatus(): { running: boolean; checkInterval: number } {
    return {
      running: this.schedulerInterval !== null,
      checkInterval: this.CHECK_INTERVAL
    };
  }
}
