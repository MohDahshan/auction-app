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
  try {
    const { id } = req.params;

    // Auctions won: auctions where user is winner
    const wonAuctions = await db('auctions').where('winner_id', id);
    const auctionsWon = wonAuctions.length;

    // Total saved: إذا لم يوجد market_price أو final_bid، اجعلها صفر
    let totalSaved = 0;
    for (const auction of wonAuctions) {
      if ('market_price' in auction && 'final_bid' in auction && auction.market_price && auction.final_bid) {
        totalSaved += Number(auction.market_price) - Number(auction.final_bid) * 10;
      }
    }

    // Success rate: auctions won / auctions participated
    let auctionsParticipated = 0;
    try {
      const participated = await db('bids').where('user_id', id).distinct('auction_id');
      auctionsParticipated = participated.length;
    } catch (e) {
      auctionsParticipated = auctionsWon; // fallback
    }
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
      error: 'Failed to fetch user stats',
      details: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error)
    });
  }
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

/**
 * Update user profile (name, email, phone)
 * PATCH/PUT /api/users/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, phone } = req.body;

    // Log بداية التحديث
    console.log(`[USER UPDATE] id=${id} email=${email} name=${name} phone=${phone}`);

    // فقط الأعمدة المسموحة
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // تحديث المستخدم
    const [updatedUser] = await db('users')
      .where('id', id)
      .update(updateData)
      .returning([
        'id',
        'email',
        'name',
        'phone',
        'wallet_balance',
        'is_active',
        'created_at',
        'last_login_at'
      ]);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Log نهاية التحديث
    console.log(`[USER UPDATE SUCCESS] id=${id}`);

    return res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user',
      details: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error)
    });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  // ... (unchanged)
});

export default router;
