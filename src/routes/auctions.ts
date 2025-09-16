import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { AuthRequest, authenticateToken, optionalAuth } from '../middleware/auth';
import { Auction, AuctionFilters, BidRequest, CreateAuctionRequest } from '../types';
import { socketService } from '../server';

const router = Router();

// Validation rules
const bidValidation = [
  body('amount').isInt({ min: 1 }).withMessage('Bid amount must be a positive integer')
];

const createAuctionValidation = [
  body('product_id').isUUID().withMessage('Product ID must be a valid UUID'),
  body('title').isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('entry_fee').isInt({ min: 1 }).withMessage('Entry fee must be a positive integer'),
  body('min_wallet').isInt({ min: 0 }).withMessage('Minimum wallet must be a non-negative integer'),
  body('starting_bid').isInt({ min: 1 }).withMessage('Starting bid must be a positive integer'),
  body('start_time').isISO8601().withMessage('Start time must be a valid ISO 8601 date'),
  body('end_time').isISO8601().withMessage('End time must be a valid ISO 8601 date')
];

const auctionFilters = [
  query('status').optional().isIn(['upcoming', 'live', 'ended']),
  query('category').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

// Get all auctions grouped by status - MUST BE BEFORE /:id route
router.get('/all', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get all auctions with product details
    const allAuctions = await db('auctions')
      .select([
        'auctions.*',
        'products.name as product_name',
        'products.image_url as product_image',
        'products.market_price',
        'products.category',
        'products.brand',
        'users.name as winner_name'
      ])
      .leftJoin('products', 'auctions.product_id', 'products.id')
      .leftJoin('users', 'auctions.winner_id', 'users.id')
      .orderBy('auctions.created_at', 'desc');

    // Get current highest bids for each auction
    const auctionIds = allAuctions.map(auction => auction.id);
    const highestBids = await db('bids')
      .select('auction_id')
      .max('amount as highest_bid')
      .whereIn('auction_id', auctionIds)
      .groupBy('auction_id');

    const bidMap = highestBids.reduce((acc, bid) => {
      acc[bid.auction_id] = bid.highest_bid;
      return acc;
    }, {} as Record<string, number>);

    // Transform and group auctions
    const transformedAuctions = allAuctions.map(auction => ({
      id: auction.id,
      title: auction.title,
      image: auction.product_image || 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg',
      currentBid: bidMap[auction.id] || auction.starting_bid,
      marketPrice: auction.market_price,
      timeLeft: auction.status === 'live' ? Math.max(0, Math.floor((new Date(auction.end_time).getTime() - Date.now()) / 1000)) : 0,
      bidders: auction.total_participants || 0,
      entryFee: auction.entry_fee,
      minWallet: auction.min_wallet,
      description: auction.description || `${auction.title} - ${auction.status} auction`,
      category: auction.category || 'General',
      status: auction.status,
      startTime: auction.start_time,
      endTime: auction.end_time,
      productName: auction.product_name,
      finalBid: auction.status === 'ended' ? (bidMap[auction.id] || auction.starting_bid) : undefined,
      winner: auction.winner_name,
      savings: auction.status === 'ended' ? (auction.market_price - (bidMap[auction.id] || auction.starting_bid)) : undefined,
      endedAgo: auction.status === 'ended' ? 'Recently ended' : undefined,
      product: {
        name: auction.product_name,
        image_url: auction.product_image,
        market_price: auction.market_price,
        category: auction.category,
        brand: auction.brand
      }
    }));

    // Group auctions by status
    const upcoming = transformedAuctions.filter(auction => auction.status === 'upcoming');
    const live = transformedAuctions.filter(auction => auction.status === 'live');
    const ended = transformedAuctions.filter(auction => auction.status === 'ended');
    
    // Featured auctions (high-value or popular ones)
    const featured = transformedAuctions
      .filter(auction => auction.marketPrice > 1000 || auction.bidders > 10)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        upcoming,
        live,
        ended,
        featured
      }
    });
  } catch (error) {
    console.error('Get all auctions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all auctions with filters
router.get('/', auctionFilters, optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const {
      status,
      category,
      page = 1,
      limit = 20
    }: AuctionFilters = req.query;

    let query = db('auctions')
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

    // Apply filters
    if (status) {
      query = query.where('auctions.status', status);
    }
    if (category) {
      query = query.where('products.category', category);
    }

    // Get total count for pagination
    const totalQuery = db('auctions')
      .leftJoin('products', 'auctions.product_id', 'products.id')
      .count('* as count');

    if (status) {
      totalQuery.where('auctions.status', status);
    }
    if (category) {
      totalQuery.where('products.category', category);
    }

    const [{ count: total }] = await totalQuery;
    const totalCount = parseInt(total as string, 10);

    // Apply pagination
    const offset = (page - 1) * limit;
    const auctions = await query.limit(limit).offset(offset);

    // Get current highest bids for each auction
    const auctionIds = auctions.map(auction => auction.id);
    const highestBids = await db('bids')
      .select('auction_id')
      .max('amount as highest_bid')
      .whereIn('auction_id', auctionIds)
      .groupBy('auction_id');

    const bidMap = highestBids.reduce((acc, bid) => {
      acc[bid.auction_id] = bid.highest_bid;
      return acc;
    }, {} as Record<string, number>);

    // Add current bid to each auction
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
  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new auction
router.post('/', authenticateToken, createAuctionValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const {
      product_id,
      title,
      description,
      entry_fee,
      min_wallet,
      starting_bid,
      start_time,
      end_time
    }: CreateAuctionRequest = req.body;

    // Validate dates
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

    // Check if product exists
    const product = await db('products')
      .where({ id: product_id, is_active: true })
      .first();

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found or inactive'
      });
      return;
    }

    // Create auction
    const [auction] = await db('auctions')
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

    // Get auction with product details
    const auctionWithProduct = await db('auctions')
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

    // Broadcast new auction to all connected clients
    const newAuctionData = {
      ...auctionWithProduct,
      current_bid: auctionWithProduct.starting_bid,
      product: {
        name: auctionWithProduct.product_name,
        image_url: auctionWithProduct.product_image,
        market_price: auctionWithProduct.market_price,
        category: auctionWithProduct.category,
        brand: auctionWithProduct.brand
      }
    };

    // Emit to all connected clients
    if (socketService) {
      socketService.getIO().emit('auction:created', {
        auction: newAuctionData,
        message: 'New auction created'
      });
    }

    res.status(201).json({
      success: true,
      data: newAuctionData,
      message: 'Auction created successfully'
    });
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get single auction by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const auction = await db('auctions')
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

    // Get current highest bid
    const highestBid = await db('bids')
      .where('auction_id', id)
      .max('amount as highest_bid')
      .first();

    // Get bid history with user info
    const bids = await db('bids')
      .select([
        'bids.*',
        'users.name as user_name'
      ])
      .leftJoin('users', 'bids.user_id', 'users.id')
      .where('auction_id', id)
      .orderBy('amount', 'desc')
      .limit(10);

    // Check if current user is participating
    let userBid = null;
    if (req.user) {
      userBid = await db('bids')
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
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Join auction
router.post('/:id/join', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get auction details
    const auction = await db('auctions')
      .where({ id, status: 'live' })
      .first();

    if (!auction) {
      res.status(404).json({
        success: false,
        error: 'Auction not found or not live'
      });
      return;
    }

    // Check if user has enough wallet balance
    const user = await db('users').where({ id: userId }).first();
    if (user.wallet_balance < auction.entry_fee) {
      res.status(400).json({
        success: false,
        error: 'Insufficient wallet balance'
      });
      return;
    }

    // Check if user already joined
    const existingBid = await db('bids')
      .where({ auction_id: id, user_id: userId })
      .first();

    if (existingBid) {
      res.status(400).json({
        success: false,
        error: 'Already participating in this auction'
      });
      return;
    }

    // Start transaction
    await db.transaction(async (trx) => {
      // Deduct entry fee from wallet
      await trx('users')
        .where({ id: userId })
        .decrement('wallet_balance', auction.entry_fee);

      // Create bid record with 0 amount (indicates participation)
      await trx('bids').insert({
        auction_id: id,
        user_id: userId,
        amount: 0,
        bid_time: new Date(),
        is_winning: false
      });

      // Create transaction record
      await trx('transactions').insert({
        user_id: userId,
        auction_id: id,
        type: 'entry_fee',
        amount: -auction.entry_fee,
        description: `Entry fee for auction: ${auction.title}`,
        status: 'completed'
      });

      // Update auction participant count
      await trx('auctions')
        .where({ id })
        .increment('total_participants', 1);
    });

    res.json({
      success: true,
      message: 'Successfully joined auction'
    });
  } catch (error) {
    console.error('Join auction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Place bid
router.post('/:id/bid', authenticateToken, bidValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { id } = req.params;
    const { amount }: BidRequest = req.body;
    const userId = req.user!.id;

    // Get auction details
    const auction = await db('auctions')
      .where({ id, status: 'live' })
      .first();

    if (!auction) {
      res.status(404).json({
        success: false,
        error: 'Auction not found or not live'
      });
      return;
    }

    // Check if auction has ended
    if (new Date() > new Date(auction.end_time)) {
      res.status(400).json({
        success: false,
        error: 'Auction has ended'
      });
      return;
    }

    // Check if user has joined the auction
    const existingBid = await db('bids')
      .where({ auction_id: id, user_id: userId })
      .first();

    if (!existingBid) {
      res.status(400).json({
        success: false,
        error: 'Must join auction before bidding'
      });
      return;
    }

    // Get current highest bid
    const highestBid = await db('bids')
      .where('auction_id', id)
      .max('amount as highest_bid')
      .first();

    const currentHighest = highestBid?.highest_bid || auction.starting_bid;

    // Check if bid is higher than current highest
    if (amount <= currentHighest) {
      res.status(400).json({
        success: false,
        error: `Bid must be higher than current highest bid of ${currentHighest}`
      });
      return;
    }

    // Check if user has enough wallet balance
    const user = await db('users').where({ id: userId }).first();
    if (user.wallet_balance < amount) {
      res.status(400).json({
        success: false,
        error: 'Insufficient wallet balance'
      });
      return;
    }

    // Start transaction
    await db.transaction(async (trx) => {
      // If user had a previous bid, refund it
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

      // Deduct new bid amount from wallet
      await trx('users')
        .where({ id: userId })
        .decrement('wallet_balance', amount);

      // Update bid record
      await trx('bids')
        .where({ auction_id: id, user_id: userId })
        .update({
          amount,
          bid_time: new Date(),
          is_winning: true
        });

      // Mark all other bids as not winning
      await trx('bids')
        .where('auction_id', id)
        .whereNot('user_id', userId)
        .update({ is_winning: false });

      // Create transaction record
      await trx('transactions').insert({
        user_id: userId,
        auction_id: id,
        type: 'bid',
        amount: -amount,
        description: `Bid placed in auction: ${auction.title}`,
        status: 'completed'
      });

      // Update auction bid count
      await trx('auctions')
        .where({ id })
        .increment('total_bids', 1);
    });

    // Get updated bid info
    const updatedBid = await db('bids')
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
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update auction
router.put('/:id', authenticateToken, createAuctionValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { id } = req.params;
    const {
      product_id,
      title,
      description,
      entry_fee,
      min_wallet,
      starting_bid,
      start_time,
      end_time
    }: CreateAuctionRequest = req.body;

    // Check if auction exists
    const existingAuction = await db('auctions').where({ id }).first();
    if (!existingAuction) {
      res.status(404).json({
        success: false,
        error: 'Auction not found'
      });
      return;
    }

    // Don't allow editing live or ended auctions
    if (existingAuction.status !== 'upcoming') {
      res.status(400).json({
        success: false,
        error: 'Cannot edit auction that is live or has ended'
      });
      return;
    }

    // Validate dates
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

    // Check if product exists
    const product = await db('products')
      .where({ id: product_id, is_active: true })
      .first();

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found or inactive'
      });
      return;
    }

    // Update auction
    const [updatedAuction] = await db('auctions')
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

    // Get auction with product details
    const auctionWithProduct = await db('auctions')
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

    // Broadcast auction update to all connected clients
    const updatedAuctionData = {
      ...auctionWithProduct,
      current_bid: auctionWithProduct.starting_bid,
      product: {
        name: auctionWithProduct.product_name,
        image_url: auctionWithProduct.product_image,
        market_price: auctionWithProduct.market_price,
        category: auctionWithProduct.category,
        brand: auctionWithProduct.brand
      }
    };

    // Emit to all connected clients
    if (socketService) {
      socketService.getIO().emit('auction:updated', {
        auction: updatedAuctionData,
        message: 'Auction updated'
      });
    }

    res.json({
      success: true,
      data: updatedAuctionData,
      message: 'Auction updated successfully'
    });
  } catch (error) {
    console.error('Update auction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete auction
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if auction exists
    const auction = await db('auctions').where({ id }).first();
    if (!auction) {
      res.status(404).json({
        success: false,
        error: 'Auction not found'
      });
      return;
    }

    // Don't allow deleting live auctions
    if (auction.status === 'live') {
      res.status(400).json({
        success: false,
        error: 'Cannot delete live auction'
      });
      return;
    }

    // Start transaction to handle related data
    await db.transaction(async (trx) => {
      // If auction has participants, refund entry fees
      if (auction.total_participants > 0) {
        const participants = await trx('bids')
          .select('user_id')
          .where('auction_id', id)
          .groupBy('user_id');

        for (const participant of participants) {
          // Refund entry fee
          await trx('users')
            .where({ id: participant.user_id })
            .increment('wallet_balance', auction.entry_fee);

          // Create refund transaction
          await trx('transactions').insert({
            user_id: participant.user_id,
            auction_id: id,
            type: 'refund',
            amount: auction.entry_fee,
            description: `Refund for cancelled auction: ${auction.title}`,
            status: 'completed'
          });
        }

        // Refund any active bids
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

      // Delete related bids
      await trx('bids').where('auction_id', id).del();

      // Delete the auction
      await trx('auctions').where({ id }).del();
    });

    // Broadcast auction deletion to all connected clients
    if (socketService) {
      socketService.getIO().emit('auction:deleted', {
        auctionId: id,
        message: 'Auction deleted'
      });
    }

    res.json({
      success: true,
      message: 'Auction deleted successfully'
    });
  } catch (error) {
    console.error('Delete auction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


// Get auction bids
router.get('/:id/bids', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const bids = await db('bids')
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
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
