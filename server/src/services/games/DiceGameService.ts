import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { economyRuntimeService } from '../EconomyRuntimeService.js';

export class DiceGameService {
  private wsServer: any;

  constructor(wsServer: any) {
    this.wsServer = wsServer;
  }

  public async handleMessage(client: Client, msg: GameMessage): Promise<void> {
    if (msg.type === 'roll') {
      await this.handleRoll(client, msg.data);
    }
  }

  private async handleRoll(
    client: Client,
    data: { betAmount: number; target: number; rollOver: boolean }
  ): Promise<void> {
    try {
      const { betAmount, target, rollOver } = data;
      const numericTarget = Number(target);
      const isRollOver = Boolean(rollOver);

      if (!betAmount || betAmount <= 0) {
        this.wsServer.sendToClient(client.id, {
          type: 'dice_error',
          data: { message: 'Invalid bet amount' },
        });
        return;
      }

      if (!Number.isFinite(numericTarget) || numericTarget <= 0 || numericTarget >= 10000) {
        this.wsServer.sendToClient(client.id, {
          type: 'dice_error',
          data: { message: 'Target must be between 1 and 9999' },
        });
        return;
      }

      const balanceResult = await query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [client.userId]
      );

      if (balanceResult.rows[0].balance < betAmount) {
        this.wsServer.sendToClient(client.id, {
          type: 'dice_error',
          data: { message: 'Insufficient balance' },
        });
        return;
      }

      await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [
        betAmount,
        client.userId,
      ]);

      const seedPair = ProvablyFair.generateSeedPair();
      const result = ProvablyFair.generateDiceResult(
        seedPair.serverSeed,
        seedPair.clientSeed,
        Date.now()
      );

      const win = isRollOver ? result > numericTarget : result < numericTarget;
      const winChance = isRollOver ? (10000 - numericTarget) / 10000 : numericTarget / 10000;
      const rtpFactor = await economyRuntimeService.getRtpFactor('dice');
      const multiplier = win ? (rtpFactor / winChance) : 0;
      const payout = win ? Math.floor(betAmount * multiplier) : 0;

      if (win) {
        await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [
          payout,
          client.userId,
        ]);
      }

      this.wsServer.sendToClient(client.id, {
        type: 'dice_result',
        data: {
          result,
          win,
          payout,
          multiplier: multiplier.toFixed(2),
          serverSeed: seedPair.serverSeed,
          clientSeed: seedPair.clientSeed,
        },
      });
    } catch (error) {
      console.error('Error in dice game:', error);
    }
  }
}

export default DiceGameService;
