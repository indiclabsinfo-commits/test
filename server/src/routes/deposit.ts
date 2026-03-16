import { Router, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { JWTService } from '../utils/jwt.js';
import { depositOrderService } from '../services/DepositOrderService.js';

const router = Router();

// All deposit routes require user auth
router.use(JWTService.middleware);

// ============================================
// P2P AGENT DEPOSIT
// ============================================

// Create agent deposit order
router.post('/agent/create', [
  body('amount').isInt({ min: 10000000, max: 5000000000 }),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const result = await depositOrderService.createAgentDeposit(req.userId, req.body.amount);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ order: result.order });
  } catch (err) {
    console.error('Create agent deposit error:', err);
    res.status(500).json({ error: 'Failed to create deposit' });
  }
});

// Mark deposit as paid (user provides UTR)
router.post('/agent/:id/paid', [
  body('utrNumber').trim().isLength({ min: 6, max: 30 }),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid UTR number' });
  }

  try {
    const result = await depositOrderService.markPaid(req.params.id, req.userId, req.body.utrNumber);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Get order status
router.get('/agent/:id', async (req: any, res: Response) => {
  try {
    const order = await depositOrderService.getOrderStatus(req.params.id, req.userId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// ============================================
// QR DEPOSIT
// ============================================

router.post('/qr/create', [
  body('amount').isInt({ min: 10000000 }),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid amount (min 100 INR)' });
  }

  try {
    const { bankAccountService } = await import('../services/BankAccountService.js');
    const result = await bankAccountService.createQRDeposit(req.userId, req.body.amount);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ order: result.order });
  } catch (err) {
    console.error('Create QR deposit error:', err);
    res.status(500).json({ error: 'Failed to create QR deposit' });
  }
});

router.post('/qr/:id/paid', [
  body('utrNumber').optional().trim().isLength({ min: 6, max: 30 }),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid UTR number' });
  }

  try {
    const { bankAccountService } = await import('../services/BankAccountService.js');
    const result = await bankAccountService.markQRPaid(req.params.id, req.userId, req.body.utrNumber);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Mark QR paid error:', err);
    res.status(500).json({ error: 'Failed to mark payment' });
  }
});

// ============================================
// CRYPTO DEPOSIT
// ============================================

router.get('/crypto/address', async (req: any, res: Response) => {
  const currency = req.query.currency as string;
  if (!currency || !['BTC', 'XMR', 'USDT_POLYGON'].includes(currency)) {
    return res.status(400).json({ error: 'Invalid currency. Use BTC, XMR, or USDT_POLYGON' });
  }

  try {
    const { paymentProcessor } = await import('../services/PaymentProcessor.js');
    const address = await paymentProcessor.getDepositAddress(req.userId, currency);
    res.json({ address, currency });
  } catch (err) {
    console.error('Get crypto address error:', err);
    res.status(500).json({ error: 'Failed to get deposit address' });
  }
});

// ============================================
// DEPOSIT HISTORY
// ============================================

router.get('/history', async (req: any, res: Response) => {
  try {
    const deposits = await depositOrderService.getUserDeposits(req.userId);
    res.json({ deposits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get deposit history' });
  }
});

// ============================================
// WEBHOOK (no auth - called by payment provider)
// This is mounted separately in index.ts
// ============================================
export const webhookRouter = Router();

webhookRouter.post('/deposit/webhook', async (req, res) => {
  try {
    const { orderId, paymentId, status, signature } = req.body;

    if (!orderId || !paymentId || !status) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Verify webhook signature (mock for now)
    const { mockProvider } = await import('../services/payment-providers/MockProvider.js');
    const payload = { orderId, paymentId, status };
    if (signature && !mockProvider.verifyWebhook(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { bankAccountService } = await import('../services/BankAccountService.js');
    const result = await bankAccountService.processWebhook(orderId, paymentId, status);

    res.json({ success: result.success });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
