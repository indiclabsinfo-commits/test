import express, { Response } from 'express';
import { query } from '../config/database.js';

const router = express.Router();

router.get('/top-winners', async (req, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.username, u.total_won, u.vip_tier
       FROM users u
       WHERE u.total_won > 0
       ORDER BY u.total_won DESC
       LIMIT 100`
    );
    res.json({ leaders: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/top-wagered', async (req, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.username, u.total_wagered, u.vip_tier
       FROM users u
       WHERE u.total_wagered > 0
       ORDER BY u.total_wagered DESC
       LIMIT 100`
    );
    res.json({ leaders: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
