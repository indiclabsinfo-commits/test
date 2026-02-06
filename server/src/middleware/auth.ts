import { Request, Response, NextFunction } from 'express';
import { JWTService, TokenPayload } from '../utils/jwt.js';
import { query } from '../config/database.js';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

/**
 * Middleware to verify JWT token
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = JWTService.verifyAccessToken(token);

      // Verify user still exists and is active
      const userResult = await query(
        'SELECT id, is_active, is_banned FROM users WHERE id = $1',
        [payload.userId]
      );

      if (userResult.rows.length === 0) {
        res.status(401).json({ error: 'User not found' });
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

      req.user = payload;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
    return;
  }
};

/**
 * Middleware to check if user has sufficient balance
 */
export const checkBalance = (minAmount: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await query(
        'SELECT balance FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (result.rows.length === 0 || result.rows[0].balance < minAmount) {
        res.status(400).json({ error: 'Insufficient balance' });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Balance check failed' });
      return;
    }
  };
};

/**
 * Middleware to check VIP tier
 */
export const checkVIPTier = (requiredTiers: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!requiredTiers.includes(req.user.vipTier)) {
        res.status(403).json({ error: 'VIP tier required' });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'VIP check failed' });
      return;
    }
  };
};

/**
 * Middleware to check responsible gaming limits
 */
export const checkGamingLimits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check for active self-exclusion
    const exclusionResult = await query(
      `SELECT * FROM self_exclusions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()`,
      [req.user.userId]
    );

    if (exclusionResult.rows.length > 0) {
      res.status(403).json({
        error: 'Account is self-excluded',
        expiresAt: exclusionResult.rows[0].expires_at
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Gaming limits check failed' });
    return;
  }
};

export default { authenticate, checkBalance, checkVIPTier, checkGamingLimits };
