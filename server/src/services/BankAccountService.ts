import { query } from '../config/database.js';

/**
 * Bank Account Service
 * Manages platform bank accounts for QR deposits
 * Generates UPI intent URLs for QR code rendering
 */

export class BankAccountService {
  // Get an available bank account with capacity under daily limit
  async getAvailableAccount(amount: number): Promise<{
    id: string;
    upiId: string;
    accountHolder: string;
    bankName: string;
  } | null> {
    // Reset any stale daily limits
    await this.resetStaleCounters();

    const result = await query(
      `SELECT id, upi_id, account_holder, bank_name
       FROM bank_accounts
       WHERE is_active = TRUE
         AND daily_received + $1 <= daily_limit
       ORDER BY priority DESC, daily_received ASC
       LIMIT 1`,
      [amount]
    );

    if (result.rows.length === 0) return null;
    return {
      id: result.rows[0].id,
      upiId: result.rows[0].upi_id,
      accountHolder: result.rows[0].account_holder,
      bankName: result.rows[0].bank_name,
    };
  }

  // Generate UPI intent URL for QR code
  generateUPIQR(upiId: string, amount: number, orderId: string, payeeName?: string): string {
    // amount is in internal units, convert to INR (divide by 100000)
    const amountINR = (amount / 100000).toFixed(2);
    const params = new URLSearchParams({
      pa: upiId,
      pn: payeeName || 'Ghost Casino',
      am: amountINR,
      cu: 'INR',
      tn: `Deposit ${orderId.substring(0, 8)}`,
    });
    return `upi://pay?${params.toString()}`;
  }

  // Create a QR deposit order
  async createQRDeposit(userId: string, amount: number): Promise<{
    success: boolean;
    error?: string;
    order?: {
      id: string;
      amount: number;
      upiId: string;
      accountHolder: string;
      bankName: string;
      qrData: string;
      expiresAt: string;
    };
  }> {
    if (amount < 10000000) {
      return { success: false, error: 'Minimum deposit is 100 INR' };
    }

    const account = await this.getAvailableAccount(amount);
    if (!account) {
      return { success: false, error: 'No payment accounts available. Please try agent deposit.' };
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const result = await query(
      `INSERT INTO deposit_orders (user_id, method, amount, currency, status,
        bank_account_id, expires_at)
       VALUES ($1, 'qr', $2, 'INR', 'pending', $3, $4)
       RETURNING id`,
      [userId, amount, account.id, expiresAt.toISOString()]
    );

    const orderId = result.rows[0].id;
    const qrData = this.generateUPIQR(account.upiId, amount, orderId, account.accountHolder);

    // Store QR data in order
    await query(
      'UPDATE deposit_orders SET qr_data = $1, status = $2 WHERE id = $3',
      [qrData, 'assigned', orderId]
    );

    return {
      success: true,
      order: {
        id: orderId,
        amount,
        upiId: account.upiId,
        accountHolder: account.accountHolder,
        bankName: account.bankName,
        qrData,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  // Process webhook from payment provider (mock for now)
  async processWebhook(orderId: string, paymentId: string, status: 'success' | 'failed'): Promise<{
    success: boolean; userId?: string; amount?: number;
  }> {
    if (status !== 'success') {
      await query(
        `UPDATE deposit_orders SET status = 'rejected', provider_payment_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [paymentId, orderId]
      );
      return { success: false };
    }

    const orderResult = await query(
      `SELECT id, user_id, amount, bank_account_id FROM deposit_orders
       WHERE id = $1 AND status IN ('assigned', 'pending') FOR UPDATE`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return { success: false };
    }

    const order = orderResult.rows[0];

    await query('BEGIN');
    try {
      // Mark order completed
      await query(
        `UPDATE deposit_orders
         SET status = 'completed', provider_payment_id = $1, verified_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [paymentId, orderId]
      );

      // Get current balance
      const userResult = await query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [order.user_id]);
      const balanceBefore = Number(userResult.rows[0]?.balance || 0);
      const balanceAfter = balanceBefore + Number(order.amount);

      // Credit user
      await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [order.amount, order.user_id]);

      // Transaction record
      await query(
        `INSERT INTO transactions (
          user_id, type, status, amount, fee, net_amount, currency,
          balance_before, balance_after, reference_id, reference_type, description
        ) VALUES ($1, 'deposit_qr', 'completed', $2, 0, $2, 'INR', $3, $4, $5, 'deposit_order', 'QR deposit')`,
        [order.user_id, order.amount, balanceBefore, balanceAfter, orderId]
      );

      // Update bank account daily received
      await query(
        'UPDATE bank_accounts SET daily_received = daily_received + $1, updated_at = NOW() WHERE id = $2',
        [order.amount, order.bank_account_id]
      );

      await query('COMMIT');
      return { success: true, userId: order.user_id, amount: Number(order.amount) };
    } catch (err) {
      await query('ROLLBACK');
      console.error('QR webhook processing error:', err);
      return { success: false };
    }
  }

  // Reset daily counters for accounts that haven't been reset today
  private async resetStaleCounters(): Promise<void> {
    await query(
      `UPDATE bank_accounts
       SET daily_received = 0, daily_reset_at = NOW()
       WHERE daily_reset_at < CURRENT_DATE`
    );
  }

  // Admin: add bank account
  async createAccount(data: {
    label: string; upiId: string; bankName?: string;
    accountHolder?: string; accountNumber?: string; ifscCode?: string;
    dailyLimit?: number; priority?: number;
  }): Promise<{ id: string }> {
    const result = await query(
      `INSERT INTO bank_accounts (label, upi_id, bank_name, account_holder,
        account_number, ifsc_code, daily_limit, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.label, data.upiId, data.bankName || null,
        data.accountHolder || null, data.accountNumber || null,
        data.ifscCode || null, data.dailyLimit || 50000000000,
        data.priority || 0,
      ]
    );
    return { id: result.rows[0].id };
  }

  // Admin: list accounts
  async listAccounts(): Promise<any[]> {
    const result = await query(
      `SELECT id, label, upi_id, bank_name, account_holder, is_active,
              daily_limit, daily_received, priority, created_at
       FROM bank_accounts ORDER BY priority DESC, created_at DESC`
    );
    return result.rows;
  }
}

export const bankAccountService = new BankAccountService();
export default bankAccountService;
