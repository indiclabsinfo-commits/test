import jwt, { type SignOptions } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const jwtSecretRaw = process.env.JWT_SECRET;
const jwtRefreshSecretRaw = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!jwtSecretRaw || !jwtRefreshSecretRaw) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set');
}
const JWT_SECRET: string = jwtSecretRaw;
const JWT_REFRESH_SECRET: string = jwtRefreshSecretRaw;

export interface TokenPayload {
  userId: string;
  email?: string;
  username: string;
  vipTier: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId?: string;
}

const ACCESS_TOKEN_OPTIONS: SignOptions = {
  expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
  issuer: 'tacticash-arena',
  audience: 'tacticash-client',
};

const REFRESH_TOKEN_OPTIONS: SignOptions = {
  expiresIn: JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  issuer: 'tacticash-arena',
  audience: 'tacticash-client',
};

export class JWTService {
  static generateAccessToken(userId: string, username: string, vipTier = 'BRONZE'): string {
    return jwt.sign({ userId, username, vipTier }, JWT_SECRET, ACCESS_TOKEN_OPTIONS);
  }

  static generateRefreshToken(userId: string, sessionId?: string): string {
    const payload: RefreshTokenPayload = sessionId ? { userId, sessionId } : { userId };
    return jwt.sign(payload, JWT_REFRESH_SECRET, REFRESH_TOKEN_OPTIONS);
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'tacticash-arena',
        audience: 'tacticash-client'
      }) as unknown as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET, {
        issuer: 'tacticash-arena',
        audience: 'tacticash-client'
      }) as unknown as RefreshTokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  static middleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = this.verifyAccessToken(token);
      (req as any).userId = decoded.userId;
      (req as any).username = decoded.username;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}

export default JWTService;
