import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { economyRuntimeService } from '../EconomyRuntimeService.js';

// HiLo: Card prediction game
// Guess if next card is higher or lower than current
// Multiplier increases with each correct guess
// Can cashout anytime

interface Card {
  rank: number; // 1-13 (Ace=1 or 14 depending on game mode)
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  display: string;
}

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface HiLoState {
  currentCard: Card;
  cardsSeen: Card[];
  cardsRemaining: Card[];
  currentMultiplier: number;
  baseBet: number;
  started: boolean;
  finished: boolean;
  lastGuess?: 'higher' | 'lower' | 'equal';
  result?: 'WIN' | 'LOSS' | 'EQUAL';
  rtpFactor: number;
}

export class HiLoGameService {
  private wsServer: any;
  private activeGames: Map<string, HiLoState> = new Map();

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
      case 'guess':
        await this.handleGuess(client, msg.data);
        break;
      case 'cashout':
        await this.handleCashout(client);
        break;
      default:
        console.log('Unknown HiLo message type:', msg.type);
    }
  }

  private createCard(seed: string, index: number): Card {
    const hash = ProvablyFair.generateHash(seed, 'hilo', index);
    const random = ProvablyFair.hashToNumber(hash);
    
    const suitIndex = Math.floor(random * 4);
    const rankIndex = Math.floor(ProvablyFair.hashToNumber(hash, 1) * 13);
    
    return {
      suit: SUITS[suitIndex],
      rank: rankIndex + 1,
      display: `${RANKS[rankIndex]}${SUITS[suitIndex][0].toUpperCase()}`,
    };
  }

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({
          suit: SUITS[suit],
          rank,
          display: `${RANKS[rank - 1]}${SUITS[suit][0].toUpperCase()}`,
        });
      }
    }
    return deck;
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

      // Generate provably fair deck
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const nonce = await this.getNextNonce(client.userId!);
      const combinedSeed = ProvablyFair.generateHash(serverSeed, clientSeed, nonce);

      // Create and shuffle deck
      const deck = this.createDeck();
      const shuffledDeck = this.shuffleDeck(deck, combinedSeed);

      // First card
      const currentCard = shuffledDeck[0];
      const cardsRemaining = shuffledDeck.slice(1);

      // Deduct bet
      await query(
        'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
        [amount, client.userId]
      );

      // Store game state
      const gameState: HiLoState = {
        currentCard,
        cardsSeen: [currentCard],
        cardsRemaining,
        currentMultiplier: 1.0,
        baseBet: amount,
        started: true,
        finished: false,
        rtpFactor: await economyRuntimeService.getRtpFactor('hilo'),
      };

      this.activeGames.set(client.userId!, gameState);

      // Get updated balance
      const newBalance = await query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [client.userId]
      );

      // Send initial state
      this.wsServer.sendToClient(client.ws, {
        type: 'game_state',
        data: {
          betId,
          currentCard,
          currentMultiplier: 1.0,
          cardsRemaining: cardsRemaining.length,
          higherProbability: this.calculateProbability(currentCard.rank, cardsRemaining, 'higher'),
          lowerProbability: this.calculateProbability(currentCard.rank, cardsRemaining, 'lower'),
          balance: newBalance.rows[0].balance,
          serverSeedHash,
          clientSeed,
          nonce,
        },
      });

    } catch (err) {
      console.error('HiLo bet error:', err);
      this.sendError(client, 'Bet failed');
    }
  }

  private shuffleDeck(deck: Card[], seed: string): Card[] {
    const shuffled = [...deck];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const hash = ProvablyFair.generateHash(seed, 'shuffle', i);
      const random = ProvablyFair.hashToNumber(hash);
      const j = Math.floor(random * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  private calculateProbability(currentRank: number, remainingCards: Card[], guess: 'higher' | 'lower'): number {
    const totalCards = remainingCards.length;
    if (totalCards === 0) return 0;

    const targetCards = remainingCards.filter(c => 
      guess === 'higher' ? c.rank > currentRank : c.rank < currentRank
    ).length;

    return targetCards / totalCards;
  }

  private calculateMultiplier(currentRank: number, remainingCards: Card[], rtpFactor: number): { higher: number; lower: number } {
    const totalCards = remainingCards.length;
    if (totalCards === 0) return { higher: 1.0, lower: 1.0 };

    const higherCards = remainingCards.filter(c => c.rank > currentRank).length;
    const lowerCards = remainingCards.filter(c => c.rank < currentRank).length;

    // Multiplier = (total / winning) * RTP factor
    const higher = higherCards > 0 ? (totalCards / higherCards) * rtpFactor : 0;
    const lower = lowerCards > 0 ? (totalCards / lowerCards) * rtpFactor : 0;

    return { higher, lower };
  }

  private async handleGuess(client: Client, data: any): Promise<void> {
    const { guess } = data; // 'higher' or 'lower'
    
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }

    const nextCard = gameState.cardsRemaining[0];
    const isHigher = nextCard.rank > gameState.currentCard.rank;
    const isLower = nextCard.rank < gameState.currentCard.rank;
    const isEqual = nextCard.rank === gameState.currentCard.rank;

    let won = false;
    let result: 'WIN' | 'LOSS' | 'EQUAL' = 'LOSS';

    if (isEqual) {
      result = 'EQUAL';
      // Equal usually counts as loss or push depending on rules
      won = false;
    } else if (guess === 'higher' && isHigher) {
      won = true;
      result = 'WIN';
    } else if (guess === 'lower' && isLower) {
      won = true;
      result = 'WIN';
    }

    // Update game state
    gameState.cardsSeen.push(nextCard);
    gameState.cardsRemaining = gameState.cardsRemaining.slice(1);
    gameState.currentCard = nextCard;
    gameState.lastGuess = guess;

    if (!won || gameState.cardsRemaining.length === 0) {
      // Game over
      gameState.finished = true;
      gameState.result = result;

      // Record loss
      if (!won) {
        await this.recordGameResult(client, gameState);
      }
    } else {
      // Calculate new multiplier
      const multipliers = this.calculateMultiplier(nextCard.rank, gameState.cardsRemaining, gameState.rtpFactor);
      gameState.currentMultiplier = guess === 'higher' ? multipliers.higher : multipliers.lower;
    }

    // Get updated balance
    const newBalance = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [client.userId]
    );

    this.wsServer.sendToClient(client.ws, {
      type: 'guess_result',
      data: {
        previousCard: gameState.cardsSeen[gameState.cardsSeen.length - 2],
        newCard: nextCard,
        guess,
        result,
        won,
        currentMultiplier: gameState.currentMultiplier,
        cardsRemaining: gameState.cardsRemaining.length,
        higherProbability: this.calculateProbability(nextCard.rank, gameState.cardsRemaining, 'higher'),
        lowerProbability: this.calculateProbability(nextCard.rank, gameState.cardsRemaining, 'lower'),
        finished: gameState.finished,
        balance: newBalance.rows[0].balance,
      },
    });
  }

  private async handleCashout(client: Client): Promise<void> {
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished || !gameState.started) {
      this.sendError(client, 'No active game');
      return;
    }

    if (gameState.currentMultiplier <= 1.0) {
      this.sendError(client, 'Cannot cashout yet');
      return;
    }

    gameState.finished = true;
    gameState.result = 'WIN';

    const payout = Math.floor(gameState.baseBet * gameState.currentMultiplier);
    const profit = payout - gameState.baseBet;

    // Process payout
    await query('BEGIN');

    try {
      await query(
        'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
        [payout, client.userId]
      );

      await this.recordGameResult(client, gameState, payout, profit);

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
          balance: newBalance.rows[0].balance,
        },
      });

      this.activeGames.delete(client.userId!);

    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  private async recordGameResult(
    client: Client,
    gameState: HiLoState,
    payout?: number,
    profit?: number
  ): Promise<void> {
    // Create game session record
    // This is a simplified version - real implementation would store full game data
    const result = gameState.result || 'LOSS';
    const finalPayout = payout || 0;
    const finalProfit = profit || -gameState.baseBet;
    const multiplier = finalPayout / gameState.baseBet;

    await query(
      `INSERT INTO game_sessions 
       (user_id, game_type, bet_amount, multiplier, payout, result, game_data)
       VALUES ($1, 'hilo', $2, $3, $4, $5, $6)`,
      [client.userId, gameState.baseBet, multiplier, finalPayout, result,
       JSON.stringify({ cards: gameState.cardsSeen, finalMultiplier: gameState.currentMultiplier })]
    );

    if (finalPayout > 0) {
      await query(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
         SELECT $1, id, 'WIN', $2, 'COMPLETED', 'HiLo win'
         FROM wallets WHERE user_id = $1`,
        [client.userId, finalProfit]
      );
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

export default HiLoGameService;
