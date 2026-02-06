import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { JWTService } from '../utils/jwt.js';
import { ProvablyFair } from '../utils/provablyFair.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone, username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2 OR username = $3',
      [email, phone, username]
    );

    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await query('BEGIN');

    try {
      await query(
        `INSERT INTO users (id, email, phone, username, password_hash, balance)
         VALUES ($1, $2, $3, $4, $5, 1000.00)`,
        [userId, email, phone, username, passwordHash]
      );

      const seedPair = ProvablyFair.generateSeedPair();
      await query(
        `INSERT INTO user_seeds (user_id, client_seed, server_seed, server_seed_hash)
         VALUES ($1, $2, $3, $4)`,
        [userId, seedPair.clientSeed, seedPair.serverSeed, seedPair.serverSeedHash]
      );

      await query('COMMIT');

      const sessionId = uuidv4();
      const tokens = JWTService.generateTokenPair(
        {
          userId,
          email,
          username,
          vipTier: 'bronze',
        },
        sessionId
      );

      await query(
        `INSERT INTO sessions (id, user_id, refresh_token, expires_at, ip_address)
         VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4)`,
        [sessionId, userId, tokens.refreshToken, req.ip]
      );

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: userId,
          username,
          email,
          balance: 1000.0,
        },
        ...tokens,
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Credentials required' });
      return;
    }

    const userResult = await query(
      `SELECT id, email, username, password_hash, balance, vip_tier, is_active, is_banned
       FROM users
       WHERE email = $1 OR phone = $1 OR username = $1`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      res.status(403).json({ error: 'Account is inactive' });
      return;
    }

    if (user.is_banned) {
      res.status(403).json({ error: 'Account is banned' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    await query(
      'UPDATE users SET last_login_at = NOW(), last_ip = $1 WHERE id = $2',
      [req.ip, user.id]
    );

    const sessionId = uuidv4();
    const tokens = JWTService.generateTokenPair(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        vipTier: user.vip_tier,
      },
      sessionId
    );

    await query(
      `INSERT INTO sessions (id, user_id, refresh_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4, $5)`,
      [sessionId, user.id, tokens.refreshToken, req.ip, req.headers['user-agent']]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance),
        vipTier: user.vip_tier,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const payload = JWTService.verifyRefreshToken(refreshToken);

    const sessionResult = await query(
      `SELECT s.*, u.email, u.username, u.vip_tier
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.refresh_token = $2 AND s.expires_at > NOW()`,
      [payload.sessionId, refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const session = sessionResult.rows[0];

    const newTokens = JWTService.generateTokenPair(
      {
        userId: payload.userId,
        email: session.email,
        username: session.username,
        vipTier: session.vip_tier,
      },
      payload.sessionId
    );

    await query(
      'UPDATE sessions SET refresh_token = $1, expires_at = NOW() + INTERVAL \'7 days\' WHERE id = $2',
      [newTokens.refreshToken, payload.sessionId]
    );

    res.json(newTokens);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await query('DELETE FROM sessions WHERE refresh_token = $1', [refreshToken]);
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userResult = await query(
      `SELECT id, email, phone, username, balance, total_wagered, total_won, total_lost,
              level, vip_tier, kyc_verified, created_at
       FROM users
       WHERE id = $1`,
      [req.user!.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    res.json({
      user: {
        ...user,
        balance: parseFloat(user.balance),
        total_wagered: parseFloat(user.total_wagered),
        total_won: parseFloat(user.total_won),
        total_lost: parseFloat(user.total_lost),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
