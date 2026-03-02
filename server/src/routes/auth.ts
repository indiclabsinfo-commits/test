import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { JWTService } from '../utils/jwt.js';

const router = Router();
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/auth';

const isProd = process.env.NODE_ENV === 'production';
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict' as const,
  path: REFRESH_COOKIE_PATH,
  maxAge: 7 * 24 * 60 * 60 * 1000, // aligned with default 7d refresh lifetime
};

const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};

const readRefreshToken = (req: Request): string | null => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((item) => item.trim());
    const match = cookies.find((item) => item.startsWith(`${REFRESH_COOKIE}=`));
    if (match) {
      const token = match.slice(`${REFRESH_COOKIE}=`.length);
      if (token) return decodeURIComponent(token);
    }
  }

  // Backward compatibility with old body-based refresh.
  return req.body?.refreshToken || null;
};

const buildRefreshExpiry = (token: string): Date => {
  const decoded = JWTService.decodeToken(token);
  if (decoded?.exp) {
    return new Date(decoded.exp * 1000);
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};

const createRefreshSession = async (
  userId: string,
  req: Request
): Promise<{ refreshToken: string; sessionId: string }> => {
  const sessionId = uuidv4();
  const refreshToken = JWTService.generateRefreshToken(userId, sessionId);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = buildRefreshExpiry(refreshToken);

  await query(
    `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sessionId,
      userId,
      refreshTokenHash,
      req.ip || null,
      req.get('user-agent') || null,
      expiresAt,
    ]
  );

  return { refreshToken, sessionId };
};

// Register
router.post('/register', [
  body('username').isLength({ min: 3, max: 32 }).trim(),
  body('password').isLength({ min: 6 }),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { username, password } = req.body;

  try {
    // Check if username exists
    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user: balance=0 (real), demo_balance=100000000 (1000.00 demo credits)
    const result = await query(
      `INSERT INTO users (username, password_hash, balance, demo_balance, is_demo_mode)
       VALUES ($1, $2, 0, 100000000, TRUE)
       RETURNING id, username, balance, demo_balance, is_demo_mode, role`,
      [username, passwordHash]
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = JWTService.generateAccessToken(user.id, user.username);
    const { refreshToken } = await createRefreshSession(user.id, req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    res.json({
      user: {
        id: user.id, username: user.username,
        balance: user.balance, demoBalance: user.demo_balance,
        isDemoMode: user.is_demo_mode, role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('username').trim(),
  body('password').exists(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { username, password } = req.body;

  try {
    const result = await query(
      'SELECT id, username, password_hash, balance, demo_balance, is_demo_mode, role FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = JWTService.generateAccessToken(user.id, user.username);
    const { refreshToken } = await createRefreshSession(user.id, req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    // Update last seen
    await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    res.json({
      user: {
        id: user.id, username: user.username,
        balance: user.balance, demoBalance: user.demo_balance,
        isDemoMode: user.is_demo_mode, role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const refreshToken = readRefreshToken(req);

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const payload = JWTService.verifyRefreshToken(refreshToken);
    if (!payload.sessionId) {
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const sessionResult = await query(
      `SELECT id, user_id, refresh_token_hash, revoked_at, expires_at
       FROM auth_sessions
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [payload.sessionId, payload.userId]
    );

    if (sessionResult.rows.length === 0) {
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      return res.status(401).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const providedHash = hashToken(refreshToken);
    const expired = new Date(session.expires_at).getTime() <= Date.now();

    // Reuse/mismatch detection: revoke all user sessions.
    if (session.revoked_at || session.refresh_token_hash !== providedHash || expired) {
      await query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [payload.userId]);
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      return res.status(401).json({ error: 'Invalid refresh session' });
    }
    
    const result = await query('SELECT id, username FROM users WHERE id = $1', [payload.userId]);
    
    if (result.rows.length === 0) {
      await query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    const newSessionId = uuidv4();
    const newAccessToken = JWTService.generateAccessToken(user.id, user.username);
    const newRefreshToken = JWTService.generateRefreshToken(user.id, newSessionId);
    const newRefreshHash = hashToken(newRefreshToken);
    const newExpiresAt = buildRefreshExpiry(newRefreshToken);

    await query('BEGIN');
    try {
      await query(
        `UPDATE auth_sessions
         SET revoked_at = NOW(), replaced_by_session_id = $1
         WHERE id = $2`,
        [newSessionId, session.id]
      );

      await query(
        `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newSessionId, user.id, newRefreshHash, req.ip || null, req.get('user-agent') || null, newExpiresAt]
      );
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK');
      throw e;
    }

    res.cookie(REFRESH_COOKIE, newRefreshToken, refreshCookieOptions);

    res.json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const refreshToken = readRefreshToken(req);
  
  if (refreshToken) {
    try {
      const payload = JWTService.verifyRefreshToken(refreshToken);
      if (payload.sessionId) {
        await query(
          'UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2',
          [payload.sessionId, payload.userId]
        );
      }
    } catch {}
  }
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  
  res.json({ success: true });
});

// Get current user
router.get('/me', JWTService.middleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, balance, demo_balance, is_demo_mode, role FROM users WHERE id = $1',
      [(req as any).userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    res.json({
      user: {
        id: u.id, username: u.username,
        balance: u.balance, demoBalance: u.demo_balance,
        isDemoMode: u.is_demo_mode, role: u.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
