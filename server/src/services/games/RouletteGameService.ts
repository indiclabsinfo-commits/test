import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';

// Roulette: European single-zero wheel
// 37 pockets: 0, 1-36
// House edge: 2.7% (1/37)

interface RouletteBet {
  userId: string;
  type: RouletteBetType;
  amount: number;
  numbers?: number[];
}

type RouletteBetType = 
  | 'STRAIGHT_UP'   // Single number (35:1)
  | 'SPLIT'         // Two numbers (17:1)
  | 'STREET'        // Three numbers (11:1)
  | 'CORNER'        // Four numbers (8:1)
  | 'LINE'          // Six numbers (5:1)
  | 'DOZEN'         // 12 numbers (2:1)
  | 'COLUMN'        // 12 numbers (2:1)
  | 'EVEN'          // Even numbers (1:1)
  | 'ODD'           // Odd numbers (1:1)
  | 'RED'           // Red numbers (1:1)
  | 'BLACK'         // Black numbers (1:1)
  | 'LOW'           // 1-18 (1:1)
  | 'HIGH';         // 19-36 (1:1)

const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

const PAYOUTS: Record<RouletteBetType, number> = {
  STRAIGHT_UP: 35,
  SPLIT: 17,
  STREET: 11,
  CORNER: 8,
  LINE: 5,
  DOZEN: 2,
  COLUMN: 2,
  EVEN: 1,
  ODD: 1,
  RED: 1,
  BLACK: 1,
  LOW: 1,
  HIGH: 1,
};

export class RouletteGameService {
  private wsServer: any;
  private currentBets: Map<string, RouletteBet[]> = new Map();
  private isSpinning: boolean = false;

  constructor(wsServer: any) {
    this.wsServer = wsServer;
  }

  public async handleMessage(client: Client, msg: GameMessage): Promise<void> {
    if (!client.userId) {
      this.sendError(client, 'Not authenticated');
      return;
    }

    switch (msg.type) {
      case 'place_bet':
        await this.handlePlaceBet(client, msg.data);
        break;
      case 'spin':
        await this.handleSpin(client);
        break;
      case 'clear_bets':
        this.handleClearBets(client);
        break;
      default:
        console.log('Unknown Roulette message type:', msg.type);
    }
  }

  private async handlePlaceBet(client: Client, data: any): Promise<void> {
    const { betId, amount, betType, numbers } = data;

    if (!amount || amount <= 0) {
      this.sendError(client, 'Invalid bet amount');
      return;
    }

    if (this.isSpinning) {
      this.sendError(client, 'Wheel is spinning');
      return;
    }

    // Validate bet type
    if (!this.validateBet(betType, numbers)) {
      this.sendError(client, 'Invalid bet configuration');
      return;
    }

    try {
      // Check balance
      const balanceCheck = await query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [client.userId]
      );

      if (balanceCheck.rows.length === 0 || balanceCheck.rows[0].balance < amount) {
        this.sendError(client, 'Insufficient balance');
        return;
      }

      // Add bet to current round
      const userBets = this.currentBets.get(client.userId!) || [];
      userBets.push({
        userId: client.userId!,
        type: betType,
        amount,
        numbers,
      });
      this.currentBets.set(client.userId!, userBets);

      // Confirm bet placement
      this.wsServer.sendToClient(client.ws, {
        type: 'bet_placed',
        data: {
          betId,
          betType,
          amount,
          totalBets: userBets.reduce((sum, b) => sum + b.amount, 0),
        },
      });

    } catch (err) {
      console.error('Roulette bet error:', err);
      this.sendError(client, 'Bet failed');
    }
  }

  private validateBet(type: RouletteBetType, numbers?: number[]): boolean {
    switch (type) {
      case 'STRAIGHT_UP':
        return numbers?.length === 1 && numbers[0] >= 0 && numbers[0] <= 36;
      case 'SPLIT':
        return numbers?.length === 2 && this.areAdjacent(numbers[0], numbers[1]);
      case 'STREET':
        return numbers?.length === 3 && this.isStreet(numbers);
      case 'CORNER':
        return numbers?.length === 4 && this.isCorner(numbers);
      case 'LINE':
        return numbers?.length === 6 && this.isLine(numbers);
      case 'DOZEN':
        return numbers?.length === 1 && numbers[0] >= 1 && numbers[0] <= 3;
      case 'COLUMN':
        return numbers?.length === 1 && numbers[0] >= 1 && numbers[0] <= 3;
      case 'EVEN':
      case 'ODD':
      case 'RED':
      case 'BLACK':
      case 'LOW':
      case 'HIGH':
        return true;
      default:
        return false;
    }
  }

  private areAdjacent(n1: number, n2: number): boolean {
    const pos1 = WHEEL_NUMBERS.indexOf(n1);
    const pos2 = WHEEL_NUMBERS.indexOf(n2);
    return Math.abs(pos1 - pos2) === 1;
  }

  private isStreet(nums: number[]): boolean {
    const sorted = [...nums].sort((a, b) => a - b);
    return sorted[1] === sorted[0] + 1 && sorted[2] === sorted[0] + 2 && sorted[0] % 3 === 1;
  }

  private isCorner(nums: number[]): boolean {
    const sorted = [...nums].sort((a, b) => a - b);
    return sorted[0] + 1 === sorted[1] && sorted[2] + 1 === sorted[3] && sorted[2] - sorted[0] === 3;
  }

  private isLine(nums: number[]): boolean {
    const sorted = [...nums].sort((a, b) => a - b);
    return sorted.length === 6 && sorted[0] % 3 === 1;
  }

  private async handleSpin(client: Client): Promise<void> {
    if (this.isSpinning) {
      this.sendError(client, 'Already spinning');
      return;
    }

    const userBets = this.currentBets.get(client.userId!);
    if (!userBets || userBets.length === 0) {
      this.sendError(client, 'No bets placed');
      return;
    }

    this.isSpinning = true;

    try {
      // Generate provably fair result
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const clientSeed = await this.getClientSeed(client.userId!);
      const nonce = await this.getNextNonce(client.userId!);
      
      const hash = ProvablyFair.generateHash(serverSeed, clientSeed, nonce);
      const random = ProvablyFair.hashToNumber(hash);
      
      // Spin result
      const winningNumber = WHEEL_NUMBERS[Math.floor(random * 37)];
      const isRed = RED_NUMBERS.includes(winningNumber);
      const isBlack = BLACK_NUMBERS.includes(winningNumber);
      const isEven = winningNumber !== 0 && winningNumber % 2 === 0;
      const isLow = winningNumber >= 1 && winningNumber <= 18;

      // Calculate wins
      let totalWin = 0;
      const betResults = [];

      for (const bet of userBets) {
        let won = false;
        
        switch (bet.type) {
          case 'STRAIGHT_UP':
            won = bet.numbers?.[0] === winningNumber;
            break;
          case 'SPLIT':
            won = !!bet.numbers?.includes(winningNumber);
            break;
          case 'STREET':
            won = !!bet.numbers?.includes(winningNumber);
            break;
          case 'CORNER':
            won = !!bet.numbers?.includes(winningNumber);
            break;
          case 'LINE':
            won = !!bet.numbers?.includes(winningNumber);
            break;
          case 'DOZEN':
            {
              const dozen = bet.numbers?.[0];
              won = (dozen === 1 && winningNumber >= 1 && winningNumber <= 12) ||
                     (dozen === 2 && winningNumber >= 13 && winningNumber <= 24) ||
                     (dozen === 3 && winningNumber >= 25 && winningNumber <= 36);
            }
            break;
          case 'COLUMN':
            {
              const col = bet.numbers?.[0];
              won = winningNumber !== 0 && winningNumber % 3 === (col === 1 ? 1 : col === 2 ? 2 : 0);
            }
            break;
          case 'EVEN':
            won = isEven;
            break;
          case 'ODD':
            won = !isEven && winningNumber !== 0;
            break;
          case 'RED':
            won = isRed;
            break;
          case 'BLACK':
            won = isBlack;
            break;
          case 'LOW':
            won = isLow;
            break;
          case 'HIGH':
            won = !isLow && winningNumber !== 0;
            break;
        }

        const payout = won ? bet.amount * (PAYOUTS[bet.type] + 1) : 0;
        totalWin += payout;

        betResults.push({
          type: bet.type,
          amount: bet.amount,
          won,
          payout: won ? payout - bet.amount : -bet.amount,
        });
      }

      const totalBet = userBets.reduce((sum, b) => sum + b.amount, 0);
      const profit = totalWin - totalBet;

      // Execute transaction
      await query('BEGIN');

      try {
        const lockedBalance = await query(
          'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
          [client.userId]
        );

        if (lockedBalance.rows.length === 0 || lockedBalance.rows[0].balance < totalBet) {
          throw new Error('Insufficient balance at spin time');
        }

        // Deduct total bet
        const debitResult = await query(
          'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND balance >= $1',
          [totalBet, client.userId]
        );
        if (debitResult.rowCount === 0) {
          throw new Error('Failed to debit balance');
        }

        // Create game session
        const pfResult = await query(
          `INSERT INTO provably_fair_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, revealed)
           VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
          [client.userId, serverSeed, serverSeedHash, clientSeed, nonce]
        );

        const multiplier = totalBet > 0 ? totalWin / totalBet : 0;
        const sessionResult = await query(
          `INSERT INTO game_sessions 
           (user_id, game_type, bet_amount, multiplier, payout, result, provably_fair_seed_id)
           VALUES ($1, 'roulette', $2, $3, $4, $5, $6) RETURNING id`,
          [client.userId, totalBet, multiplier, totalWin, profit > 0 ? 'WIN' : profit < 0 ? 'LOSS' : 'PUSH', pfResult.rows[0].id]
        );

        // Bet transaction
        await query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
           SELECT $1, id, 'BET', $2, 'COMPLETED', $3, 'Roulette bet'
           FROM wallets WHERE user_id = $1`,
          [client.userId, totalBet, sessionResult.rows[0].id]
        );

        // Win transaction
        if (profit > 0) {
          await query(
            'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
            [totalWin, client.userId]
          );

          await query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
             SELECT $1, id, 'WIN', $2, 'COMPLETED', $3, 'Roulette win'
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
          type: 'spin_result',
          data: {
            winningNumber,
            isRed,
            isBlack,
            isEven,
            totalBet,
            totalWin,
            profit,
            betResults,
            serverSeedHash,
            clientSeed,
            nonce,
            balance: newBalance.rows[0].balance,
          },
        });

        // Clear bets
        this.currentBets.delete(client.userId!);

      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }

    } catch (err) {
      console.error('Roulette spin error:', err);
      this.sendError(
        client,
        err instanceof Error && err.message.includes('Insufficient balance')
          ? 'Insufficient balance'
          : 'Spin failed'
      );
    } finally {
      this.isSpinning = false;
    }
  }

  private handleClearBets(client: Client): void {
    this.currentBets.delete(client.userId!);
    this.wsServer.sendToClient(client.ws, {
      type: 'bets_cleared',
    });
  }

  private async getClientSeed(userId: string): Promise<string> {
    // Get user's current client seed or generate new one
    const result = await query(
      'SELECT client_seed FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0]?.client_seed || ProvablyFair.generateClientSeed();
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
