import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'agent-secret';

export class AgentService {
  // Create a new agent (admin action)
  async createAgent(data: {
    username: string;
    password: string;
    displayName: string;
    upiId?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    minAmount?: number;
    maxAmount?: number;
    dailyLimit?: number;
  }): Promise<{ id: string }> {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const result = await query(
      `INSERT INTO agents (username, password_hash, display_name, upi_id, bank_name,
        account_number, ifsc_code, min_amount, max_amount, daily_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        data.username, passwordHash, data.displayName,
        data.upiId || null, data.bankName || null,
        data.accountNumber || null, data.ifscCode || null,
        data.minAmount || 10000000, data.maxAmount || 5000000000,
        data.dailyLimit || 50000000000,
      ]
    );
    return { id: result.rows[0].id };
  }

  // Agent login
  async authenticate(username: string, password: string): Promise<{
    token: string;
    agent: { id: string; displayName: string; username: string };
  } | null> {
    const result = await query(
      'SELECT id, username, password_hash, display_name FROM agents WHERE username = $1 AND is_active = TRUE',
      [username]
    );
    if (result.rows.length === 0) return null;

    const agent = result.rows[0];
    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) return null;

    // Update last active + online status
    await query(
      'UPDATE agents SET last_active = NOW(), is_online = TRUE WHERE id = $1',
      [agent.id]
    );

    const token = jwt.sign(
      { agentId: agent.id, username: agent.username, role: 'agent' },
      AGENT_JWT_SECRET,
      { expiresIn: '12h' }
    );

    return {
      token,
      agent: { id: agent.id, displayName: agent.display_name, username: agent.username },
    };
  }

  // Verify agent JWT
  static verifyToken(token: string): { agentId: string; username: string } {
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;
    return { agentId: decoded.agentId, username: decoded.username };
  }

  // Agent auth middleware
  static middleware(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No agent token provided' });
    }
    try {
      const decoded = AgentService.verifyToken(authHeader.substring(7));
      req.agentId = decoded.agentId;
      req.agentUsername = decoded.username;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid agent token' });
    }
  }

  // Get available agent for assignment (least loaded, within amount limits)
  async getAvailableAgent(amount: number): Promise<{
    id: string;
    upiId: string;
    displayName: string;
  } | null> {
    const result = await query(
      `SELECT id, upi_id, display_name
       FROM agents
       WHERE is_active = TRUE AND is_online = TRUE
         AND current_orders < max_concurrent_orders
         AND min_amount <= $1 AND max_amount >= $1
         AND daily_processed + $1 <= daily_limit
         AND upi_id IS NOT NULL
       ORDER BY current_orders ASC, total_volume ASC
       LIMIT 1`,
      [amount]
    );
    if (result.rows.length === 0) return null;
    return {
      id: result.rows[0].id,
      upiId: result.rows[0].upi_id,
      displayName: result.rows[0].display_name,
    };
  }

  // Update agent status
  async setActive(agentId: string, active: boolean): Promise<void> {
    await query('UPDATE agents SET is_active = $1, updated_at = NOW() WHERE id = $2', [active, agentId]);
  }

  async setOnline(agentId: string, online: boolean): Promise<void> {
    await query('UPDATE agents SET is_online = $1, last_active = NOW() WHERE id = $2', [online, agentId]);
  }

  // Get agent stats
  async getStats(agentId: string): Promise<any> {
    const result = await query(
      `SELECT total_orders, total_verified, total_rejected, total_volume,
              current_orders, daily_processed, daily_limit, avg_response_time_ms
       FROM agents WHERE id = $1`,
      [agentId]
    );
    return result.rows[0] || null;
  }

  // List all agents (admin)
  async listAgents(): Promise<any[]> {
    const result = await query(
      `SELECT id, username, display_name, upi_id, bank_name, is_active, is_online,
              current_orders, total_orders, total_verified, total_rejected,
              total_volume, daily_processed, daily_limit, last_active, created_at
       FROM agents ORDER BY created_at DESC`
    );
    return result.rows;
  }

  // Reset daily processed amounts (call via cron)
  async resetDailyCounters(): Promise<void> {
    await query('UPDATE agents SET daily_processed = 0, updated_at = NOW()');
  }
}

export const agentService = new AgentService();
export default agentService;
