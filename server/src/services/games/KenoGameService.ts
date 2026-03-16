import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { economyRuntimeService } from '../EconomyRuntimeService.js';

// Keno: Lottery-style game where players pick numbers
// 20 balls drawn from 80, player picks 1-10 numbers
// Payouts based on matches

const KENO_PAYOUTS: Record<number, Record<number, number>> = {
  // picks -> matches -> multiplier
  1: { 1: 3.5 },
  2: { 2: 12 },
  3: { 2: 2, 3: 42 },
  4: { 2: 1, 3: 5, 4: 120 },
  5: { 3: 2, 4: 16, 5: 800 },
  6: { 3: 1.5, 4: 5, 5: 75, 6: 2000 },
  7: { 4: 3, 5: 20, 6: 250, 7: 5000 },
  8: { 5: 10, 6: 75, 7: 1000, 8: 15000 },
  9: { 5: 5, 6: 30, 7: 400, 8: 4000, 9: 25000 },
  10: { 5: 2, 6: 15, 7: 120, 8: 1500, 9: 10000, 10: 50000 },
};

export class KenoGameService {
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
        console.log('Unknown Keno message type:', msg.type);
    }
  }

  private async handlePlaceBet(client: Client, data: any): Promise<void> {
    const { betId, amount, clientSeed, selectedNumbers } = data;

    if (!amount || amount <= 0) {
      this.sendError(client, 'Invalid bet amount');
      return;
    }

    // Validate selected numbers
    if (!Array.isArray(selectedNumbers) || selectedNumbers.length < 1 || selectedNumbers.length > 10) {
      this.sendError(client, 'Select 1-10 numbers');
      return;
    }

    // Check all numbers are unique and valid (1-80)
    const uniqueNumbers = [...new Set(selectedNumbers)];
    if (uniqueNumbers.length !== selectedNumbers.length) {
      this.sendError(client, 'Numbers must be unique');
      return;
    }

    if (uniqueNumbers.some(n => n < 1 || n > 80)) {
      this.sendError(client, 'Numbers must be 1-80');
      return;
    }

    try {
      // Check balance
      const balanceCheck = await query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [client.userId]
      );

      if (balanceCheck.rows.length === 0 || balanceCheck.rows[0].balance < amount) {
        this.sendError(client, 'Insufficient balance');
        return;
      }

      // Generate provably fair draw (20 numbers from 1-80)
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const nonce = await this.getNextNonce(client.userId!);

      const hash = ProvablyFair.generateHash(serverSeed, clientSeed, nonce);
      const drawnNumbers = this.generateKenoNumbers(hash, 20);

      // Calculate matches
      const matches = selectedNumbers.filter(n => drawnNumbers.includes(n));
      const matchCount = matches.length;

      // Calculate payout
      const numPicks = selectedNumbers.length;
      const payoutTable = KENO_PAYOUTS[numPicks];
      const baseMultiplier = payoutTable?.[matchCount] || 0;
      const rtpFactor = await economyRuntimeService.getRtpFactor('keno');
      const multiplier = Number((baseMultiplier * rtpFactor).toFixed(4));
      const payout = Math.floor(amount * multiplier);
      const won = payout > 0;
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
           (user_id, game_type, bet_amount, multiplier, payout, result, provably_fair_seed_id, game_data)
           VALUES ($1, 'keno', $2, $3, $4, $5, $6, $7) RETURNING id`,
          [client.userId, amount, multiplier, payout, won ? 'WIN' : 'LOSS', pfResult.rows[0].id,
           JSON.stringify({ selectedNumbers, drawnNumbers, matches })]
        );

        // Bet transaction
        await query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
           SELECT $1, id, 'BET', $2, 'COMPLETED', $3, 'Keno bet'
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
             SELECT $1, id, 'WIN', $2, 'COMPLETED', $3, 'Keno win'
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

        // Send result
        this.wsServer.sendToClient(client.ws, {
          type: 'draw_result',
          data: {
            betId,
            selectedNumbers,
            drawnNumbers,
            matches,
            matchCount,
            multiplier,
            won,
            payout: won ? profit : -amount,
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
      console.error('Keno bet error:', err);
      this.sendError(client, 'Bet failed');
    }
  }

  private generateKenoNumbers(hash: string, count: number): number[] {
    const numbers: number[] = [];
    
    // Generate 20 unique numbers from 1-80
    const available = Array.from({ length: 80 }, (_, i) => i + 1);
    
    for (let i = 0; i < count && available.length > 0; i++) {
      const randomIndex = Math.floor(ProvablyFair.hashToNumber(hash.substring(i * 8, i * 8 + 8)) * available.length);
      numbers.push(available.splice(randomIndex, 1)[0]);
    }
    
    return numbers.sort((a, b) => a - b);
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

export default KenoGameService;
