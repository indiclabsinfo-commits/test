import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { DEFAULT_RTP_FACTOR } from '../../config/gameEconomy.js';

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

      if (!betAmount || betAmount <= 0) {
        this.wsServer.sendToClient(client.id, {
          type: 'mines_error',
          data: { message: 'Invalid bet amount' },
        });
        return;
      }

      if (mineCount < 1 || mineCount > 24) {
        this.wsServer.sendToClient(client.id, {
          type: 'mines_error',
          data: { message: 'Invalid mine count' },
        });
        return;
      }

      const existingSession = this.sessions.get(client.userId);
      if (existingSession?.active) {
        this.wsServer.sendToClient(client.id, {
          type: 'mines_error',
          data: { message: 'Finish current game first' },
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
    const { tileIndex } = data;

    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= session.gridSize) {
      this.wsServer.sendToClient(client.id, {
        type: 'mines_error',
        data: { message: 'Invalid tile index' },
      });
      return;
    }

    // Prevent replaying already revealed tiles to farm multiplier.
    if (session.revealedTiles.includes(tileIndex)) {
      this.wsServer.sendToClient(client.id, {
        type: 'mines_error',
        data: { message: 'Tile already revealed' },
      });
      return;
    }

    if (session.minePositions.includes(tileIndex)) {
      session.active = false;
      await query('UPDATE users SET total_lost = total_lost + $1 WHERE id = $2', [
        session.betAmount,
        client.userId,
      ]);

      this.wsServer.sendToClient(client.id, {
        type: 'mines_hit',
        data: {
          tileIndex,
          minePositions: session.minePositions,
          serverSeed: session.serverSeed,
        },
      });
      this.sessions.delete(client.userId);
    } else {
      session.revealedTiles.push(tileIndex);
      session.currentMultiplier = this.calculateMultiplier(
        session.revealedTiles.length,
        session.mineCount,
        session.gridSize
      );

      this.wsServer.sendToClient(client.id, {
        type: 'mines_safe',
        data: {
          tileIndex,
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

    // Fair odds for each safe pick: (remaining total / remaining safe)
    for (let i = 0; i < revealed; i++) {
      multiplier *= (total - i) / (safe - i);
    }
    return Number((multiplier * DEFAULT_RTP_FACTOR).toFixed(2));
  }
}

export default MinesGameService;
