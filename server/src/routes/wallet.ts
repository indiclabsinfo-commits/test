import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

router.use(authenticate);

router.get('/balance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT balance FROM users WHERE id = $1', [req.user!.userId]);
    res.json({ balance: parseFloat(result.rows[0].balance) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

router.get('/transactions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [req.user!.userId, limit]
    );
    res.json({ transactions: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
