import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { redisClient } from '../../config/redis.js';
import { economyRuntimeService } from '../EconomyRuntimeService.js';

interface CrashBet {
  userId: string;
  username: string;
  betAmount: number;
  autoCashout?: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  profit?: number;
}

interface CrashRound {
  id: string;
  crashPoint: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  startTime: number;
  status: 'waiting' | 'starting' | 'running' | 'crashed';
  bets: Map<string, CrashBet>;
  currentMultiplier: number;
}

export class CrashGameService {
  private wsServer: any;
  private currentRound: CrashRound | null = null;
  private roundInterval: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private readonly BETTING_TIME = 8000; // 8 seconds
  private readonly MULTIPLIER_INCREMENT = 0.01;
  private readonly TICK_RATE = 100; // Update every 100ms

  constructor(wsServer: any) {
    this.wsServer = wsServer;
    void this.startNewRound();
  }

  public async handleMessage(client: Client, msg: GameMessage): Promise<void> {
    switch (msg.type) {
      case 'place_bet':
        await this.handlePlaceBet(client, msg.data);
        break;
      case 'cashout':
        await this.handleCashout(client);
        break;
      case 'get_history':
        await this.sendHistory(client);
        break;
      default:
        this.wsServer.sendToClient(client.id, {
          type: 'error',
          data: { message: 'Unknown message type' },
        });
    }
  }

  private async handlePlaceBet(
    client: Client,
    data: { betAmount: number; autoCashout?: number }
  ): Promise<void> {
    try {
      if (!this.currentRound || this.currentRound.status !== 'waiting') {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'Betting is closed' },
        });
        return;
      }

      const { betAmount, autoCashout } = data;

      // Validate bet amount
      if (betAmount < 1 || betAmount > 100000) {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'Invalid bet amount' },
        });
        return;
      }

      if (autoCashout !== undefined && autoCashout !== null && autoCashout < 1.01) {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'Auto cashout must be at least 1.01x' },
        });
        return;
      }

      // Check if already bet in this round
      if (this.currentRound.bets.has(client.userId)) {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'Already placed bet in this round' },
        });
        return;
      }

      // Check user balance
      const balanceResult = await query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [client.userId]
      );

      if (balanceResult.rows.length === 0 || balanceResult.rows[0].balance < betAmount) {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'Insufficient balance' },
        });
        return;
      }

      // Deduct balance
      await query(
        'UPDATE users SET balance = balance - $1, total_wagered = total_wagered + $1 WHERE id = $2',
        [betAmount, client.userId]
      );

      // Record transaction
      await query(
        `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
         VALUES ($1, 'bet', $2, $3, $4, 'Crash game bet')`,
        [
          client.userId,
          betAmount,
          balanceResult.rows[0].balance,
          balanceResult.rows[0].balance - betAmount,
        ]
      );

      // Add bet to round
      const bet: CrashBet = {
        userId: client.userId,
        username: client.username,
        betAmount,
        autoCashout,
        cashedOut: false,
      };

      this.currentRound.bets.set(client.userId, bet);
      client.currentGame = 'crash';

      // Broadcast new bet
      this.wsServer.broadcastToGame('crash', {
        type: 'crash_new_bet',
        data: {
          username: client.username,
          betAmount,
          autoCashout,
        },
      });

      // Confirm to client
      this.wsServer.sendToClient(client.id, {
        type: 'crash_bet_placed',
        data: {
          betAmount,
          roundId: this.currentRound.id,
        },
      });
    } catch (error) {
      console.error('Error placing crash bet:', error);
      this.wsServer.sendToClient(client.id, {
        type: 'crash_error',
        data: { message: 'Failed to place bet' },
      });
    }
  }

  private async handleCashout(client: Client): Promise<void> {
    try {
      if (!this.currentRound || this.currentRound.status !== 'running') {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'Cannot cash out now' },
        });
        return;
      }

      const bet = this.currentRound.bets.get(client.userId);

      if (!bet) {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'No active bet found' },
        });
        return;
      }

      if (bet.cashedOut) {
        this.wsServer.sendToClient(client.id, {
          type: 'crash_error',
          data: { message: 'Already cashed out' },
        });
        return;
      }

      await this.processCashout(client.userId, bet, this.currentRound.currentMultiplier);
    } catch (error) {
      console.error('Error cashing out:', error);
      this.wsServer.sendToClient(client.id, {
        type: 'crash_error',
        data: { message: 'Failed to cash out' },
      });
    }
  }

  private async processCashout(
    userId: string,
    bet: CrashBet,
    multiplier: number
  ): Promise<void> {
    bet.cashedOut = true;
    bet.cashoutMultiplier = multiplier;
    bet.profit = bet.betAmount * multiplier - bet.betAmount;

    const payout = bet.betAmount * multiplier;

    // Update user balance
    await query(
      'UPDATE users SET balance = balance + $1, total_won = total_won + $2 WHERE id = $3',
      [payout, bet.profit, userId]
    );

    // Record transaction
    await query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
       VALUES ($1, 'win', $2,
         (SELECT balance - $2 FROM users WHERE id = $1),
         (SELECT balance FROM users WHERE id = $1),
         $3)`,
      [userId, payout, `Crash game win @ ${multiplier.toFixed(2)}x`]
    );

    // Broadcast cashout
    this.wsServer.broadcastToGame('crash', {
      type: 'crash_cashout',
      data: {
        username: bet.username,
        multiplier,
        profit: bet.profit,
      },
    });
  }

  private async startNewRound(): Promise<void> {
    const seedPair = ProvablyFair.generateSeedPair();
    const nonce = Date.now();
    const houseEdge = await economyRuntimeService.getHouseEdge('crash');
    const crashPoint = ProvablyFair.generateCrashPoint(
      seedPair.serverSeed,
      seedPair.clientSeed,
      nonce,
      houseEdge
    );

    this.currentRound = {
      id: `crash_${Date.now()}`,
      crashPoint,
      serverSeed: seedPair.serverSeed,
      serverSeedHash: seedPair.serverSeedHash,
      clientSeed: seedPair.clientSeed,
      nonce,
      startTime: Date.now() + this.BETTING_TIME,
      status: 'waiting',
      bets: new Map(),
      currentMultiplier: 1.0,
    };

    // Broadcast new round
    this.wsServer.broadcastToGame('crash', {
      type: 'crash_round_start',
      data: {
        roundId: this.currentRound.id,
        serverSeedHash: this.currentRound.serverSeedHash,
        bettingTime: this.BETTING_TIME,
      },
    });

    // Start countdown
    this.startCountdown();
  }

  private startCountdown(): void {
    let countdown = this.BETTING_TIME / 1000;

    this.countdownInterval = setInterval(() => {
      countdown--;

      if (countdown <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.startRound();
      } else {
        this.wsServer.broadcastToGame('crash', {
          type: 'crash_countdown',
          data: { countdown },
        });
      }
    }, 1000);
  }

  private startRound(): void {
    if (!this.currentRound) return;

    this.currentRound.status = 'running';
    this.currentRound.currentMultiplier = 1.0;

    this.wsServer.broadcastToGame('crash', {
      type: 'crash_started',
      data: { timestamp: Date.now() },
    });

    this.runRound();
  }

  private runRound(): void {
    if (!this.currentRound) return;

      this.roundInterval = setInterval(() => {
        if (!this.currentRound) return;

        this.currentRound.currentMultiplier += this.MULTIPLIER_INCREMENT;

        // Crash must resolve before any cashout at/after crash point.
        if (this.currentRound.currentMultiplier >= this.currentRound.crashPoint) {
          this.crashRound();
          return;
        }

        // Check auto-cashouts
        this.currentRound.bets.forEach((bet, userId) => {
          if (
            !bet.cashedOut &&
          bet.autoCashout &&
          this.currentRound!.currentMultiplier >= bet.autoCashout
        ) {
          this.processCashout(userId, bet, this.currentRound!.currentMultiplier);
        }
      });

      // Broadcast current multiplier
      this.wsServer.broadcastToGame('crash', {
        type: 'crash_tick',
        data: { multiplier: this.currentRound.currentMultiplier.toFixed(2) },
      });
    }, this.TICK_RATE);
  }

  private async crashRound(): Promise<void> {
    if (this.roundInterval) clearInterval(this.roundInterval);
    if (!this.currentRound) return;

    this.currentRound.status = 'crashed';

    // Process losses for players who didn't cash out
    for (const [userId, bet] of this.currentRound.bets) {
      if (!bet.cashedOut) {
        await query(
          'UPDATE users SET total_lost = total_lost + $1 WHERE id = $2',
          [bet.betAmount, userId]
        );
      }
    }

    // Save round to database and cache for history
    await redisClient.lPush(
      'crash_history',
      JSON.stringify({
        crashPoint: this.currentRound.crashPoint,
        timestamp: Date.now(),
      })
    );
    await redisClient.lTrim('crash_history', 0, 99); // Keep last 100

    // Broadcast crash
    this.wsServer.broadcastToGame('crash', {
      type: 'crash_crashed',
      data: {
        crashPoint: this.currentRound.crashPoint.toFixed(2),
        serverSeed: this.currentRound.serverSeed,
        clientSeed: this.currentRound.clientSeed,
        nonce: this.currentRound.nonce,
      },
    });

    // Start new round after 3 seconds
    setTimeout(() => { void this.startNewRound(); }, 3000);
  }

  private async sendHistory(client: Client): Promise<void> {
    try {
      const history = await redisClient.lRange('crash_history', 0, 19);
      this.wsServer.sendToClient(client.id, {
        type: 'crash_history',
        data: history.map((h) => JSON.parse(h)),
      });
    } catch (error) {
      console.error('Error sending crash history:', error);
    }
  }

  public handleDisconnect(client: Client): void {
    // Do not auto-cashout on disconnect; unresolved bets continue in-round.
  }
}

export default CrashGameService;
