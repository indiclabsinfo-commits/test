import { Router } from 'express';
import { JWTService } from '../utils/jwt.js';
import { query } from '../config/database.js';

const router = Router();
router.use(JWTService.middleware);

// Toggle demo mode
router.post('/toggle-demo', async (req: any, res) => {
  try {
    const result = await query(
      `UPDATE users SET is_demo_mode = NOT is_demo_mode WHERE id = $1
       RETURNING is_demo_mode, balance, demo_balance`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const u = result.rows[0];
    res.json({
      isDemoMode: u.is_demo_mode,
      balance: u.balance,
      demoBalance: u.demo_balance,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle mode' });
  }
});

// Get full profile
router.get('/profile', async (req: any, res) => {
  try {
    const result = await query(
      `SELECT id, username, balance, demo_balance, is_demo_mode, role, phone, email, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get transaction history
router.get('/transactions', async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await query(
      `SELECT id, type, status, amount, fee, net_amount, currency,
              tx_hash, description, created_at
       FROM transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [req.userId, limit]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

export default router;
