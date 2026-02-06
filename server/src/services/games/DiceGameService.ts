import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';

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

      const win = rollOver ? result > target : result < target;
      const winChance = rollOver ? (10000 - target) / 10000 : target / 10000;
      const multiplier = win ? (0.99 / winChance) : 0;
      const payout = win ? betAmount * multiplier : 0;

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
