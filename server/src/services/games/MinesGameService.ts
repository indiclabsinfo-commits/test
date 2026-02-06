import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';

interface MinesSession {
  userId: string;
  betAmount: number;
  mineCount: number;
  gridSize: number;
  minePositions: number[];
  revealedTiles: number[];
  currentMultiplier: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  active: boolean;
}

export class MinesGameService {
  private wsServer: any;
  private sessions: Map<string, MinesSession> = new Map();

  constructor(wsServer: any) {
    this.wsServer = wsServer;
  }

  public async handleMessage(client: Client, msg: GameMessage): Promise<void> {
    switch (msg.type) {
      case 'start_game':
        await this.startGame(client, msg.data);
        break;
      case 'reveal_tile':
        await this.revealTile(client, msg.data);
        break;
      case 'cashout':
        await this.cashout(client);
        break;
      default:
        this.wsServer.sendToClient(client.id, {
          type: 'error',
          data: { message: 'Unknown message type' },
        });
    }
  }

  private async startGame(
    client: Client,
    data: { betAmount: number; mineCount: number }
  ): Promise<void> {
    try {
      const { betAmount, mineCount } = data;
      const gridSize = 25;

      if (mineCount < 1 || mineCount > 24) {
        this.wsServer.sendToClient(client.id, {
          type: 'mines_error',
          data: { message: 'Invalid mine count' },
        });
        return;
      }

      const balanceResult = await query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [client.userId]
      );

      if (balanceResult.rows[0].balance < betAmount) {
        this.wsServer.sendToClient(client.id, {
          type: 'mines_error',
          data: { message: 'Insufficient balance' },
        });
        return;
      }

      await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [
        betAmount,
        client.userId,
      ]);

      const seedPair = ProvablyFair.generateSeedPair();
      const minePositions = ProvablyFair.generateMinePositions(
        seedPair.serverSeed,
        seedPair.clientSeed,
        Date.now(),
        gridSize,
        mineCount
      );

      const session: MinesSession = {
        userId: client.userId,
        betAmount,
        mineCount,
        gridSize,
        minePositions,
        revealedTiles: [],
        currentMultiplier: 1.0,
        serverSeed: seedPair.serverSeed,
        clientSeed: seedPair.clientSeed,
        nonce: Date.now(),
        active: true,
      };

      this.sessions.set(client.userId, session);

      this.wsServer.sendToClient(client.id, {
        type: 'mines_started',
        data: {
          serverSeedHash: seedPair.serverSeedHash,
          gridSize,
          mineCount,
        },
      });
    } catch (error) {
      console.error('Error starting mines game:', error);
    }
  }

  private async revealTile(client: Client, data: { tileIndex: number }): Promise<void> {
    const session = this.sessions.get(client.userId);
    if (!session || !session.active) return;

    if (session.minePositions.includes(data.tileIndex)) {
      session.active = false;
      await query('UPDATE users SET total_lost = total_lost + $1 WHERE id = $2', [
        session.betAmount,
        client.userId,
      ]);

      this.wsServer.sendToClient(client.id, {
        type: 'mines_hit',
        data: {
          tileIndex: data.tileIndex,
          minePositions: session.minePositions,
          serverSeed: session.serverSeed,
        },
      });
    } else {
      session.revealedTiles.push(data.tileIndex);
      session.currentMultiplier = this.calculateMultiplier(
        session.revealedTiles.length,
        session.mineCount,
        session.gridSize
      );

      this.wsServer.sendToClient(client.id, {
        type: 'mines_safe',
        data: {
          tileIndex: data.tileIndex,
          multiplier: session.currentMultiplier,
        },
      });
    }
  }

  private async cashout(client: Client): Promise<void> {
    const session = this.sessions.get(client.userId);
    if (!session || !session.active) return;

    const payout = session.betAmount * session.currentMultiplier;
    await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [payout, client.userId]);

    this.wsServer.sendToClient(client.id, {
      type: 'mines_cashout',
      data: {
        payout,
        multiplier: session.currentMultiplier,
        minePositions: session.minePositions,
      },
    });

    this.sessions.delete(client.userId);
  }

  private calculateMultiplier(revealed: number, mines: number, total: number): number {
    const safe = total - mines;
    let multiplier = 1.0;
    for (let i = 0; i < revealed; i++) {
      multiplier *= (safe - i) / (total - i - mines);
    }
    return Number((multiplier * 0.97).toFixed(2)); // 3% house edge
  }
}

export default MinesGameService;
