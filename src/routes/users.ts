import express from 'express';
import { db } from '../config/database';

const router = express.Router();

// Get all users with pagination
router.get('/', async (req, res) => {
  // ... (unchanged)
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

    res.json({
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
