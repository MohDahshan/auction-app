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

// Get user stats (auctions won, total saved, success rate, best streak)
router.get('/:id/stats', async (req, res) => {
  // ... (unchanged)
});

// New: Get recent purchases (auctions won by user, with product info)
router.get('/:id/purchases', async (req, res) => {
  try {
    const { id } = req.params;
    // جلب آخر 10 مزادات فاز بها المستخدم مع تفاصيل المنتج
    try {
      // جلب الأعمدة الموجودة فقط (final_bid, end_time, title)
      const purchases = await db('auctions')
        .where('winner_id', id)
        .orderBy('end_time', 'desc')
        .limit(10)
        .select(
          'id as auction_id',
          'title as auction_title',
          'final_bid',
          'end_time'
        );

      const result = purchases.map(p => ({
        auctionId: p.auction_id,
        item: p.auction_title,
        date: p.end_time,
        profit: p.final_bid ? `Bid: SAR ${Number(p.final_bid) * 10}` : '',
        image: '', // لا يوجد صورة بدون join
      }));

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching user purchases:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user purchases',
        details: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error)
      });
    }
  } catch (error) {
    console.error('Error fetching user purchases:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user purchases'
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
