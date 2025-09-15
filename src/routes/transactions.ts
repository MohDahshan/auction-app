import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// Validation rules
const transactionFilters = [
  query('type').optional().isIn(['entry_fee', 'bid', 'refund', 'deposit', 'withdrawal']),
  query('status').optional().isIn(['pending', 'completed', 'failed']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('user_id').optional().isUUID()
];

const createTransactionValidation = [
  body('user_id').isUUID().withMessage('User ID must be a valid UUID'),
  body('type').isIn(['entry_fee', 'bid', 'refund', 'deposit', 'withdrawal']).withMessage('Invalid transaction type'),
  body('amount').isInt().withMessage('Amount must be an integer'),
  body('description').isLength({ min: 3, max: 500 }).withMessage('Description must be between 3 and 500 characters'),
  body('status').optional().isIn(['pending', 'completed', 'failed']).withMessage('Invalid status'),
  body('auction_id').optional().isUUID().withMessage('Auction ID must be a valid UUID')
];

// Get all transactions with filters
router.get('/', transactionFilters, authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
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
      type,
      status,
      user_id,
      page = 1,
      limit = 20
    } = req.query;

    let query = db('transactions')
      .select([
        'transactions.*',
        'users.name as user_name',
        'users.email as user_email',
        'auctions.title as auction_title'
      ])
      .leftJoin('users', 'transactions.user_id', 'users.id')
      .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
      .orderBy('transactions.created_at', 'desc');

    // Apply filters
    if (type) {
      query = query.where('transactions.type', type as string);
    }
    if (status) {
      query = query.where('transactions.status', status as string);
    }
    if (user_id) {
      query = query.where('transactions.user_id', user_id as string);
    }

    // Get total count for pagination
    const totalQuery = db('transactions').count('* as count');
    if (type) {
      totalQuery.where('type', type as string);
    }
    if (status) {
      totalQuery.where('status', status as string);
    }
    if (user_id) {
      totalQuery.where('user_id', user_id as string);
    }

    const [{ count: total }] = await totalQuery;
    const totalCount = parseInt(total as string, 10);

    // Apply pagination
    const offset = (Number(page) - 1) * Number(limit);
    const transactions = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get single transaction by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const transaction = await db('transactions')
      .select([
        'transactions.*',
        'users.name as user_name',
        'users.email as user_email',
        'auctions.title as auction_title'
      ])
      .leftJoin('users', 'transactions.user_id', 'users.id')
      .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
      .where('transactions.id', id)
      .first();

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
      return;
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new transaction
router.post('/', authenticateToken, createTransactionValidation, async (req: AuthRequest, res: Response): Promise<void> => {
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
      user_id,
      type,
      amount,
      description,
      status = 'completed',
      auction_id
    } = req.body;

    // Check if user exists
    const user = await db('users').where({ id: user_id }).first();
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check if auction exists (if auction_id is provided)
    if (auction_id) {
      const auction = await db('auctions').where({ id: auction_id }).first();
      if (!auction) {
        res.status(404).json({
          success: false,
          error: 'Auction not found'
        });
        return;
      }
    }

    // Start transaction to handle wallet updates
    await db.transaction(async (trx) => {
      // Create transaction record
      const [transaction] = await trx('transactions')
        .insert({
          user_id,
          auction_id,
          type,
          amount,
          description,
          status
        })
        .returning('*');

      // Update user wallet if transaction is completed and affects balance
      if (status === 'completed' && ['deposit', 'withdrawal', 'refund'].includes(type)) {
        if (type === 'deposit' || type === 'refund') {
          await trx('users')
            .where({ id: user_id })
            .increment('wallet_balance', Math.abs(amount));
        } else if (type === 'withdrawal') {
          // Check if user has enough balance
          const currentUser = await trx('users').where({ id: user_id }).first();
          if (currentUser.wallet_balance < Math.abs(amount)) {
            throw new Error('Insufficient wallet balance');
          }
          await trx('users')
            .where({ id: user_id })
            .decrement('wallet_balance', Math.abs(amount));
        }
      }

      // Get transaction with user details
      const transactionWithDetails = await trx('transactions')
        .select([
          'transactions.*',
          'users.name as user_name',
          'users.email as user_email',
          'auctions.title as auction_title'
        ])
        .leftJoin('users', 'transactions.user_id', 'users.id')
        .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
        .where('transactions.id', transaction.id)
        .first();

      res.status(201).json({
        success: true,
        data: transactionWithDetails,
        message: 'Transaction created successfully'
      });
    });
  } catch (error: any) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Update transaction
router.put('/:id', authenticateToken, createTransactionValidation, async (req: AuthRequest, res: Response): Promise<void> => {
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
      user_id,
      type,
      amount,
      description,
      status,
      auction_id
    } = req.body;

    // Check if transaction exists
    const existingTransaction = await db('transactions').where({ id }).first();
    if (!existingTransaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
      return;
    }

    // Don't allow editing completed transactions that affect wallet balance
    if (existingTransaction.status === 'completed' && 
        ['deposit', 'withdrawal', 'refund', 'bid', 'entry_fee'].includes(existingTransaction.type)) {
      res.status(400).json({
        success: false,
        error: 'Cannot edit completed financial transactions'
      });
      return;
    }

    // Check if user exists
    const user = await db('users').where({ id: user_id }).first();
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check if auction exists (if auction_id is provided)
    if (auction_id) {
      const auction = await db('auctions').where({ id: auction_id }).first();
      if (!auction) {
        res.status(404).json({
          success: false,
          error: 'Auction not found'
        });
        return;
      }
    }

    const [updatedTransaction] = await db('transactions')
      .where({ id })
      .update({
        user_id,
        auction_id,
        type,
        amount,
        description,
        status,
        updated_at: new Date()
      })
      .returning('*');

    // Get transaction with user details
    const transactionWithDetails = await db('transactions')
      .select([
        'transactions.*',
        'users.name as user_name',
        'users.email as user_email',
        'auctions.title as auction_title'
      ])
      .leftJoin('users', 'transactions.user_id', 'users.id')
      .leftJoin('auctions', 'transactions.auction_id', 'auctions.id')
      .where('transactions.id', id)
      .first();

    res.json({
      success: true,
      data: transactionWithDetails,
      message: 'Transaction updated successfully'
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if transaction exists
    const transaction = await db('transactions').where({ id }).first();
    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
      return;
    }

    // Don't allow deleting completed transactions that affect wallet balance
    if (transaction.status === 'completed' && 
        ['deposit', 'withdrawal', 'refund', 'bid', 'entry_fee'].includes(transaction.type)) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete completed financial transactions'
      });
      return;
    }

    await db('transactions').where({ id }).del();

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get transaction statistics
router.get('/stats/summary', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await db('transactions')
      .select([
        db.raw('COUNT(*) as total_transactions'),
        db.raw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income'),
        db.raw('SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_outgoing'),
        db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_transactions'),
        db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_transactions'),
        db.raw('COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failed_transactions')
      ])
      .first();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
