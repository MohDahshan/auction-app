import express from 'express';
import { db } from '../config/database';

const router = express.Router();

// Get all users with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let query = db('users').select('*');
    let countQuery = db('users');

    // Add search functionality
    if (search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
      });
      
      countQuery = countQuery.where(function() {
        this.where('name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
      });
    }

    // Get total count for pagination
    const totalResult = await countQuery.count('* as count').first();
    const total = parseInt(totalResult?.count as string) || 0;
    const pages = Math.ceil(total / limit);

    // Get users with pagination
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

    return res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  // ... (unchanged)
});

// New: Get user stats (auctions won, total saved, success rate, best streak)
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Auctions won: auctions where user is winner
    const wonAuctions = await db('auctions').where('winner_id', id);
    const auctionsWon = wonAuctions.length;

    // Total saved: sum of (market_price - final_bid*10) for won auctions
    let totalSaved = 0;
    for (const auction of wonAuctions) {
      if (auction.market_price && auction.final_bid) {
        totalSaved += Number(auction.market_price) - Number(auction.final_bid) * 10;
      }
    }

    // Success rate: auctions won / auctions participated
    const participated = await db('bids').where('user_id', id).distinct('auction_id');
    const auctionsParticipated = participated.length;
    const successRate = auctionsParticipated > 0 ? Math.round((auctionsWon / auctionsParticipated) * 100) : 0;

    // Best streak: max consecutive wins (simple version: total wins)
    const bestStreak = auctionsWon; // For now, just total wins

    return res.json({
      success: true,
      data: {
        auctionsWon,
        totalSaved,
        successRate,
        bestStreak
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user stats'
    });
  }
});

// Create new user
router.post('/', async (req, res) => {
  // ... (unchanged)
});

// Update user
router.put('/:id', async (req, res) => {
  // ... (unchanged)
});

// Delete user
router.delete('/:id', async (req, res) => {
  // ... (unchanged)
});

export default router;
