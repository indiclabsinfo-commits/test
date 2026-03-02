import { query } from '../config/database.js';
import { agentService } from './AgentService.js';

/**
 * Deposit Order Service
 * Handles P2P agent deposit flow + QR deposit flow
 */

export class DepositOrderService {
  // ============================================
  // P2P AGENT DEPOSITS
  // ============================================

  async createAgentDeposit(userId: string, amount: number): Promise<{
    success: boolean;
    error?: string;
    order?: {
      id: string;
      amount: number;
      agentUpiId: string;
      agentName: string;
      expiresAt: string;
    };
  }> {
    if (amount < 10000000) { // min 100 INR
      return { success: false, error: 'Minimum deposit is 100 INR' };
    }
    if (amount > 5000000000) { // max 50000 INR
      return { success: false, error: 'Maximum deposit is 50,000 INR' };
    }

    // Find available agent
    const agent = await agentService.getAvailableAgent(amount);
    if (!agent) {
      return { success: false, error: 'No agents available. Please try again later.' };
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    const result = await query(
      `INSERT INTO deposit_orders (user_id, method, amount, currency, status,
        agent_id, agent_upi_id, expires_at)
       VALUES ($1, 'agent', $2, 'INR', 'assigned', $3, $4, $5)
       RETURNING id`,
      [userId, amount, agent.id, agent.upiId, expiresAt.toISOString()]
    );

    // Increment agent's current orders
    await query(
      'UPDATE agents SET current_orders = current_orders + 1, total_orders = total_orders + 1 WHERE id = $1',
      [agent.id]
    );

    return {
      success: true,
      order: {
        id: result.rows[0].id,
        amount,
        agentUpiId: agent.upiId,
        agentName: agent.displayName,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  // User marks payment as done
  async markPaid(orderId: string, userId: string, utrNumber: string): Promise<{
    success: boolean; error?: string;
  }> {
    const result = await query(
      `UPDATE deposit_orders
       SET status = 'user_paid', utr_number = $1, user_paid_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND status = 'assigned'
       RETURNING id, agent_id`,
      [utrNumber, orderId, userId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Order not found or already processed' };
    }

    return { success: true };
  }

  // Agent verifies payment
  async verifyPayment(orderId: string, agentId: string, verified: boolean, reason?: string): Promise<{
    success: boolean; error?: string; userId?: string; amount?: number;
  }> {
    await query('BEGIN');
    try {
      const orderResult = await query(
        `SELECT id, user_id, amount, agent_id FROM deposit_orders
         WHERE id = $1 AND status = 'user_paid' FOR UPDATE`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        await query('ROLLBACK');
        return { success: false, error: 'Order not found or not in verifiable state' };
      }

      const order = orderResult.rows[0];
      if (order.agent_id !== agentId) {
        await query('ROLLBACK');
        return { success: false, error: 'Not your assigned order' };
      }

      if (verified) {
        // Mark order completed
        await query(
          `UPDATE deposit_orders
           SET status = 'completed', verified_by = $1, verified_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [agentId, orderId]
        );

        // Get user's current balance
        const userResult = await query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [order.user_id]);
        const balanceBefore = Number(userResult.rows[0]?.balance || 0);
        const balanceAfter = balanceBefore + Number(order.amount);

        // Credit user balance
        await query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [order.amount, order.user_id]
        );

        // Create transaction record
        await query(
          `INSERT INTO transactions (
            user_id, type, status, amount, fee, net_amount, currency,
            balance_before, balance_after, reference_id, reference_type, description
          ) VALUES ($1, 'deposit_agent', 'completed', $2, 0, $2, 'INR', $3, $4, $5, 'deposit_order', 'P2P agent deposit')`,
          [order.user_id, order.amount, balanceBefore, balanceAfter, orderId]
        );

        // Update agent stats
        await query(
          `UPDATE agents SET
            current_orders = GREATEST(current_orders - 1, 0),
            total_verified = total_verified + 1,
            total_volume = total_volume + $1,
            daily_processed = daily_processed + $1,
            updated_at = NOW()
           WHERE id = $2`,
          [order.amount, agentId]
        );

        await query('COMMIT');
        return { success: true, userId: order.user_id, amount: Number(order.amount) };
      } else {
        // Reject
        await query(
          `UPDATE deposit_orders
           SET status = 'rejected', rejection_reason = $1, verified_by = $2,
               verified_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [reason || 'Payment not received', agentId, orderId]
        );

        await query(
          `UPDATE agents SET
            current_orders = GREATEST(current_orders - 1, 0),
            total_rejected = total_rejected + 1,
            updated_at = NOW()
           WHERE id = $1`,
          [agentId]
        );

        await query('COMMIT');
        return { success: true, userId: order.user_id, amount: 0 };
      }
    } catch (err) {
      await query('ROLLBACK');
      console.error('Verify payment error:', err);
      return { success: false, error: 'Internal error' };
    }
  }

  // Get order status
  async getOrderStatus(orderId: string, userId: string): Promise<any> {
    const result = await query(
      `SELECT id, method, amount, currency, status, agent_upi_id,
              utr_number, rejection_reason, expires_at, created_at, updated_at
       FROM deposit_orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    return result.rows[0] || null;
  }

  // Get agent's pending orders
  async getAgentOrders(agentId: string, status?: string): Promise<any[]> {
    let sql = `SELECT do2.id, do2.amount, do2.currency, do2.status, do2.utr_number,
                      do2.user_paid_at, do2.expires_at, do2.created_at, u.username
               FROM deposit_orders do2
               JOIN users u ON do2.user_id = u.id
               WHERE do2.agent_id = $1`;
    const params: any[] = [agentId];

    if (status) {
      sql += ' AND do2.status = $2';
      params.push(status);
    } else {
      sql += ` AND do2.status IN ('assigned', 'user_paid')`;
    }

    sql += ' ORDER BY do2.created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  // Expire old unconfirmed orders
  async expireOldOrders(): Promise<number> {
    const result = await query(
      `UPDATE deposit_orders
       SET status = 'expired', updated_at = NOW()
       WHERE status IN ('pending', 'assigned')
         AND expires_at < NOW()
       RETURNING agent_id`
    );

    // Decrement agent order counts
    for (const row of result.rows) {
      if (row.agent_id) {
        await query(
          'UPDATE agents SET current_orders = GREATEST(current_orders - 1, 0) WHERE id = $1',
          [row.agent_id]
        );
      }
    }

    return result.rowCount || 0;
  }

  // Get user's deposit history
  async getUserDeposits(userId: string, limit = 20): Promise<any[]> {
    const result = await query(
      `SELECT id, method, amount, currency, status, utr_number,
              rejection_reason, created_at, updated_at
       FROM deposit_orders WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
}

export const depositOrderService = new DepositOrderService();
export default depositOrderService;
