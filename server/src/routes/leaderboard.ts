import { Router } from 'express';
import { query } from '../config/database.js';

const router = Router();

// Get leaderboard
router.get('/', async (req, res) => {
  const gameType = req.query.game as string;
  
  try {
    let result;
    
    if (gameType) {
      result = await query(
        `SELECT username, game_type, total_wagered, total_won, biggest_win
         FROM leaderboard
         WHERE game_type = $1
         ORDER BY total_won DESC
         LIMIT 50`,
        [gameType]
      );
    } else {
      result = await query(
        `SELECT username, SUM(total_won) as total_won, SUM(total_wagered) as total_wagered
         FROM leaderboard
         GROUP BY username
         ORDER BY total_won DESC
         LIMIT 50`
      );
    }

    res.json({ leaders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get top winners today
router.get('/today', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.username, gs.game_type, gs.payout, gs.multiplier
       FROM game_sessions gs
       JOIN users u ON gs.user_id = u.id
       WHERE gs.created_at > NOW() - INTERVAL '24 hours'
       AND gs.result = 'WIN'
       ORDER BY gs.payout DESC
       LIMIT 20`
    );

    res.json({ winners: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get today winners' });
  }
});

export default router;
