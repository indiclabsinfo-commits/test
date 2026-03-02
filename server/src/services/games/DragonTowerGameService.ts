import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';

// Dragon Tower: Climbing game
// 4 rows, 3 columns per row
// Click tiles to climb higher

type TileType = 'SAFE' | 'TRAP';

interface TowerRow {
  tiles: TileType[];
  revealed: boolean[];
}

interface DragonTowerState {
  rows: TowerRow[];
  currentRow: number;
  baseBet: number;
  currentMultiplier: number;
  finished: boolean;
  won: boolean;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

const MULTIPLIERS = [1.48, 2.21, 3.31, 4.96, 7.44, 11.16, 16.74, 25.11, 37.66, 56.49];

export class DragonTowerGameService {
  private wsServer: any;
  private activeGames: Map<string, DragonTowerState> = new Map();
  private readonly DIFFICULTY = {
    EASY: 1,      // 1 trap per row
    MEDIUM: 2,    // 2 traps per row
    HARD: 3,      // 3 traps per row (impossible to reach top)
  };

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
      case 'reveal_tile':
        await this.handleRevealTile(client, msg.data);
        break;
      case 'cashout':
        await this.handleCashout(client);
        break;
      default:
        console.log('Unknown Dragon Tower message type:', msg.type);
    }
  }

  private generateTower(seed: string, difficulty: number): TowerRow[] {
    const rows: TowerRow[] = [];
    
    for (let row = 0; row < 10; row++) {
      const tiles: TileType[] = Array(3).fill('SAFE');
      const trapsToPlace = Math.min(difficulty, 2); // Max 2 traps so it's winnable
      
      // Place traps using provably fair random
      const hash = ProvablyFair.generateHash(seed, 'tower', row);
      const trapPositions = new Set<number>();
      
      while (trapPositions.size < trapsToPlace) {
        const random = ProvablyFair.hashToNumber(hash, trapPositions.size);
        const pos = Math.floor(random * 3);
        if (!trapPositions.has(pos)) {
          trapPositions.add(pos);
          tiles[pos] = 'TRAP';
        }
      }
      
      rows.push({
        tiles,
        revealed: [false, false, false],
      });
    }
    
    return rows;
  }

  private async handlePlaceBet(client: Client, data: any): Promise<void> {
    const { betId, amount, clientSeed, difficulty = 'MEDIUM' } = data;

    if (!amount || amount <= 0) {
      this.sendError(client, 'Invalid bet amount');
      return;
    }

    const difficultyLevel = this.DIFFICULTY[difficulty as keyof typeof this.DIFFICULTY] || 2;

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

      // Generate provably fair tower
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const nonce = await this.getNextNonce(client.userId!);
      const combinedSeed = ProvablyFair.generateHash(serverSeed, clientSeed, nonce);

      // Create tower
      const rows = this.generateTower(combinedSeed, difficultyLevel);

      // Deduct bet
      await query(
        'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
        [amount, client.userId]
      );

      // Store game state
      const gameState: DragonTowerState = {
        rows,
        currentRow: 0,
        baseBet: amount,
        currentMultiplier: 1.0,
        finished: false,
        won: false,
        serverSeed,
        clientSeed,
        nonce,
      };

      this.activeGames.set(client.userId!, gameState);

      // Get updated balance
      const newBalance = await query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [client.userId]
      );

      // Send initial tower state (hide traps)
      this.wsServer.sendToClient(client.ws, {
        type: 'game_state',
        data: {
          betId,
          rows: rows.map(r => ({ tiles: r.tiles.map(() => '?'), revealed: r.revealed })),
          currentRow: 0,
          currentMultiplier: 1.0,
          nextMultiplier: MULTIPLIERS[0],
          difficulty,
          balance: newBalance.rows[0].balance,
          serverSeedHash,
          clientSeed,
          nonce,
        },
      });

    } catch (err) {
      console.error('Dragon Tower bet error:', err);
      this.sendError(client, 'Bet failed');
    }
  }

  private async handleRevealTile(client: Client, data: any): Promise<void> {
    const { row, col } = data;
    
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }

    if (row !== gameState.currentRow) {
      this.sendError(client, 'Must complete current row');
      return;
    }

    if (col < 0 || col > 2) {
      this.sendError(client, 'Invalid column');
      return;
    }

    if (gameState.rows[row].revealed[col]) {
      this.sendError(client, 'Tile already revealed');
      return;
    }

    // Reveal tile
    gameState.rows[row].revealed[col] = true;
    const isTrap = gameState.rows[row].tiles[col] === 'TRAP';

    if (isTrap) {
      // Game over - hit trap
      gameState.finished = true;
      gameState.won = false;
      
      await this.recordLoss(client, gameState);

      // Get updated balance
      const newBalance = await query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [client.userId]
      );

      this.wsServer.sendToClient(client.ws, {
        type: 'reveal_result',
        data: {
          row,
          col,
          tile: 'TRAP',
          result: 'LOSS',
          payout: 0,
          profit: -gameState.baseBet,
          revealAll: true,
          balance: newBalance.rows[0].balance,
        },
      });

      this.activeGames.delete(client.userId!);

    } else {
      // Safe - can continue
      gameState.currentRow++;
      gameState.currentMultiplier = MULTIPLIERS[gameState.currentRow - 1];

      // Check if reached top (win automatically)
      if (gameState.currentRow >= gameState.rows.length) {
        gameState.finished = true;
        gameState.won = true;
        await this.handleCashout(client);
        return;
      }

      this.wsServer.sendToClient(client.ws, {
        type: 'reveal_result',
        data: {
          row,
          col,
          tile: 'SAFE',
          result: 'CONTINUE',
          currentRow: gameState.currentRow,
          currentMultiplier: gameState.currentMultiplier,
          nextMultiplier: MULTIPLIERS[gameState.currentRow],
          canCashout: true,
        },
      });
    }
  }

  private async handleCashout(client: Client): Promise<void> {
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }

    if (gameState.currentRow === 0) {
      this.sendError(client, 'Must reveal at least one tile');
      return;
    }

    gameState.finished = true;
    gameState.won = true;

    const payout = Math.floor(gameState.baseBet * gameState.currentMultiplier);
    const profit = payout - gameState.baseBet;

    await query('BEGIN');

    try {
      // Credit payout
      await query(
        'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
        [payout, client.userId]
      );

      // Record game
      await query(
        `INSERT INTO game_sessions 
         (user_id, game_type, bet_amount, multiplier, payout, result, provably_fair_seed_id, game_data)
         VALUES ($1, 'dragon_tower', $2, $3, $4, 'WIN', 
           (INSERT INTO provably_fair_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, revealed)
            VALUES ($1, $5, $6, $7, $8, TRUE) RETURNING id),
           $9)`,
        [client.userId, gameState.baseBet, gameState.currentMultiplier, payout,
         gameState.serverSeed, ProvablyFair.hashServerSeed(gameState.serverSeed),
         gameState.clientSeed, gameState.nonce,
         JSON.stringify({ finalRow: gameState.currentRow, rows: gameState.rows })]
      );

      await query(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
         SELECT $1, id, 'WIN', $2, 'COMPLETED', 'Dragon Tower cashout'
         FROM wallets WHERE user_id = $1`,
        [client.userId, profit]
      );

      await query('COMMIT');

      const newBalance = await query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [client.userId]
      );

      this.wsServer.sendToClient(client.ws, {
        type: 'cashout_result',
        data: {
          multiplier: gameState.currentMultiplier,
          payout,
          profit,
          revealAll: true,
          balance: newBalance.rows[0].balance,
        },
      });

      this.activeGames.delete(client.userId!);

    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  private async recordLoss(client: Client, gameState: DragonTowerState): Promise<void> {
    await query(
      `INSERT INTO game_sessions 
       (user_id, game_type, bet_amount, multiplier, payout, result, provably_fair_seed_id, game_data)
       VALUES ($1, 'dragon_tower', $2, 0, 0, 'LOSS',
         (INSERT INTO provably_fair_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, revealed)
          VALUES ($1, $3, $4, $5, $6, TRUE) RETURNING id),
         $7)`,
      [client.userId, gameState.baseBet, gameState.serverSeed,
       ProvablyFair.hashServerSeed(gameState.serverSeed), gameState.clientSeed, gameState.nonce,
       JSON.stringify({ finalRow: gameState.currentRow, rows: gameState.rows })]
    );

    await query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
       SELECT $1, id, 'BET', $2, 'COMPLETED', 'Dragon Tower bet'
       FROM wallets WHERE user_id = $1`,
      [client.userId, gameState.baseBet]
    );
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

export default DragonTowerGameService;
