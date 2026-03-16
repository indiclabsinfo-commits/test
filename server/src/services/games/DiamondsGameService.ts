import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { economyRuntimeService } from '../EconomyRuntimeService.js';

// Diamonds: Match 3 gems slot-like game
// 5x3 grid, match gems for multipliers

const GEMS = [
  { type: 'DIAMOND', color: '#00ffff', value: 50 },
  { type: 'RUBY', color: '#ff0044', value: 20 },
  { type: 'EMERALD', color: '#00ff44', value: 15 },
  { type: 'SAPPHIRE', color: '#0044ff', value: 10 },
  { type: 'AMETHYST', color: '#8800ff', value: 8 },
  { type: 'GARNET', color: '#ff6600', value: 6 },
  { type: 'PEARL', color: '#f0f0f0', value: 4 },
  { type: 'COAL', color: '#444444', value: 0 }, // Losing symbol
];

// Multiplier table for matches (consecutive)
const PAYOUTS = {
  3: 0.5,
  4: 2,
  5: 5,
};

interface SpinResult {
  grid: string[][]; // 5 columns x 3 rows, values are gem types
  matches: { gem: string; count: number; positions: { col: number; row: number }[] }[];
  totalMultiplier: number;
}

export class DiamondsGameService {
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
        console.log('Unknown Diamonds message type:', msg.type);
    }
  }

  private generateSpin(seed: string, rtpFactor: number): SpinResult {
    const grid: string[][] = [];
    
    // Generate 5x3 grid (5 columns, 3 rows)
    for (let col = 0; col < 5; col++) {
      grid[col] = [];
      for (let row = 0; row < 3; row++) {
        const hash = ProvablyFair.generateHash(seed, 'diamonds', col * 3 + row);
        const random = ProvablyFair.hashToNumber(hash);
        
        // Weighted random selection
        const gemIndex = this.weightedRandomIndex(random);
        grid[col][row] = GEMS[gemIndex].type;
      }
    }
    
    // Find matches (consecutive gems in a row, left to right)
    const matches = this.findMatches(grid);
    
    // Calculate total multiplier
    let totalMultiplier = 0;
    for (const match of matches) {
      totalMultiplier += PAYOUTS[match.count as keyof typeof PAYOUTS] || 0;
    }
    
    // Apply global house edge policy
    totalMultiplier = Math.floor(totalMultiplier * rtpFactor * 100) / 100;
    
    return { grid, matches, totalMultiplier };
  }

  private weightedRandomIndex(random: number): number {
    // Define weights (higher value gems are rarer)
    const weights = [5, 8, 10, 12, 15, 18, 20, 12]; // Weights for each gem
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    let randomValue = random * totalWeight;
    
    for (let i = 0; i < weights.length; i++) {
      randomValue -= weights[i];
      if (randomValue <= 0) return i;
    }
    
    return 0;
  }

  private findMatches(grid: string[][]): SpinResult['matches'] {
    const matches: SpinResult['matches'] = [];
    const rows = 3;
    const cols = 5;
    
    // Check each row for consecutive matches
    for (let row = 0; row < rows; row++) {
      let currentMatch = {
        gem: grid[0][row],
        count: 1,
        positions: [{ col: 0, row }],
      };
      
      for (let col = 1; col < cols; col++) {
        if (grid[col][row] === currentMatch.gem) {
          currentMatch.count++;
          currentMatch.positions.push({ col, row });
        } else {
          // Save match if count >= 3
          if (currentMatch.count >= 3) {
            matches.push(currentMatch);
          }
          // Start new match
          currentMatch = {
            gem: grid[col][row],
            count: 1,
            positions: [{ col, row }],
          };
        }
      }
      
      // Check final match
      if (currentMatch.count >= 3) {
        matches.push(currentMatch);
      }
    }
    
    return matches;
  }

  private async handlePlaceBet(client: Client, data: any): Promise<void> {
    const { betId, amount, clientSeed } = data;

    if (!amount || amount <= 0) {
      this.sendError(client, 'Invalid bet amount');
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

      // Generate provably fair spin
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const nonce = await this.getNextNonce(client.userId!);
      const combinedSeed = ProvablyFair.generateHash(serverSeed, clientSeed, nonce);

      const rtpFactor = await economyRuntimeService.getRtpFactor('diamonds');
      const spinResult = this.generateSpin(combinedSeed, rtpFactor);

      // Calculate payout
      const won = spinResult.totalMultiplier > 0;
      const payout = won ? Math.floor(amount * spinResult.totalMultiplier) : 0;
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
           VALUES ($1, 'diamonds', $2, $3, $4, $5, $6, $7) RETURNING id`,
          [client.userId, amount, spinResult.totalMultiplier, payout, won ? 'WIN' : 'LOSS',
           pfResult.rows[0].id, JSON.stringify(spinResult)]
        );

        // Bet transaction
        await query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
           SELECT $1, id, 'BET', $2, 'COMPLETED', $3, 'Diamonds bet'
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
             SELECT $1, id, 'WIN', $2, 'COMPLETED', $3, 'Diamonds win'
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

        // Convert grid to gem objects for frontend
        const gridGems = spinResult.grid.map((col, colIndex) =>
          col.map((gemType, rowIndex) => {
            const gem = GEMS.find(g => g.type === gemType)!;
            return {
              ...gem,
              isMatch: spinResult.matches.some(m => 
                m.positions.some(p => p.col === colIndex && p.row === rowIndex)
              ),
            };
          })
        );

        // Send result
        this.wsServer.sendToClient(client.ws, {
          type: 'spin_result',
          data: {
            betId,
            grid: gridGems,
            matches: spinResult.matches,
            totalMultiplier: spinResult.totalMultiplier,
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
      console.error('Diamonds bet error:', err);
      this.sendError(client, 'Bet failed');
    }
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

export default DiamondsGameService;
