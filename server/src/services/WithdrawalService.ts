import { query } from '../config/database.js';
import * as crypto from 'crypto';

/**
 * Withdrawal Service
 * Handles withdrawal requests with admin approval flow
 * Supports: UPI/Bank (INR), BTC, XMR, USDT (Polygon)
 */

export class WithdrawalService {
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  // Fee config (internal units)
  private readonly FEES: Record<string, number> = {
    INR: 0,                // No fee for INR withdrawals
    BTC: 5000,             // ~0.00005 BTC
    XMR: 5000,             // ~0.000005 XMR
    USDT_POLYGON: 100000,  // ~0.1 USDT
  };

  // Minimum withdrawals (internal units)
  private readonly MIN_WITHDRAWAL: Record<string, number> = {
    INR: 50000000,         // 500.00 INR
    BTC: 10000,            // 0.0001 BTC
    XMR: 100000000,        // 0.1 XMR
    USDT_POLYGON: 1000000, // 1 USDT
  };

  constructor() {}

  start(): void {
    console.log('Withdrawal Service started');
    // Process approved withdrawals every minute
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processApproved();
      }
    }, 60000);
  }

  stop(): void {
    if (this.processingInterval) clearInterval(this.processingInterval);
    console.log('Withdrawal Service stopped');
  }

  // ============================================
  // REQUEST WITHDRAWAL
  // ============================================

  async requestWithdrawal(
    userId: string,
    currency: string,
    amount: number,
    method: string,
    destination: string,
    destinationDetails?: any
  ): Promise<{ success: boolean; error?: string; requestId?: string }> {
    const fee = this.FEES[currency] || 0;
    const minAmount = this.MIN_WITHDRAWAL[currency];

    if (!minAmount) {
      return { success: false, error: 'Unsupported currency' };
    }
    if (amount < minAmount) {
      return { success: false, error: `Minimum withdrawal: ${minAmount}` };
    }

    const totalDeduction = amount + fee;
    const netAmount = amount - fee;

    await query('BEGIN');
    try {
      // Lock user row and check balance
      const userResult = await query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (userResult.rows.length === 0) {
        await query('ROLLBACK');
        return { success: false, error: 'User not found' };
      }

      const balance = Number(userResult.rows[0].balance);
      if (balance < totalDeduction) {
        await query('ROLLBACK');
        return { success: false, error: 'Insufficient balance' };
      }

      // Deduct from balance
      await query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [totalDeduction, userId]
      );

      // Create withdrawal request (pending admin approval)
      const result = await query(
        `INSERT INTO withdrawal_requests (
          user_id, amount, fee, net_amount, currency, method,
          destination, destination_details, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING id`,
        [userId, amount, fee, netAmount, currency, method, destination,
         destinationDetails ? JSON.stringify(destinationDetails) : null]
      );

      const requestId = result.rows[0].id;

      // Create transaction record
      await query(
        `INSERT INTO transactions (
          user_id, type, status, amount, fee, net_amount, currency,
          balance_before, balance_after, reference_id, reference_type, description
        ) VALUES ($1, 'withdrawal', 'pending', $2, $3, $4, $5, $6, $7, $8, 'withdrawal', $9)`,
        [userId, amount, fee, netAmount, currency, balance, balance - totalDeduction,
         requestId, `${method} withdrawal to ${destination}`]
      );

      await query('COMMIT');
      return { success: true, requestId };
    } catch (err) {
      await query('ROLLBACK');
      console.error('Withdrawal request error:', err);
      return { success: false, error: 'Internal error' };
    }
  }

  // ============================================
  // ADMIN APPROVAL
  // ============================================

  async approveWithdrawal(requestId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const result = await query(
      `UPDATE withdrawal_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING id`,
      [adminId, requestId]
    );
    if (result.rows.length === 0) {
      return { success: false, error: 'Request not found or already processed' };
    }

    // Update related transaction
    await query(
      `UPDATE transactions SET status = 'processing', updated_at = NOW()
       WHERE reference_id = $1 AND reference_type = 'withdrawal'`,
      [requestId]
    );

    return { success: true };
  }

  async rejectWithdrawal(
    requestId: string, adminId: string, reason: string
  ): Promise<{ success: boolean; error?: string }> {
    await query('BEGIN');
    try {
      const result = await query(
        `UPDATE withdrawal_requests
         SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
             rejection_reason = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'pending'
         RETURNING user_id, amount, fee`,
        [adminId, reason, requestId]
      );

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return { success: false, error: 'Request not found or already processed' };
      }

      const { user_id, amount, fee } = result.rows[0];
      const totalRefund = Number(amount) + Number(fee);

      // Refund user balance
      await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [totalRefund, user_id]);

      // Update transaction
      await query(
        `UPDATE transactions SET status = 'cancelled', updated_at = NOW()
         WHERE reference_id = $1 AND reference_type = 'withdrawal'`,
        [requestId]
      );

      await query('COMMIT');
      return { success: true };
    } catch (err) {
      await query('ROLLBACK');
      console.error('Reject withdrawal error:', err);
      return { success: false, error: 'Internal error' };
    }
  }

  // ============================================
  // PROCESS APPROVED WITHDRAWALS
  // ============================================

  private async processApproved(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pending = await query(
        `SELECT * FROM withdrawal_requests
         WHERE status = 'approved'
         ORDER BY created_at ASC LIMIT 10`
      );

      for (const wr of pending.rows) {
        await this.processSingleWithdrawal(wr);
      }
    } catch (err) {
      console.error('Process withdrawals error:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleWithdrawal(wr: any): Promise<void> {
    try {
      // Check house wallet
      const houseResult = await query(
        'SELECT balance FROM house_wallets WHERE currency = $1',
        [wr.currency]
      );
      const houseBalance = Number(houseResult.rows[0]?.balance || 0);
      if (houseBalance < Number(wr.net_amount)) {
        console.error(`Insufficient house funds for ${wr.currency} withdrawal ${wr.id}`);
        return; // Will retry next cycle
      }

      // Simulate tx (real implementation: sign and broadcast)
      const txHash = `${wr.currency}_${crypto.randomBytes(32).toString('hex')}`;

      await query('BEGIN');

      // Mark completed
      await query(
        `UPDATE withdrawal_requests SET status = 'completed', tx_hash = $1, updated_at = NOW()
         WHERE id = $2`,
        [txHash, wr.id]
      );

      // Update transaction
      await query(
        `UPDATE transactions SET status = 'completed', tx_hash = $1, updated_at = NOW()
         WHERE reference_id = $2 AND reference_type = 'withdrawal'`,
        [txHash, wr.id]
      );

      // Deduct house wallet
      await query(
        'UPDATE house_wallets SET balance = balance - $1, updated_at = NOW() WHERE currency = $2',
        [wr.net_amount, wr.currency]
      );

      await query('COMMIT');
      console.log(`Withdrawal ${wr.id} processed: ${txHash}`);
    } catch (err) {
      await query('ROLLBACK');
      console.error(`Failed to process withdrawal ${wr.id}:`, err);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async getPendingRequests(limit = 50): Promise<any[]> {
    const result = await query(
      `SELECT wr.*, u.username
       FROM withdrawal_requests wr
       JOIN users u ON wr.user_id = u.id
       WHERE wr.status = 'pending'
       ORDER BY wr.created_at ASC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async getUserWithdrawals(userId: string, limit = 50): Promise<any[]> {
    const result = await query(
      `SELECT id, amount, fee, net_amount, currency, method, destination,
              status, tx_hash, rejection_reason, created_at, reviewed_at
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  getWithdrawalFees(): Record<string, number> {
    return { ...this.FEES };
  }

  getMinimumWithdrawals(): Record<string, number> {
    return { ...this.MIN_WITHDRAWAL };
  }
}

export const withdrawalService = new WithdrawalService();
export default withdrawalService;
