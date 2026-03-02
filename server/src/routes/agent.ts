import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { agentService, AgentService } from '../services/AgentService.js';
import { depositOrderService } from '../services/DepositOrderService.js';

const router = Router();

// Agent login
router.post('/login', [
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const result = await agentService.authenticate(req.body.username, req.body.password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json(result);
  } catch (err) {
    console.error('Agent login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Protected agent routes ---

// Get pending orders
router.get('/orders', AgentService.middleware, async (req: any, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const orders = await depositOrderService.getAgentOrders(req.agentId, status);
    res.json({ orders });
  } catch (err) {
    console.error('Get agent orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Verify payment
router.post('/orders/:id/verify', AgentService.middleware, async (req: any, res: Response) => {
  try {
    const result = await depositOrderService.verifyPayment(req.params.id, req.agentId, true);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, userId: result.userId, amount: result.amount });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Reject payment
router.post('/orders/:id/reject', AgentService.middleware, [
  body('reason').optional().trim(),
], async (req: any, res: Response) => {
  try {
    const result = await depositOrderService.verifyPayment(
      req.params.id, req.agentId, false, req.body.reason
    );
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Reject payment error:', err);
    res.status(500).json({ error: 'Rejection failed' });
  }
});

// Agent stats
router.get('/stats', AgentService.middleware, async (req: any, res: Response) => {
  try {
    const stats = await agentService.getStats(req.agentId);
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Go online/offline
router.post('/status', AgentService.middleware, async (req: any, res: Response) => {
  try {
    const { online } = req.body;
    await agentService.setOnline(req.agentId, !!online);
    res.json({ success: true, online: !!online });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
