import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { pool } from './config/database.js';
import { connectRedis } from './config/redis.js';

// Routes and services loaded AFTER migration (dynamic imports in startServer)

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);

const ORIGIN_LOCK_SECRET = process.env.ORIGIN_LOCK_SECRET?.trim() || '';
const TRUSTED_PROXY_IPS = new Set(
  (process.env.TRUSTED_PROXY_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);
const ORIGIN_LOCK_EXEMPT_PATHS = new Set(
  (process.env.ORIGIN_LOCK_EXEMPT_PATHS || '/health,/api/webhook')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
);

const normalizeIp = (ip: string | undefined): string => {
  if (!ip) return '';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};

const isTrustedProxy = (ip: string): boolean => {
  if (!ip) return false;
  if (TRUSTED_PROXY_IPS.size === 0) return true;
  return TRUSTED_PROXY_IPS.has(ip);
};

const isOriginLockedRequestAllowed = (path: string, ip: string, originHeader: string | undefined): boolean => {
  if (!ORIGIN_LOCK_SECRET) return true; // Disabled unless secret is configured
  if (ORIGIN_LOCK_EXEMPT_PATHS.has(path)) return true;
  if (!isTrustedProxy(ip)) return false;
  return originHeader === ORIGIN_LOCK_SECRET;
};

// WebSocket Server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
let wsGameServer: any = null;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Origin lock: blocks direct-to-origin traffic unless request comes via trusted proxy
// and carries the shared secret header set by the proxy.
app.use((req, res, next) => {
  const remoteIp = normalizeIp(req.socket.remoteAddress);
  const originVerify = req.header('x-origin-verify');
  const allowed = isOriginLockedRequestAllowed(req.path, remoteIp, originVerify);

  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes registered dynamically after DB migration (see startServer)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');

  // Close WebSocket server
  if (wsGameServer) wsGameServer.shutdown();
  wss.close();

  // Close database connections
  await pool.end();

  // Close HTTP server
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Enforce origin lock for WebSocket upgrades as well.
httpServer.on('upgrade', (req, socket) => {
  if (!ORIGIN_LOCK_SECRET) return;
  const remoteIp = normalizeIp(req.socket.remoteAddress);
  const originVerify = req.headers['x-origin-verify'];
  const originHeader = Array.isArray(originVerify) ? originVerify[0] : originVerify;
  const path = req.url ? req.url.split('?')[0] : '';

  const allowed = isOriginLockedRequestAllowed(path, remoteIp, originHeader);
  if (allowed) return;

  socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  socket.destroy();
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connected');

    // Auto-create tables if they don't exist (first deploy)
    const tableCheck = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')`);
    if (!tableCheck.rows[0].exists) {
      console.log('⚡ First deploy detected — creating database tables...');
      const fs = await import('fs');
      const path = await import('path');
      const schemaPath = path.join(import.meta.dirname || '.', '..', 'database', 'schema.sql');
      try {
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        await pool.query(schema);
        console.log('✓ Database tables created successfully');
      } catch (schemaErr) {
        console.error('⚠ Schema file not found or failed, trying inline migration...');
        // Minimal inline migration for core tables
        await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username VARCHAR(32) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            balance BIGINT DEFAULT 0,
            demo_balance BIGINT DEFAULT 100000000,
            is_demo_mode BOOLEAN DEFAULT TRUE,
            phone VARCHAR(15),
            email VARCHAR(100),
            role VARCHAR(20) DEFAULT 'user',
            last_nonce INTEGER DEFAULT 0,
            total_wagered BIGINT DEFAULT 0,
            total_won BIGINT DEFAULT 0,
            total_lost BIGINT DEFAULT 0,
            is_banned BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
          )
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS auth_sessions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            refresh_token_hash VARCHAR(128) NOT NULL,
            ip_address VARCHAR(64),
            user_agent TEXT,
            replaced_by_session_id UUID,
            revoked_at TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS game_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_type VARCHAR(30) NOT NULL,
            bet_amount BIGINT NOT NULL,
            multiplier NUMERIC(10, 4),
            payout BIGINT,
            profit BIGINT,
            result VARCHAR(10),
            client_seed VARCHAR(64),
            server_seed_hash VARCHAR(64),
            server_seed_revealed VARCHAR(64),
            nonce INTEGER,
            provably_fair_seed_id UUID,
            game_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await pool.query(`CREATE TABLE IF NOT EXISTS transactions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(30) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          amount BIGINT NOT NULL,
          fee BIGINT DEFAULT 0,
          net_amount BIGINT NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          balance_before BIGINT,
          balance_after BIGINT,
          reference_id UUID,
          reference_type VARCHAR(30),
          description TEXT,
          metadata JSONB,
          is_demo BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('✓ Core tables created via inline migration');
      }
    } else {
      console.log('✓ Database tables already exist');
    }

    // Connect to Redis
    await connectRedis();

    // NOW load services and routes (after DB tables exist)
    const { WebSocketGameServer } = await import('./services/WebSocketGameServer.js');
    const { balanceSyncService } = await import('./services/BalanceSyncService.js');
    const { withdrawalService } = await import('./services/WithdrawalService.js');

    wsGameServer = new WebSocketGameServer(wss);

    const authRoutes = (await import('./routes/auth.js')).default;
    const gameRoutes = (await import('./routes/game.js')).default;
    const leaderboardRoutes = (await import('./routes/leaderboard.js')).default;
    const agentRoutes = (await import('./routes/agent.js')).default;
    const depositMod = await import('./routes/deposit.js');
    const depositRoutes = depositMod.default;
    const webhookRouter = depositMod.webhookRouter;
    const withdrawalRoutes = (await import('./routes/withdrawal.js')).default;
    const adminRoutes = (await import('./routes/admin.js')).default;
    const userRoutes = (await import('./routes/user.js')).default;
    const noticesRoutes = (await import('./routes/notices.js')).default;

    app.use('/api/auth', authRoutes);
    app.use('/api/game', gameRoutes);
    app.use('/api/leaderboard', leaderboardRoutes);
    app.use('/api/agent', agentRoutes);
    app.use('/api/deposit', depositRoutes);
    app.use('/api/webhook', webhookRouter);
    app.use('/api/withdrawal', withdrawalRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/notices', noticesRoutes);

    // Keep users.balance and INR wallet balance aligned for all game/payment flows.
    await balanceSyncService.ensureInitialized();

    // Start background withdrawal processor.
    withdrawalService.start();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ WebSocket server running on ws://localhost:${PORT}/ws`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, httpServer, wss };
