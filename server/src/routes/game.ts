import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

router.use(authenticate);

router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await query(
      `SELECT * FROM game_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [req.user!.userId, limit]
    );
    res.json({ games: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

export default router;
