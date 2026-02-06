import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

router.use(authenticate);

router.get('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT id, username, email, balance, vip_tier, level, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT total_wagered, total_won, total_lost,
              (SELECT COUNT(*) FROM game_sessions WHERE user_id = $1) as games_played
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
