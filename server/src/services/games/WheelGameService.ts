import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { economyRuntimeService } from '../EconomyRuntimeService.js';

// Wheel: Fortune wheel with configurable segments
// Similar to Stake's Wheel game

interface WheelSegment {
  multiplier: number;
  color: string;
  probability: number;
}

const WHEEL_BASELINE_RTP = 0.95;

// Low Risk Wheel (~5% house edge)
const LOW_RISK_WHEEL: WheelSegment[] = [
  { multiplier: 0, color: '#ff4d4d', probability: 0.455 },      // 45.5% chance - lose
  { multiplier: 1.5, color: '#4dff4d', probability: 0.355 },    // 35.5% chance
  { multiplier: 2, color: '#4d4dff', probability: 0.15 },       // 15% chance
  { multiplier: 3, color: '#ffff4d', probability: 0.04 },       // 4% chance
];

// Medium Risk Wheel (~5% house edge)
const MEDIUM_RISK_WHEEL: WheelSegment[] = [
  { multiplier: 0, color: '#ff4d4d', probability: 0.512 },      // 51.2%
  { multiplier: 1.5, color: '#4dff4d', probability: 0.268 },    // 26.8%
  { multiplier: 2, color: '#4d4dff', probability: 0.15 },       // 15%
  { multiplier: 3, color: '#ffff4d', probability: 0.05 },       // 5%
  { multiplier: 5, color: '#ff4dff', probability: 0.02 },       // 2%
];

// High Risk Wheel (~5% house edge, jackpot with low probability)
const HIGH_RISK_WHEEL: WheelSegment[] = [
  { multiplier: 0, color: '#ff4d4d', probability: 0.688 },      // 68.8%
  { multiplier: 2, color: '#4d4dff', probability: 0.25 },       // 25%
  { multiplier: 5, color: '#ff4dff', probability: 0.05 },       // 5%
  { multiplier: 10, color: '#ffff4d', probability: 0.01 },      // 1%
  { multiplier: 50, color: '#ffd700', probability: 0.002 },     // 0.2%
];

export class WheelGameService {
  private wsServer: any;

  constructor(wsServer: any) {
    this.wsServer = wsServer;
  }

  public async handleMessage(client: Client, msg: GameMessage): Promise<void> {
    switch (msg.type) {
      case 'place_bet':
        await this.handlePlaceBet(client, msg.data);
        break;
      default:
        console.log('Unknown Wheel message type:', msg.type);
    }
  }

  private async handlePlaceBet(client: Client, data: any): Promise<void> {
    const { betId, amount, clientSeed, riskLevel = 'medium' } = data;

    if (!amount || amount <= 0) {
      this.sendError(client, 'Invalid bet amount');
      return;
    }

    const wheel = riskLevel === 'low' ? LOW_RISK_WHEEL :
                  riskLevel === 'high' ? HIGH_RISK_WHEEL : MEDIUM_RISK_WHEEL;

    try {
      const rtpFactor = await economyRuntimeService.getRtpFactor('wheel');
      const adjustedWheel = this.adjustWheelForRtp(wheel, rtpFactor);

      // Check balance
      const balanceCheck = await query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [client.userId]
      );

      if (balanceCheck.rows.length === 0 || balanceCheck.rows[0].balance < amount) {
        this.sendError(client, 'Insufficient balance');
        return;
      }

      // Generate provably fair result
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const nonce = await this.getNextNonce(client.userId!);

      const hash = ProvablyFair.generateHash(serverSeed, clientSeed, nonce);
      const random = ProvablyFair.hashToNumber(hash);

      // Determine outcome based on probabilities
      let cumulative = 0;
      let result: WheelSegment = wheel[0];
      
      for (const segment of adjustedWheel) {
        cumulative += segment.probability;
        if (random <= cumulative) {
          result = segment;
          break;
        }
      }

      const won = result.multiplier > 0;
      const payout = won ? Math.floor(amount * result.multiplier) : 0;
      const profit = payout - amount;

      // Execute transaction
      await query('BEGIN');

      try {
        // Deduct bet
        await query(
          'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
          [amount, client.userId]
        );

        // Create game session
        const pfResult = await query(
          `INSERT INTO provably_fair_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, revealed)
           VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
          [client.userId, serverSeed, serverSeedHash, clientSeed, nonce]
        );

        const sessionResult = await query(
          `INSERT INTO game_sessions 
           (user_id, game_type, bet_amount, multiplier, payout, result, provably_fair_seed_id)
           VALUES ($1, 'wheel', $2, $3, $4, $5, $6) RETURNING id`,
          [client.userId, amount, result.multiplier, payout, won ? 'WIN' : 'LOSS', pfResult.rows[0].id]
        );

        // Bet transaction
        await query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
           SELECT $1, id, 'BET', $2, 'COMPLETED', $3, 'Wheel bet'
           FROM wallets WHERE user_id = $1`,
          [client.userId, amount, sessionResult.rows[0].id]
        );

        // Win transaction
        if (payout > 0) {
          await query(
            'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
            [payout, client.userId]
          );

          await query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
             SELECT $1, id, 'WIN', $2, 'COMPLETED', $3, 'Wheel win'
             FROM wallets WHERE user_id = $1`,
            [client.userId, profit, sessionResult.rows[0].id]
          );
        }

        await query('COMMIT');

        // Get updated balance
        const newBalance = await query(
          'SELECT balance FROM wallets WHERE user_id = $1',
          [client.userId]
        );

        // Calculate wheel position for animation
        const wheelPosition = this.calculateWheelPosition(adjustedWheel, result);

        // Send result
        this.wsServer.sendToClient(client.ws, {
          type: 'spin_result',
          data: {
            betId,
            multiplier: result.multiplier,
            color: result.color,
            won,
            payout: won ? profit : -amount,
            wheelPosition,
            serverSeedHash,
            clientSeed,
            nonce,
            balance: newBalance.rows[0].balance,
          },
        });

      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }

    } catch (err) {
      console.error('Wheel bet error:', err);
      this.sendError(client, 'Bet failed');
    }
  }

  private calculateWheelPosition(wheel: WheelSegment[], result: WheelSegment): number {
    // Calculate the angle for the winning segment
    let cumulative = 0;
    let segmentIndex = 0;
    
    for (let i = 0; i < wheel.length; i++) {
      if (wheel[i].multiplier === result.multiplier && wheel[i].color === result.color) {
        segmentIndex = i;
        break;
      }
      cumulative += wheel[i].probability;
    }

    // Random position within the segment (for visual variety)
    const segmentStart = cumulative;
    const segmentSize = result.probability;
    const position = segmentStart + (Math.random() * segmentSize * 0.8) + (segmentSize * 0.1);
    
    // Convert to degrees (0-360)
    return position * 360;
  }

  private adjustWheelForRtp(wheel: WheelSegment[], rtpFactor: number): WheelSegment[] {
    const baseExpected = wheel.reduce((sum, segment) => sum + segment.probability * segment.multiplier, 0);
    const safeBase = baseExpected > 0 ? baseExpected : WHEEL_BASELINE_RTP;
    const winProbability = wheel
      .filter((segment) => segment.multiplier > 0)
      .reduce((sum, segment) => sum + segment.probability, 0);
    const maxScale = winProbability > 0 ? 1 / winProbability : 1;
    const scale = Math.max(0, Math.min(maxScale, rtpFactor / safeBase));

    const adjusted = wheel.map((segment) =>
      segment.multiplier > 0
        ? { ...segment, probability: segment.probability * scale }
        : { ...segment, probability: segment.probability }
    );

    const adjustedWinProb = adjusted
      .filter((segment) => segment.multiplier > 0)
      .reduce((sum, segment) => sum + segment.probability, 0);
    const remaining = Math.max(0, 1 - adjustedWinProb);

    const baseLoseProb = wheel
      .filter((segment) => segment.multiplier === 0)
      .reduce((sum, segment) => sum + segment.probability, 0);

    return adjusted.map((segment) => {
      if (segment.multiplier !== 0) return segment;
      const weight = baseLoseProb > 0 ? segment.probability / baseLoseProb : 0;
      return {
        ...segment,
        probability: remaining * weight,
      };
    });
  }

  private async getNextNonce(userId: string): Promise<number> {
    const result = await query(
      'SELECT last_nonce FROM users WHERE id = $1',
      [userId]
    );
    const newNonce = (result.rows[0]?.last_nonce || 0) + 1;
    await query(
      'UPDATE users SET last_nonce = $1 WHERE id = $2',
      [newNonce, userId]
    );
    return newNonce;
  }

  private sendError(client: Client, message: string): void {
    this.wsServer.sendToClient(client.ws, {
      type: 'error',
      data: { message },
    });
  }
}

export default WheelGameService;
