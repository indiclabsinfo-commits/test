import { Router, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { JWTService } from '../utils/jwt.js';
import { withdrawalService } from '../services/WithdrawalService.js';

const router = Router();

router.use(JWTService.middleware);

// Request withdrawal
router.post('/request', [
  body('amount').isInt({ min: 1 }),
  body('currency').isIn(['INR', 'BTC', 'XMR', 'USDT_POLYGON']),
  body('method').isIn(['upi', 'bank', 'btc', 'xmr', 'usdt_polygon']),
  body('destination').trim().notEmpty(),
], async (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input', details: errors.array() });
  }

  try {
    const { amount, currency, method, destination, destinationDetails } = req.body;
    const result = await withdrawalService.requestWithdrawal(
      req.userId, currency, amount, method, destination, destinationDetails
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, requestId: result.requestId });
  } catch (err) {
    console.error('Withdrawal request error:', err);
    res.status(500).json({ error: 'Failed to create withdrawal' });
  }
});

// Withdrawal history
router.get('/history', async (req: any, res: Response) => {
  try {
    const withdrawals = await withdrawalService.getUserWithdrawals(req.userId);
    res.json({ withdrawals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get fees and minimums
router.get('/fees', async (_req, res) => {
  res.json({
    fees: withdrawalService.getWithdrawalFees(),
    minimums: withdrawalService.getMinimumWithdrawals(),
  });
});

export default router;
