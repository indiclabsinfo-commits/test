import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';

const PLINKO_PAYOUTS = {
  low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
};

export class PlinkoGameService {
  private wsServer: any;

  constructor(wsServer: any) {
    this.wsServer = wsServer;
  }

  public async handleMessage(client: Client, msg: GameMessage): Promise<void> {
    if (msg.type === 'drop') {
      await this.handleDrop(client, msg.data);
    }
  }

  private async handleDrop(
    client: Client,
    data: { betAmount: number; risk: 'low' | 'medium' | 'high' }
  ): Promise<void> {
    try {
      const { betAmount, risk } = data;
      const rows = 16;

      const balanceResult = await query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [client.userId]
      );

      if (balanceResult.rows[0].balance < betAmount) {
        this.wsServer.sendToClient(client.id, {
          type: 'plinko_error',
          data: { message: 'Insufficient balance' },
        });
        return;
      }

      await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [
        betAmount,
        client.userId,
      ]);

      const seedPair = ProvablyFair.generateSeedPair();
      const path = ProvablyFair.generatePlinkoPath(
        seedPair.serverSeed,
        seedPair.clientSeed,
        Date.now(),
        rows
      );

      const finalPosition = path.reduce((sum, direction) => sum + direction, 0);
      const multiplier = PLINKO_PAYOUTS[risk][finalPosition];
      const payout = betAmount * multiplier;

      await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [
        payout,
        client.userId,
      ]);

      this.wsServer.sendToClient(client.id, {
        type: 'plinko_result',
        data: {
          path,
          finalPosition,
          multiplier,
          payout,
          serverSeed: seedPair.serverSeed,
        },
      });
    } catch (error) {
      console.error('Error in plinko game:', error);
    }
  }
}

export default PlinkoGameService;
