import { Router, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { JWTService } from '../utils/jwt.js';
import { query } from '../config/database.js';
import { withdrawalService } from '../services/WithdrawalService.js';
import { agentService } from '../services/AgentService.js';
import { bankAccountService } from '../services/BankAccountService.js';
import { economyRuntimeService } from '../services/EconomyRuntimeService.js';

const router = Router();

// Admin auth middleware: user JWT + role check
const adminAuth = async (req: any, res: any, next: any) => {
  // First apply JWT middleware
  JWTService.middleware(req, res, async () => {
    try {
      const result = await query('SELECT role FROM users WHERE id = $1', [req.userId]);
      if (result.rows.length === 0 || !['admin', 'superadmin'].includes(result.rows[0].role)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      req.userRole = result.rows[0].role;
      next();
    } catch {
      return res.status(500).json({ error: 'Auth check failed' });
    }
  });
};

router.use(adminAuth);

// ============================================
// WITHDRAWAL MANAGEMENT
// ============================================

router.get('/withdrawals/pending', async (_req, res) => {
  try {
    const requests = await withdrawalService.getPendingRequests();
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pending withdrawals' });
  }
});

router.post('/withdrawals/:id/approve', async (req: any, res) => {
  try {
    const result = await withdrawalService.approveWithdrawal(req.params.id, req.userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

router.post('/withdrawals/:id/reject', [
  body('reason').trim().notEmpty(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Reason is required' });
  }
  try {
    const result = await withdrawalService.rejectWithdrawal(req.params.id, req.userId, req.body.reason);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

// ============================================
// QR DEPOSIT MANAGEMENT
// ============================================

router.get('/deposits/qr/pending', async (_req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.user_id, u.username, d.amount, d.status, d.utr_number, d.created_at, d.user_paid_at
       FROM deposit_orders d
       JOIN users u ON u.id = d.user_id
       WHERE d.method = 'qr' AND d.status IN ('assigned', 'user_paid', 'pending')
       ORDER BY d.created_at ASC
       LIMIT 100`
    );
    res.json({ orders: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load pending QR deposits' });
  }
});

router.post('/deposits/qr/:id/approve', async (req: any, res) => {
  try {
    const paymentId = `manual_${Date.now()}_${req.userId?.slice?.(0, 8) || 'admin'}`;
    const result = await bankAccountService.processWebhook(req.params.id, paymentId, 'success');
    if (!result.success) {
      return res.status(400).json({ error: 'Order not found or already processed' });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to approve QR deposit' });
  }
});

router.post('/deposits/qr/:id/reject', [
  body('reason').optional().trim().isLength({ min: 3, max: 200 }),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid reason' });
  try {
    const result = await bankAccountService.rejectQRDeposit(req.params.id, req.body.reason);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to reject QR deposit' });
  }
});

// ============================================
// AGENT MANAGEMENT
// ============================================

router.get('/agents', async (_req, res) => {
  try {
    const agents = await agentService.listAgents();
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

router.post('/agents', [
  body('username').trim().isLength({ min: 3, max: 32 }),
  body('password').isLength({ min: 6 }),
  body('displayName').trim().notEmpty(),
  body('upiId').optional().trim(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  try {
    const result = await agentService.createAgent(req.body);
    res.json({ success: true, agentId: result.id });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Agent username already exists' });
    }
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

router.put('/agents/:id', async (req: any, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive === 'boolean') {
      await agentService.setActive(req.params.id, isActive);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// ============================================
// BANK ACCOUNT MANAGEMENT
// ============================================

router.get('/bank-accounts', async (_req, res) => {
  try {
    const accounts = await bankAccountService.listAccounts();
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list bank accounts' });
  }
});

router.post('/bank-accounts', [
  body('label').trim().notEmpty(),
  body('upiId').trim().notEmpty(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  try {
    const result = await bankAccountService.createAccount(req.body);
    res.json({ success: true, accountId: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

router.put('/bank-accounts/:id', [
  body('label').optional().trim().notEmpty(),
  body('upiId').optional().trim().notEmpty(),
  body('priority').optional().isInt({ min: 0 }),
  body('dailyLimit').optional().isInt({ min: 10000000 }),
  body('isActive').optional().isBoolean(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  try {
    const ok = await bankAccountService.updateAccount(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bank account' });
  }
});

router.post('/bank-accounts/:id/primary', async (req: any, res: Response) => {
  try {
    const ok = await bankAccountService.setPrimaryAccount(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set primary bank account' });
  }
});

// ============================================
// ECONOMY / RTP MANAGEMENT
// ============================================

router.get('/economy/configs', async (_req, res) => {
  try {
    const configs = await economyRuntimeService.listConfigs();
    res.json({ configs });
  } catch {
    res.status(500).json({ error: 'Failed to list economy configs' });
  }
});

router.put('/economy/configs/:gameType', [
  body('rtpFactor').isFloat({ min: 0.7, max: 0.99 }),
  body('enabled').optional().isBoolean(),
  body('startsAt').optional({ nullable: true }).isString(),
  body('endsAt').optional({ nullable: true }).isString(),
  body('note').optional({ nullable: true }).isString(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

  try {
    await economyRuntimeService.upsertConfig(req.params.gameType, {
      rtpFactor: Number(req.body.rtpFactor),
      enabled: req.body.enabled,
      startsAt: req.body.startsAt ?? null,
      endsAt: req.body.endsAt ?? null,
      note: req.body.note ?? null,
      updatedBy: req.userId || null,
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update economy config' });
  }
});

router.get('/economy/ludo-payouts', async (_req, res) => {
  try {
    const configs = await economyRuntimeService.listLudoPayoutConfigs();
    res.json({ configs });
  } catch {
    res.status(500).json({ error: 'Failed to list ludo payout configs' });
  }
});

router.put('/economy/ludo-payouts/:playerCount', [
  body('rankSplits').isArray({ min: 2, max: 4 }),
  body('rankSplits.*').isFloat({ min: 0, max: 1 }),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });
  try {
    const playerCount = Number(req.params.playerCount);
    const rankSplits = req.body.rankSplits as number[];
    const normalized = await economyRuntimeService.upsertLudoPayoutConfig(playerCount, rankSplits, req.userId || null);
    res.json({ success: true, playerCount, rankSplits: normalized });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update ludo payout config' });
  }
});

router.get('/economy/ludo-preview', async (req, res) => {
  try {
    const playerCountRaw = Number(req.query.playerCount || 4);
    const playerCount = [2, 3, 4].includes(playerCountRaw) ? playerCountRaw : 4;
    const entryFee = Math.max(1, Math.floor(Number(req.query.entryFee || 100)));
    const matchesPerDay = Math.max(1, Math.floor(Number(req.query.matchesPerDay || 20)));

    const rtp = await economyRuntimeService.getRtpFactor('ludo');
    const houseEdge = Math.max(0, 1 - rtp);
    const splits = await economyRuntimeService.getLudoPayoutSplits(playerCount);

    const totalPool = entryFee * playerCount;
    const houseFee = Math.floor(totalPool * houseEdge);
    const prizePool = totalPool - houseFee;

    const rankPayouts: number[] = [];
    let distributed = 0;
    for (let i = 0; i < playerCount; i++) {
      const isLast = i === playerCount - 1;
      const payout = isLast
        ? Math.max(0, prizePool - distributed)
        : Math.floor(prizePool * (splits[i] || 0));
      distributed += payout;
      rankPayouts.push(payout);
    }

    res.json({
      playerCount,
      entryFee,
      matchesPerDay,
      rtp,
      houseEdge,
      totalPool,
      houseFee,
      prizePool,
      rankSplits: splits,
      rankPayouts,
      housePerMatch: houseFee,
      housePerDay: houseFee * matchesPerDay,
      positionSummary: rankPayouts.map((amount, idx) => ({ position: idx + 1, amount })),
    });
  } catch {
    res.status(500).json({ error: 'Failed to generate ludo preview' });
  }
});

// ============================================
// NOTICES / ADS MANAGEMENT
// ============================================

router.get('/notices', async (_req, res) => {
  try {
    const notices = await economyRuntimeService.listNotices(true);
    res.json({ notices });
  } catch {
    res.status(500).json({ error: 'Failed to list notices' });
  }
});

router.post('/notices', [
  body('title').trim().isLength({ min: 3, max: 160 }),
  body('message').trim().isLength({ min: 3, max: 4000 }),
  body('startsAt').optional({ nullable: true }).isString(),
  body('endsAt').optional({ nullable: true }).isString(),
  body('isActive').optional().isBoolean(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });
  try {
    const result = await economyRuntimeService.createNotice({
      title: req.body.title,
      message: req.body.message,
      startsAt: req.body.startsAt ?? null,
      endsAt: req.body.endsAt ?? null,
      isActive: req.body.isActive ?? true,
      createdBy: req.userId || null,
    });
    res.json({ success: true, noticeId: result.id });
  } catch {
    res.status(500).json({ error: 'Failed to create notice' });
  }
});

router.put('/notices/:id', [
  body('isActive').isBoolean(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });
  try {
    const ok = await economyRuntimeService.updateNotice(req.params.id, { isActive: req.body.isActive });
    if (!ok) return res.status(404).json({ error: 'Notice not found' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update notice' });
  }
});

// ============================================
// PLATFORM STATS
// ============================================

router.get('/stats', async (_req, res) => {
  try {
    const [users, deposits, withdrawals, agents, houseWallets] = await Promise.all([
      query(`SELECT COUNT(*) as total,
                    SUM(CASE WHEN is_demo_mode = FALSE THEN 1 ELSE 0 END) as real_users,
                    SUM(balance) as total_balance
             FROM users`),
      query(`SELECT COUNT(*) as total,
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_volume,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'pending' OR status = 'assigned' OR status = 'user_paid' THEN 1 END) as pending
             FROM deposit_orders`),
      query(`SELECT COUNT(*) as total,
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_volume,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved
             FROM withdrawal_requests`),
      query(`SELECT COUNT(*) as total,
                    COUNT(CASE WHEN is_online = TRUE THEN 1 END) as online
             FROM agents WHERE is_active = TRUE`),
      query('SELECT currency, balance FROM house_wallets'),
    ]);

    res.json({
      users: users.rows[0],
      deposits: deposits.rows[0],
      withdrawals: withdrawals.rows[0],
      agents: agents.rows[0],
      houseWallets: houseWallets.rows,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Per-game P&L stats (house perspective)
router.get('/stats/games', async (req: any, res) => {
  try {
    const daysRaw = parseInt(req.query.days, 10);
    const days = Number.isFinite(daysRaw) ? Math.min(60, Math.max(1, daysRaw)) : 7;

    const [todaySummary, byGameToday, trend] = await Promise.all([
      query(
        `SELECT
            COUNT(*) as rounds,
            COALESCE(SUM(bet_amount), 0) as wagered,
            COALESCE(SUM(payout), 0) as payout,
            COALESCE(SUM(profit), 0) as player_net,
            COALESCE(SUM(-profit), 0) as house_net
         FROM game_sessions
         WHERE created_at >= date_trunc('day', NOW())`
      ),
      query(
        `SELECT
            game_type,
            COUNT(*) as rounds,
            COALESCE(SUM(bet_amount), 0) as wagered,
            COALESCE(SUM(payout), 0) as payout,
            COALESCE(SUM(profit), 0) as player_net,
            COALESCE(SUM(-profit), 0) as house_net
         FROM game_sessions
         WHERE created_at >= date_trunc('day', NOW())
         GROUP BY game_type
         ORDER BY house_net DESC, rounds DESC`
      ),
      query(
        `SELECT
            to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
            game_type,
            COUNT(*) as rounds,
            COALESCE(SUM(bet_amount), 0) as wagered,
            COALESCE(SUM(-profit), 0) as house_net
         FROM game_sessions
         WHERE created_at >= date_trunc('day', NOW()) - ($1::int - 1) * interval '1 day'
         GROUP BY day, game_type
         ORDER BY day DESC, game_type ASC`,
        [days]
      ),
    ]);

    res.json({
      days,
      today: todaySummary.rows[0],
      byGameToday: byGameToday.rows,
      trend: trend.rows,
    });
  } catch (err) {
    console.error('Admin game stats error:', err);
    res.status(500).json({ error: 'Failed to get game stats' });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

router.get('/users', async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = await query(
      `SELECT id, username, balance, demo_balance, is_demo_mode, role, is_active, created_at, last_seen
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await query('SELECT COUNT(*) FROM users');
    res.json({ users: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Toggle demo mode for a user
router.post('/users/:id/toggle-mode', async (req: any, res) => {
  try {
    const result = await query(
      'UPDATE users SET is_demo_mode = NOT is_demo_mode WHERE id = $1 RETURNING is_demo_mode',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, isDemoMode: result.rows[0].is_demo_mode });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle mode' });
  }
});

// Set user role
router.post('/users/:id/role', [
  body('role').isIn(['user', 'admin', 'superadmin']),
], async (req: any, res: Response) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin required' });
  }
  try {
    await query('UPDATE users SET role = $1 WHERE id = $2', [req.body.role, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ============================================
// TRANSACTIONS
// ============================================

router.get('/transactions', async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type as string;

    let sql = `SELECT t.*, u.username
               FROM transactions t
               JOIN users u ON t.user_id = u.id`;
    const params: any[] = [];

    if (type) {
      sql += ' WHERE t.type = $1';
      params.push(type);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

export default router;
