import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email?: string;
  username: string;
  vipTier: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

export class JWTService {
  /**
   * Generate access token
   */
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'tacticash-arena',
      audience: 'tacticash-client'
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'tacticash-arena',
      audience: 'tacticash-client'
    });
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'tacticash-arena',
        audience: 'tacticash-client'
      }) as TokenPayload;
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
      }) as RefreshTokenPayload;
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

  /**
   * Generate token pair (access + refresh)
   */
  static generateTokenPair(
    userPayload: TokenPayload,
    sessionId: string
  ): { accessToken: string; refreshToken: string } {
    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = this.generateRefreshToken({
      userId: userPayload.userId,
      sessionId
    });

    return { accessToken, refreshToken };
  }
}

export default JWTService;
