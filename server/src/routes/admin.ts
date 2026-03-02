import { Router, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { JWTService } from '../utils/jwt.js';
import { query } from '../config/database.js';
import { withdrawalService } from '../services/WithdrawalService.js';
import { agentService } from '../services/AgentService.js';
import { bankAccountService } from '../services/BankAccountService.js';

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
