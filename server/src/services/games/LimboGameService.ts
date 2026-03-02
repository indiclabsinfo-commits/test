import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { redisClient } from '../../config/redis.js';
import { DEFAULT_RTP_FACTOR } from '../../config/gameEconomy.js';

// Limbo: Predict if result will exceed target multiplier
// Uses global house edge policy

export class LimboGameService {
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
        console.log('Unknown Limbo message type:', msg.type);
    }
  }

  private async handlePlaceBet(client: Client, data: any): Promise<void> {
    const { betId, amount, clientSeed, targetMultiplier } = data;
    
    if (!client.userId) {
      this.sendError(client, 'Not authenticated');
      return;
    }
    
    if (!amount || amount <= 0) {
      this.sendError(client, 'Invalid bet amount');
      return;
    }
    
    if (!targetMultiplier || targetMultiplier < 1.01) {
      this.sendError(client, 'Invalid target multiplier');
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
      
      // Generate provably fair result
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const nonce = await this.getNextNonce(client.userId);
      
      // Generate result (exponential distribution)
      // Formula: RTP / (1 - random)
      const random = ProvablyFair.hashToNumber(
        ProvablyFair.generateHash(serverSeed, clientSeed, nonce)
      );
      
      const resultMultiplier = DEFAULT_RTP_FACTOR / (1 - random);
      const finalMultiplier = Math.min(100000, Math.max(1, resultMultiplier));
      
      const won = finalMultiplier >= targetMultiplier;
      const payout = won ? Math.floor(amount * targetMultiplier) : 0;
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
        const sessionResult = await query(
          `INSERT INTO game_sessions 
           (user_id, game_type, bet_amount, multiplier, payout, result, provably_fair_seed_id)
           VALUES ($1, 'limbo', $2, $3, $4, $5, 
             (INSERT INTO provably_fair_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, revealed)
              VALUES ($1, $6, $7, $8, $9, true) RETURNING id))
           RETURNING id`,
          [client.userId, amount, finalMultiplier, payout, won ? 'WIN' : 'LOSS', 
           serverSeed, serverSeedHash, clientSeed, nonce]
        );
        
        // Create transaction record
        if (payout > 0) {
          await query(
            'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
            [payout, client.userId]
          );
          
          await query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
             SELECT $1, id, 'WIN', $2, 'COMPLETED', $3, 'Limbo win'
             FROM wallets WHERE user_id = $1`,
            [client.userId, profit, sessionResult.rows[0].id]
          );
        }
        
        // Bet transaction
        await query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
           SELECT $1, id, 'BET', $2, 'COMPLETED', $3, 'Limbo bet'
           FROM wallets WHERE user_id = $1`,
          [client.userId, amount, sessionResult.rows[0].id]
        );
        
        await query('COMMIT');
        
        // Get updated balance
        const newBalance = await query(
          'SELECT balance FROM wallets WHERE user_id = $1',
          [client.userId]
        );
        
        // Send result
        this.wsServer.sendToClient(client.ws, {
          type: 'bet_result',
          data: {
            betId,
            result: finalMultiplier,
            target: targetMultiplier,
            won,
            payout: won ? profit : -amount,
            serverSeedHash,
            clientSeed,
            nonce,
            balance: newBalance.rows[0].balance,
          },
        });
        
        // Broadcast balance update
        this.wsServer.sendToClient(client.ws, {
          type: 'balance_update',
          data: { balance: newBalance.rows[0].balance },
        });
        
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }
      
    } catch (err) {
      console.error('Limbo bet error:', err);
      this.sendError(client, 'Bet failed');
    }
  }
  
  private async getNextNonce(userId: string): Promise<number> {
    const result = await query(
      'SELECT MAX(nonce) as max_nonce FROM provably_fair_seeds WHERE user_id = $1',
      [userId]
    );
    return (result.rows[0]?.max_nonce || 0) + 1;
  }
  
  private sendError(client: Client, message: string): void {
    this.wsServer.sendToClient(client.ws, {
      type: 'error',
      data: { message },
    });
  }
}
