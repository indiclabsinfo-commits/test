import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';
import { economyRuntimeService } from '../EconomyRuntimeService.js';

// Blackjack: Classic card game
// Player vs Dealer, standard rules

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
  display: string;
}

const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 11
};

const BLACKJACK_BASELINE_RTP = 0.995;

interface BlackjackState {
  playerHands: Card[][];
  dealerHand: Card[];
  currentHandIndex: number;
  bet: number;
  doubledDown: boolean[];
  surrendered: boolean;
  finished: boolean;
}

export class BlackjackGameService {
  private wsServer: any;
  private activeGames: Map<string, BlackjackState> = new Map();

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
      case 'hit':
        await this.handleHit(client);
        break;
      case 'stand':
        await this.handleStand(client);
        break;
      case 'double':
        await this.handleDouble(client);
        break;
      case 'split':
        await this.handleSplit(client);
        break;
      case 'surrender':
        await this.handleSurrender(client);
        break;
      default:
        console.log('Unknown Blackjack message type:', msg.type);
    }
  }

  private createCard(seed: string, index: number): Card {
    // Use provably fair to determine card
    const hash = ProvablyFair.generateHash(seed, 'blackjack_deck', index);
    const randomValue = ProvablyFair.hashToNumber(hash);
    
    const suitIndex = Math.floor(randomValue * 4);
    const rankIndex = Math.floor(randomValue * 13);
    
    const suit = SUITS[suitIndex];
    const rank = RANKS[rankIndex];
    
    return {
      suit,
      rank,
      value: VALUES[rank],
      display: `${rank}${suit[0].toUpperCase()}`
    };
  }

  private async getPayoutScale(): Promise<number> {
    const rtpFactor = await economyRuntimeService.getRtpFactor('blackjack');
    return Math.max(0.7, Math.min(1.2, rtpFactor / BLACKJACK_BASELINE_RTP));
  }

  private getStandardWinPayout(bet: number, payoutScale: number): number {
    return bet + Math.floor(bet * payoutScale);
  }

  private getBlackjackPayout(bet: number, payoutScale: number): number {
    return bet + Math.floor(bet * 1.5 * payoutScale);
  }

  private calculateHandValue(hand: Card[]): { total: number; soft: boolean; bust: boolean } {
    let total = 0;
    let aces = 0;
    
    for (const card of hand) {
      if (card.rank === 'A') {
        aces++;
        total += 11;
      } else {
        total += card.value;
      }
    }
    
    // Adjust Aces
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    
    return {
      total,
      soft: aces > 0,
      bust: total > 21
    };
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
        'SELECT balance, id FROM wallets WHERE user_id = $1 FOR UPDATE',
        [client.userId]
      );
      
      if (balanceCheck.rows.length === 0 || balanceCheck.rows[0].balance < amount) {
        this.sendError(client, 'Insufficient balance');
        return;
      }
      
      const serverSeed = ProvablyFair.generateServerSeed();
      const serverSeedHash = ProvablyFair.hashServerSeed(serverSeed);
      const nonce = await this.getNextNonce(client.userId);
      const combinedSeed = ProvablyFair.generateHash(serverSeed, clientSeed, nonce);
      
      // Deal initial cards
      const playerHand = [
        this.createCard(combinedSeed, 0),
        this.createCard(combinedSeed, 1)
      ];
      const dealerHand = [
        this.createCard(combinedSeed, 2),
        this.createCard(combinedSeed, 3)
      ];
      
      const playerValue = this.calculateHandValue(playerHand);
      const dealerValue = this.calculateHandValue([dealerHand[0]]);
      
      // Check for naturals
      const isPlayerBlackjack = playerHand.length === 2 && playerValue.total === 21;
      const isDealerBlackjack = dealerHand.length === 2 
        && this.calculateHandValue(dealerHand).total === 21;
      
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
           (user_id, game_type, bet_amount, multiplier, payout, result, provably_fair_seed_id)
           VALUES ($1, 'blackjack', $2, $3, $4, $5, $6)
           RETURNING id`,
          [client.userId, amount, 0, 0, 'PENDING', pfResult.rows[0].id]
        );
        
        await query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
           VALUES ($1, $2, 'BET', $3, 'COMPLETED', $4, 'Blackjack bet')`,
          [client.userId, balanceCheck.rows[0].id, amount, sessionResult.rows[0].id]
        );
        
        await query('COMMIT');
        
        // Store game state
        const gameState: BlackjackState = {
          playerHands: [playerHand],
          dealerHand,
          currentHandIndex: 0,
          bet: amount,
          doubledDown: [false],
          surrendered: false,
          finished: false
        };
        
        this.activeGames.set(client.userId!, gameState);
        
        let payout = 0;
        let result = 'PENDING';
        
        // Handle blackjack scenarios
        if (isPlayerBlackjack) {
          if (isDealerBlackjack) {
            // Push - return bet
            result = 'PUSH';
            payout = amount;
          } else {
            // Player blackjack pays 3:2
            result = 'WIN';
            const payoutScale = await this.getPayoutScale();
            payout = this.getBlackjackPayout(amount, payoutScale);
          }
          gameState.finished = true;
          await this.finalizeGame(client, gameState, payout, result, sessionResult.rows[0].id);
        }
        
        // Get updated balance
        const newBalance = await query(
          'SELECT balance FROM wallets WHERE user_id = $1',
          [client.userId]
        );
        
        this.wsServer.sendToClient(client.ws, {
          type: 'game_state',
          data: {
            betId,
            playerHands: gameState.playerHands,
            playerValues: gameState.playerHands.map(h => this.calculateHandValue(h)),
            dealerHand: isPlayerBlackjack ? dealerHand : [dealerHand[0], null],
            dealerValue: isPlayerBlackjack 
              ? this.calculateHandValue(dealerHand) 
              : dealerValue,
            canHit: !gameState.finished ,
            canStand: !gameState.finished,
            canDouble: !gameState.finished && playerHand.length === 2,
            canSplit: !gameState.finished
              && playerHand.length === 2
              && playerHand[0].rank === playerHand[1].rank && gameState.playerHands.length < 4,
            balance: newBalance.rows[0].balance,
            result: gameState.finished ? result : null,
            payout: gameState.finished ? payout - amount : 0,
          },
        });
        
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }
      
    } catch (err) {
      console.error('Blackjack bet error:', err);
      this.sendError(client, 'Bet failed');
    }
  }

  private async handleHit(client: Client): Promise<void> {
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    const cardIndex = 4 + currentHand.length; // Continue from initial deal
    
    // Get game seed for new card
    const pfResult = await query(
      `SELECT ps.server_seed, ps.client_seed, ps.nonce
       FROM game_sessions gs
       JOIN provably_fair_seeds ps ON gs.provably_fair_seed_id = ps.id
       WHERE gs.user_id = $1 AND gs.game_type = 'blackjack' AND gs.result = 'PENDING'
       ORDER BY gs.created_at DESC LIMIT 1`,
      [client.userId]
    );

    if (pfResult.rows.length === 0) {
      this.sendError(client, 'Game not found');
      return;
    }
    
    const { server_seed, client_seed, nonce } = pfResult.rows[0];
    const seed = ProvablyFair.generateHash(server_seed, client_seed, nonce);
    
    const newCard = this.createCard(seed, cardIndex);
    currentHand.push(newCard);
    
    const handValue = this.calculateHandValue(currentHand);
    
    // Check if bust
    if (handValue.bust) {
      // Move to next hand or finish
      if (gameState.currentHandIndex < gameState.playerHands.length - 1) {
        gameState.currentHandIndex++;
      } else {
        await this.finishGame(client, gameState);
        return;
      }
    }
    
    this.sendGameState(client, gameState);
  }

  private async handleStand(client: Client): Promise<void> {
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }
    
    if (gameState.currentHandIndex < gameState.playerHands.length - 1) {
      gameState.currentHandIndex++;
      this.sendGameState(client, gameState);
    } else {
      await this.finishGame(client, gameState);
    }
  }

  private async handleDouble(client: Client): Promise<void> {
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    if (currentHand.length !== 2) {
      this.sendError(client, 'Can only double on first two cards');
      return;
    }
    
    // Check balance for double
    const balanceCheck = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [client.userId]
    );
    
    if (balanceCheck.rows[0].balance < gameState.bet) {
      this.sendError(client, 'Insufficient balance');
      return;
    }
    
    // Double the bet
    await query(
      'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
      [gameState.bet, client.userId]
    );
    
    gameState.doubledDown[gameState.currentHandIndex] = true;
    
    // Deal one card
    await this.handleHit(client);
    
    // Automatically stand after double
    if (!this.calculateHandValue(currentHand).bust) {
      await this.handleStand(client);
    }
  }

  private async handleSplit(client: Client): Promise<void> {
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    if (currentHand.length !== 2 || currentHand[0].rank !== currentHand[1].rank) {
      this.sendError(client, 'Cannot split');
      return;
    }
    
    if (gameState.playerHands.length >= 4) {
      this.sendError(client, 'Maximum hands reached');
      return;
    }
    
    // Check balance for split
    const balanceCheck = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [client.userId]
    );
    
    if (balanceCheck.rows[0].balance < gameState.bet) {
      this.sendError(client, 'Insufficient balance');
      return;
    }
    
    // Split the hand
    const card1 = currentHand[0];
    const card2 = currentHand[1];
    
    currentHand.length = 0;
    currentHand.push(card1);
    
    const newHand = [card2];
    gameState.playerHands.splice(gameState.currentHandIndex + 1, 0, newHand);
    gameState.doubledDown.splice(gameState.currentHandIndex + 1, 0, false);
    
    // Deduct additional bet
    await query(
      'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
      [gameState.bet, client.userId]
    );
    
    // Deal cards to both hands
    await this.handleHit(client);
    // Switch to new hand and hit
    gameState.currentHandIndex++;
    await this.handleHit(client);
    // Go back to first hand
    gameState.currentHandIndex--;
    
    this.sendGameState(client, gameState);
  }

  private async handleSurrender(client: Client): Promise<void> {
    const gameState = this.activeGames.get(client.userId!);
    if (!gameState || gameState.finished) {
      this.sendError(client, 'No active game');
      return;
    }
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    if (currentHand.length !== 2 || gameState.playerHands.length > 1) {
      this.sendError(client, 'Cannot surrender');
      return;
    }
    
    gameState.surrendered = true;
    gameState.finished = true;
    
    // Return half the bet
    const refund = Math.floor(gameState.bet / 2);
    await this.finalizeGame(client, gameState, refund, 'SURRENDER', null);
    this.sendGameState(client, gameState);
  }

  private async finishGame(client: Client, gameState: BlackjackState): Promise<void> {
    // Dealer draws to 17 (soft 17 stands)
    let dealerValue = this.calculateHandValue(gameState.dealerHand);
    
    // Get game seed
    const pfResult = await query(
      `SELECT ps.server_seed, ps.client_seed, ps.nonce, gs.id as session_id, gs.bet_amount
       FROM game_sessions gs
       JOIN provably_fair_seeds ps ON gs.provably_fair_seed_id = ps.id
       WHERE gs.user_id = $1 AND gs.game_type = 'blackjack' AND gs.result = 'PENDING'
       ORDER BY gs.created_at DESC LIMIT 1`,
      [client.userId]
    );
    
    if (pfResult.rows.length === 0) return;
    
    const { server_seed, client_seed, nonce, session_id, bet_amount } = pfResult.rows[0];
    const seed = ProvablyFair.generateHash(server_seed, client_seed, nonce);
    
    let cardIndex = 4;
    for (const hand of gameState.playerHands) {
      cardIndex += hand.length;
    }
    
    // Dealer draws
    while (dealerValue.total < 17) {
      const newCard = this.createCard(seed, cardIndex++);
      gameState.dealerHand.push(newCard);
      dealerValue = this.calculateHandValue(gameState.dealerHand);
    }
    
    gameState.finished = true;
    
    // Calculate payouts for each hand
    let totalPayout = 0;
    const dealerBust = dealerValue.bust;
    const payoutScale = await this.getPayoutScale();
    
    for (let i = 0; i < gameState.playerHands.length; i++) {
      const hand = gameState.playerHands[i];
      const handValue = this.calculateHandValue(hand);
      const bet = gameState.bet * (gameState.doubledDown[i] ? 2 : 1);
      
      if (handValue.bust) {
        // Loss - already deducted
        continue;
      }
      
      if (dealerBust || handValue.total > dealerValue.total) {
        // Win
        totalPayout += this.getStandardWinPayout(bet, payoutScale);
      } else if (handValue.total === dealerValue.total) {
        // Push - return bet
        totalPayout += bet;
      }
      // Loss - no payout
    }
    
    const result = totalPayout > bet_amount ? 'WIN' : (totalPayout === bet_amount ? 'PUSH' : 'LOSS');
    await this.finalizeGame(client, gameState, totalPayout, result, session_id);
    this.sendGameState(client, gameState);
  }

  private async finalizeGame(
    client: Client, 
    gameState: BlackjackState, 
    payout: number, 
    result: string,
    sessionId: string | null
  ): Promise<void> {
    if (!sessionId) return;
    
    const totalBet = gameState.bet * gameState.playerHands.length 
      + gameState.doubledDown.filter(Boolean).length * gameState.bet;
    const profit = payout - totalBet;
    const multiplier = totalBet > 0 ? payout / totalBet : 0;
    
    await query(
      `UPDATE game_sessions 
       SET result = $1, payout = $2, multiplier = $3, ended_at = NOW()
       WHERE id = $4`,
      [result, payout, multiplier, sessionId]
    );
    
    if (payout > 0) {
      await query(
        'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
        [payout, client.userId]
      );
      
      await query(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, status, game_session_id, description)
         SELECT $1, id, 'WIN', $2, 'COMPLETED', $3, 'Blackjack ${result}'
         FROM wallets WHERE user_id = $1`,
        [client.userId, profit, sessionId]
      );
    }
  }

  private async sendGameState(client: Client, gameState: BlackjackState): Promise<void> {
    const playerValues = gameState.playerHands.map(h => this.calculateHandValue(h));
    const currentHandValue = playerValues[gameState.currentHandIndex];
    const allHandsFinished = gameState.finished || playerValues.every(v => v.bust || v.total === 21);
    
    this.wsServer.sendToClient(client.ws, {
      type: 'game_state',
      data: {
        playerHands: gameState.playerHands,
        playerValues,
        currentHandIndex: gameState.currentHandIndex,
        dealerHand: gameState.finished ? gameState.dealerHand : [gameState.dealerHand[0], null],
        dealerValue: gameState.finished ? this.calculateHandValue(gameState.dealerHand) : null,
        canHit: !gameState.finished && !currentHandValue.bust && currentHandValue.total < 21,
        canStand: !gameState.finished && !allHandsFinished,
        canDouble: !gameState.finished 
          && gameState.playerHands[gameState.currentHandIndex].length === 2
          && !gameState.doubledDown[gameState.currentHandIndex],
        canSplit: !gameState.finished 
          && gameState.playerHands[gameState.currentHandIndex].length === 2
          && gameState.playerHands[gameState.currentHandIndex][0].rank 
            === gameState.playerHands[gameState.currentHandIndex][1].rank
          && gameState.playerHands.length < 4
          && !gameState.doubledDown[gameState.currentHandIndex],
        canSurrender: !gameState.finished
          && gameState.playerHands.length === 1
          && gameState.playerHands[0].length === 2,
        result: gameState.finished ? this.calculateResult(gameState) : null,
        finished: gameState.finished,
      },
    });
  }

  private calculateResult(gameState: BlackjackState): string {
    if (gameState.surrendered) return 'SURRENDER';
    
    const playerValues = gameState.playerHands.map(h => this.calculateHandValue(h));
    const dealerValue = this.calculateHandValue(gameState.dealerHand);
    
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    
    for (const pv of playerValues) {
      if (pv.bust) {
        losses++;
      } else if (dealerValue.bust || pv.total > dealerValue.total) {
        wins++;
      } else if (pv.total === dealerValue.total) {
        pushes++;
      } else {
        losses++;
      }
    }
    
    if (wins > losses) return 'WIN';
    if (losses > wins) return 'LOSS';
    return 'PUSH';
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
