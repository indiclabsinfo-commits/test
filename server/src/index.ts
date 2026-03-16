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
import { WebSocketGameServer } from './services/WebSocketGameServer.js';
import { withdrawalService } from './services/WithdrawalService.js';
import { balanceSyncService } from './services/BalanceSyncService.js';

// Import routes
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';
import leaderboardRoutes from './routes/leaderboard.js';
import agentRoutes from './routes/agent.js';
import depositRoutes, { webhookRouter } from './routes/deposit.js';
import withdrawalRoutes from './routes/withdrawal.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import noticesRoutes from './routes/notices.js';

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
const wsGameServer = new WebSocketGameServer(wss);

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

// API Routes
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
  wsGameServer.shutdown();
  wss.close();

  withdrawalService.stop();

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

    // Connect to Redis
    await connectRedis();

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
