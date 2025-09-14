import express from 'express';
import { db } from '../config/database';

const router = express.Router();

// Get all transactions with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const totalResult = await db('transactions').count('* as count').first();
    const total = parseInt(totalResult?.count as string) || 0;
    const pages = Math.ceil(total / limit);

    // Get transactions with pagination
    const transactions = await db('transactions')
      .select([
        'id',
        'type',
        'amount',
        'description',
        'status',
        'created_at'
      ])
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions'
    });
  }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await db('transactions')
      .select([
        'id',
        'type',
        'amount',
        'description',
        'status',
        'created_at'
      ])
      .where('id', id)
      .first();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    return res.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction'
    });
  }
});

export default router;
