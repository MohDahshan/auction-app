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
    let purchases: any[] = [];
    try {
      purchases = await db('auctions')
        .where('winner_id', id)
        .orderBy('end_time', 'desc')
        .limit(10)
        .leftJoin('products', 'auctions.product_id', 'products.id')
        .select(
          'auctions.id as auction_id',
          'auctions.title as auction_title',
          'auctions.final_bid',
          'auctions.market_price',
          'auctions.end_time',
          db.raw('COALESCE(products.name, auctions.title) as product_name'),
          db.raw('COALESCE(products.image_url, \'\') as product_image')
        );
    } catch (err) {
      // fallback: جلب فقط من جدول auctions بدون join
      purchases = await db('auctions')
        .where('winner_id', id)
        .orderBy('end_time', 'desc')
        .limit(10)
        .select(
          'id as auction_id',
          'title as auction_title',
          'final_bid',
          'market_price',
          'end_time'
        );
    }

    // تجهيز البيانات للواجهة
    const result = purchases.map(p => ({
      auctionId: p.auction_id,
      item: p.product_name || p.auction_title,
      date: p.end_time,
      profit: p.market_price && p.final_bid ? `+SAR ${Number(p.market_price) - Number(p.final_bid) * 10}` : '',
      image: p.product_image || '',
    }));

    return res.json({
      success: true,
      data: result
    });
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
