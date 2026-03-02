import { Router } from 'express';
import { query } from '../config/database.js';
import { JWTService } from '../utils/jwt.js';

const router = Router();

// Get game history
router.get('/history', JWTService.middleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  
  try {
    const result = await query(
      `SELECT game_type, bet_amount, multiplier, payout, result, game_data, created_at
       FROM game_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [(req as any).userId, limit]
    );

    res.json({ games: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get provably fair seed for verification
router.get('/verify/:sessionId', JWTService.middleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT ps.server_seed, ps.client_seed, ps.nonce, ps.server_seed_hash
       FROM game_sessions gs
       JOIN provably_fair_seeds ps ON gs.provably_fair_seed_id = ps.id
       WHERE gs.id = $1 AND gs.user_id = $2`,
      [req.params.sessionId, (req as any).userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ seed: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get seed' });
  }
});

export default router;
