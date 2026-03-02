import { Client, GameMessage } from '../WebSocketGameServer.js';
import { query } from '../../config/database.js';
import { ProvablyFair } from '../../utils/provablyFair.js';

// ─── Types ───────────────────────────────────────────────────────────────

type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';

interface LudoPiece {
  id: number;
  position: number;   // -1 = base, 0-51 = main path
  travelled: number;   // total steps taken (for home stretch entry: need 51+5=56 to finish)
  finished: boolean;
}

interface LudoPlayer {
  id: string;
  clientId: string;    // WebSocket client id
  username: string;
  color: PlayerColor;
  isBot: boolean;
  pieces: LudoPiece[];
  finishedCount: number;
}

interface LudoGame {
  id: string;
  code: string;               // 6-char room code for private games
  players: LudoPlayer[];
  currentPlayerIndex: number;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  lastRoll: number;
  waitingForMove: boolean;     // true = waiting for piece selection, false = waiting for roll
  consecutiveSixes: number;
  winner: string | null;
  finishOrder: string[];       // player ids in finish order
  betAmount: number;           // bet per player (internal units)
  maxPlayers: 2 | 3 | 4;
  isPrivate: boolean;
  createdAt: number;
  creatorId: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  turnTimer: ReturnType<typeof setTimeout> | null;
  movablePieces: number[];     // piece ids that can move after a roll
}

interface QueueEntry {
  clientId: string;
  userId: string;
  username: string;
  joinedAt: number;
}

interface LudoSettlement {
  paidPlayers: string[];
  totalPool: number;
  houseFee: number;
  prizePool: number;
  winnerId: string | null;
  payouts: Record<string, number>;
}

// Colors assigned based on player count and slot
const COLOR_SLOTS_4: PlayerColor[] = ['GREEN', 'YELLOW', 'BLUE', 'RED'];
const COLOR_SLOTS_2: PlayerColor[] = ['GREEN', 'BLUE'];
const COLOR_SLOTS_3: PlayerColor[] = ['GREEN', 'YELLOW', 'RED'];

const START_OFFSETS: Record<PlayerColor, number> = { GREEN: 0, YELLOW: 13, BLUE: 26, RED: 39 };
const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];
const MAIN_PATH_LENGTH = 52; // 0-51
const HOME_ENTRY_TRAVELLED = 51; // After 51 steps (travelled 0-50 on path), piece enters home stretch
const TOTAL_STEPS_TO_FINISH = 57; // 51 steps to home entry + 6 home stretch cells (51-56) = 57 total

const BOT_NAMES = [
  'Aarav', 'Priya', 'Vikram', 'Ananya', 'Rohan',
  'Diya', 'Arjun', 'Kavya', 'Aditya', 'Meera',
  'Ishaan', 'Riya', 'Kartik', 'Sanya', 'Dev',
];

const TURN_TIMEOUT = 30000; // 30 seconds per turn
const QUEUE_CHECK_INTERVAL = 5000;
const QUEUE_BOT_FILL_TIMEOUT = 30000;
const LUDO_HOUSE_EDGE = 0.05;

// ─── Service ─────────────────────────────────────────────────────────────

export class LudoGameService {
  private wsServer: any;
  private games: Map<string, LudoGame> = new Map();
  private playerGameMap: Map<string, string> = new Map();     // userId -> gameId
  private matchQueues: Map<string, QueueEntry[]> = new Map(); // "betAmount_maxPlayers" -> entries
  private codeToGameId: Map<string, string> = new Map();      // room code -> gameId
  private queueInterval: ReturnType<typeof setInterval>;

  constructor(wsServer: any) {
    this.wsServer = wsServer;

    // Periodically check matchmaking queues
    this.queueInterval = setInterval(() => this.processQueues(), QUEUE_CHECK_INTERVAL);
  }

  /** Get the active balance for a user (respects demo mode) */
  private async getActiveBalance(userId: string): Promise<{ balance: number; isDemoMode: boolean }> {
    const res = await query(
      'SELECT balance, demo_balance, is_demo_mode FROM users WHERE id = $1',
      [userId]
    );
    if (res.rows.length === 0) return { balance: 0, isDemoMode: true };
    const u = res.rows[0];
    return {
      balance: u.is_demo_mode ? u.demo_balance : u.balance,
      isDemoMode: u.is_demo_mode,
    };
  }

  /** Get the column name to use for balance operations */
  private async getBalanceColumn(userId: string): Promise<string> {
    const res = await query('SELECT is_demo_mode FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) return 'demo_balance';
    return res.rows[0].is_demo_mode ? 'demo_balance' : 'balance';
  }

  // ─── Message Router ──────────────────────────────────────────────────

  public async handleMessage(client: Client, msg: GameMessage): Promise<void> {
    if (!client.userId) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Not authenticated' } });
      return;
    }

    switch (msg.type) {
      case 'find_match':
        await this.handleFindMatch(client, msg.data);
        break;
      case 'cancel_match':
        this.handleCancelMatch(client);
        break;
      case 'create_private':
        await this.handleCreatePrivate(client, msg.data);
        break;
      case 'join_private':
        await this.handleJoinPrivate(client, msg.data);
        break;
      case 'start_game':
        await this.handleStartGame(client);
        break;
      case 'roll_dice':
        await this.handleRollDice(client);
        break;
      case 'move':
        await this.handleMove(client, msg.data);
        break;
      case 'leave_game':
        await this.handleLeaveGame(client);
        break;
      default:
        console.log('Unknown Ludo message type:', msg.type);
    }
  }

  // ─── Matchmaking ─────────────────────────────────────────────────────

  private async handleFindMatch(client: Client, data: any): Promise<void> {
    const { betAmount = 10000, maxPlayers = 4 } = data;
    const clampedPlayers = Math.min(4, Math.max(2, maxPlayers)) as 2 | 3 | 4;
    const internalBet = Math.max(0, Math.floor(betAmount));

    // Check not already in game/queue
    if (this.playerGameMap.has(client.userId!)) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Already in a game' } });
      return;
    }
    if (this.isInQueue(client.userId!)) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Already in queue' } });
      return;
    }

    // Check balance (respects demo mode)
    if (internalBet > 0) {
      const { balance: activeBalance } = await this.getActiveBalance(client.userId!);
      if (activeBalance < internalBet) {
        this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Insufficient balance' } });
        return;
      }
    }

    const queueKey = `${internalBet}_${clampedPlayers}`;
    if (!this.matchQueues.has(queueKey)) {
      this.matchQueues.set(queueKey, []);
    }

    this.matchQueues.get(queueKey)!.push({
      clientId: client.id,
      userId: client.userId!,
      username: client.username || 'Player',
      joinedAt: Date.now(),
    });

    this.sendToClient(client, {
      type: 'queue_joined',
      game: 'ludo',
      data: { betAmount: internalBet, maxPlayers: clampedPlayers },
    });

    // Try to match immediately
    this.tryMatchQueue(queueKey, internalBet, clampedPlayers);
  }

  private handleCancelMatch(client: Client): void {
    for (const [key, entries] of this.matchQueues) {
      const idx = entries.findIndex(e => e.userId === client.userId);
      if (idx >= 0) {
        entries.splice(idx, 1);
        if (entries.length === 0) this.matchQueues.delete(key);
        this.sendToClient(client, { type: 'queue_left', game: 'ludo', data: {} });
        return;
      }
    }
  }

  private isInQueue(userId: string): boolean {
    for (const entries of this.matchQueues.values()) {
      if (entries.some(e => e.userId === userId)) return true;
    }
    return false;
  }

  private processQueues(): void {
    for (const [key, entries] of this.matchQueues) {
      if (entries.length === 0) continue;
      const [betStr, playersStr] = key.split('_');
      const betAmount = parseInt(betStr);
      const maxPlayers = parseInt(playersStr) as 2 | 3 | 4;

      // Check if oldest entry has waited long enough to fill with bots
      const oldest = entries[0];
      if (entries.length >= 2 && Date.now() - oldest.joinedAt > QUEUE_BOT_FILL_TIMEOUT) {
        this.createMatchedGame(entries.splice(0, Math.min(entries.length, maxPlayers)), betAmount, maxPlayers);
        if (entries.length === 0) this.matchQueues.delete(key);
      }
    }
  }

  private tryMatchQueue(queueKey: string, betAmount: number, maxPlayers: 2 | 3 | 4): void {
    const entries = this.matchQueues.get(queueKey);
    if (!entries || entries.length < maxPlayers) return;

    // We have enough players
    const matched = entries.splice(0, maxPlayers);
    if (entries.length === 0) this.matchQueues.delete(queueKey);

    this.createMatchedGame(matched, betAmount, maxPlayers);
  }

  private async createMatchedGame(entries: QueueEntry[], betAmount: number, maxPlayers: 2 | 3 | 4): Promise<void> {
    const game = this.createGameInstance(betAmount, maxPlayers, false, entries[0].userId);
    const colorSlots = this.getColorSlots(maxPlayers);

    // Add human players
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const player = this.createPlayer(entry.userId, entry.clientId, entry.username, colorSlots[i], false);
      game.players.push(player);
      this.playerGameMap.set(entry.userId, game.id);

      // Subscribe to room
      const wsClient = this.wsServer.getClient(entry.clientId);
      if (wsClient) {
        this.wsServer.subscribeToRoom(wsClient.ws, game.id);
      }
    }

    // Fill remaining slots with bots
    const usedNames = new Set(entries.map(e => e.username));
    for (let i = entries.length; i < maxPlayers; i++) {
      const bot = this.createBot(colorSlots[i], usedNames);
      game.players.push(bot);
      usedNames.add(bot.username);
    }

    this.games.set(game.id, game);

    // Deduct bets before game starts
    const deducted = await this.deductBets(game);
    if (!deducted) {
      for (const entry of entries) {
        const wsClient = this.wsServer.getClient(entry.clientId);
        if (wsClient) {
          this.sendToClient(wsClient, {
            type: 'error',
            game: 'ludo',
            data: { message: 'Unable to lock entry fee. Please try again.' },
          });
        }
      }
      this.cleanupGame(game);
      return;
    }

    // Notify all players
    for (const entry of entries) {
      const wsClient = this.wsServer.getClient(entry.clientId);
      if (wsClient) {
        this.sendToClient(wsClient, {
          type: 'match_found',
          game: 'ludo',
          data: { gameId: game.id },
        });
      }
    }

    // Auto-start matched games
    await this.startGame(game);
  }

  // ─── Private Rooms ───────────────────────────────────────────────────

  private async handleCreatePrivate(client: Client, data: any): Promise<void> {
    const { betAmount = 10000, maxPlayers = 4 } = data;
    const clampedPlayers = Math.min(4, Math.max(2, maxPlayers)) as 2 | 3 | 4;
    const internalBet = Math.max(0, Math.floor(betAmount));

    if (this.playerGameMap.has(client.userId!)) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Already in a game' } });
      return;
    }

    // Check balance (respects demo mode)
    if (internalBet > 0) {
      const { balance: activeBalance } = await this.getActiveBalance(client.userId!);
      if (activeBalance < internalBet) {
        this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Insufficient balance' } });
        return;
      }
    }

    const game = this.createGameInstance(internalBet, clampedPlayers, true, client.userId!);
    const colorSlots = this.getColorSlots(clampedPlayers);

    const player = this.createPlayer(client.userId!, client.id, client.username || 'Player', colorSlots[0], false);
    game.players.push(player);

    this.games.set(game.id, game);
    this.codeToGameId.set(game.code, game.id);
    this.playerGameMap.set(client.userId!, game.id);
    this.wsServer.subscribeToRoom(client.ws, game.id);

    this.broadcastGameState(game);
  }

  private async handleJoinPrivate(client: Client, data: any): Promise<void> {
    const { code } = data;
    if (!code) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Room code required' } });
      return;
    }

    if (this.playerGameMap.has(client.userId!)) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Already in a game' } });
      return;
    }

    const gameId = this.codeToGameId.get(code.toUpperCase());
    if (!gameId) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Room not found' } });
      return;
    }

    const game = this.games.get(gameId);
    if (!game) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Room not found' } });
      return;
    }

    if (game.status !== 'WAITING') {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Game already started' } });
      return;
    }

    if (game.players.length >= game.maxPlayers) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Room is full' } });
      return;
    }

    // Check balance (respects demo mode)
    if (game.betAmount > 0) {
      const { balance: activeBalance } = await this.getActiveBalance(client.userId!);
      if (activeBalance < game.betAmount) {
        this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Insufficient balance' } });
        return;
      }
    }

    const colorSlots = this.getColorSlots(game.maxPlayers);
    const takenColors = new Set(game.players.map(p => p.color));
    const availableColor = colorSlots.find(c => !takenColors.has(c));
    if (!availableColor) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'No slots available' } });
      return;
    }

    const player = this.createPlayer(client.userId!, client.id, client.username || 'Player', availableColor, false);
    game.players.push(player);
    this.playerGameMap.set(client.userId!, game.id);
    this.wsServer.subscribeToRoom(client.ws, game.id);

    this.broadcastGameState(game);

    // Auto-start if full
    if (game.players.length === game.maxPlayers) {
      const deducted = await this.deductBets(game);
      if (!deducted) {
        this.broadcastToRoom(game.id, {
          type: 'error',
          game: 'ludo',
          data: { message: 'Unable to lock entry fee for all players.' },
        });
        this.cleanupGame(game);
        return;
      }
      await this.startGame(game);
    }
  }

  // ─── Start Game ──────────────────────────────────────────────────────

  private async handleStartGame(client: Client): Promise<void> {
    const gameId = this.playerGameMap.get(client.userId!);
    if (!gameId) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Not in a game' } });
      return;
    }

    const game = this.games.get(gameId);
    if (!game || game.status !== 'WAITING') return;

    if (game.creatorId !== client.userId) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Only the room creator can start' } });
      return;
    }

    if (game.players.length < 2) {
      // Fill with bots up to maxPlayers
      const colorSlots = this.getColorSlots(game.maxPlayers);
      const usedNames = new Set(game.players.map(p => p.username));
      const takenColors = new Set(game.players.map(p => p.color));

      for (const color of colorSlots) {
        if (game.players.length >= game.maxPlayers) break;
        if (takenColors.has(color)) continue;
        const bot = this.createBot(color, usedNames);
        game.players.push(bot);
        usedNames.add(bot.username);
      }
    }

    const deducted = await this.deductBets(game);
    if (!deducted) {
      this.broadcastToRoom(game.id, {
        type: 'error',
        game: 'ludo',
        data: { message: 'Unable to lock entry fee for all players.' },
      });
      this.cleanupGame(game);
      return;
    }
    await this.startGame(game);
  }

  private async startGame(game: LudoGame): Promise<void> {
    game.status = 'PLAYING';
    game.currentPlayerIndex = 0;
    game.consecutiveSixes = 0;

    // Generate provably fair seeds
    const seeds = ProvablyFair.generateSeedPair();
    game.serverSeed = seeds.serverSeed;
    game.clientSeed = seeds.clientSeed;
    game.nonce = 0;

    this.broadcastGameState(game);
    this.scheduleTurn(game);
  }

  // ─── Rolling Dice ────────────────────────────────────────────────────

  private async handleRollDice(client: Client): Promise<void> {
    const gameId = this.playerGameMap.get(client.userId!);
    if (!gameId) return;

    const game = this.games.get(gameId);
    if (!game || game.status !== 'PLAYING') return;

    const player = game.players[game.currentPlayerIndex];
    if (player.id !== client.userId || player.isBot) return;

    // Must be waiting for roll (not waiting for move)
    if (game.waitingForMove) return;

    this.executeDiceRoll(game);
  }

  private executeDiceRoll(game: LudoGame): void {
    // Clear turn timer
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    // Provably fair roll
    game.nonce++;
    const roll = ProvablyFair.generateNumber(game.serverSeed, game.clientSeed, game.nonce, 1, 6);
    game.lastRoll = roll;

    const player = game.players[game.currentPlayerIndex];

    // Check consecutive sixes (3 sixes = skip turn)
    if (roll === 6) {
      game.consecutiveSixes++;
      if (game.consecutiveSixes >= 3) {
        // Three sixes - skip turn
        game.consecutiveSixes = 0;
        this.broadcastToRoom(game.id, {
          type: 'dice_result',
          game: 'ludo',
          data: {
            roll,
            playerId: player.id,
            playerColor: player.color,
            canMove: false,
            movablePieces: [],
            skipped: true,
            reason: 'three_sixes',
          },
        });
        this.broadcastGameState(game);
        setTimeout(() => this.nextTurn(game, false), 2000);
        return;
      }
    } else {
      game.consecutiveSixes = 0;
    }

    // Find movable pieces
    const movable = this.getMovablePieces(player, roll);
    game.movablePieces = movable;

    this.broadcastToRoom(game.id, {
      type: 'dice_result',
      game: 'ludo',
      data: {
        roll,
        playerId: player.id,
        playerColor: player.color,
        canMove: movable.length > 0,
        movablePieces: movable,
        skipped: false,
      },
    });

    if (movable.length === 0) {
      // No valid moves
      game.waitingForMove = false;
      this.broadcastGameState(game);
      setTimeout(() => this.nextTurn(game, roll === 6), 1500);
    } else if (movable.length === 1) {
      // Auto-move single piece
      game.waitingForMove = false;
      setTimeout(() => {
        this.executeMove(game, player, movable[0], roll);
      }, 800);
    } else {
      // Wait for player to choose
      game.waitingForMove = true;
      this.broadcastGameState(game);

      // Set move timeout
      game.turnTimer = setTimeout(() => {
        if (game.waitingForMove && game.status === 'PLAYING') {
          // Auto-select best move
          const bestPiece = this.pickBestMove(game, player, movable, roll);
          this.executeMove(game, player, bestPiece, roll);
        }
      }, TURN_TIMEOUT);
    }
  }

  // ─── Moving Pieces ───────────────────────────────────────────────────

  private async handleMove(client: Client, data: any): Promise<void> {
    const { pieceId } = data;
    const gameId = this.playerGameMap.get(client.userId!);
    if (!gameId) return;

    const game = this.games.get(gameId);
    if (!game || game.status !== 'PLAYING' || !game.waitingForMove) return;

    const player = game.players[game.currentPlayerIndex];
    if (player.id !== client.userId || player.isBot) return;

    if (!game.movablePieces.includes(pieceId)) {
      this.sendToClient(client, { type: 'error', game: 'ludo', data: { message: 'Cannot move that piece' } });
      return;
    }

    // Clear move timer
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    game.waitingForMove = false;
    this.executeMove(game, player, pieceId, game.lastRoll);
  }

  private executeMove(game: LudoGame, player: LudoPlayer, pieceId: number, roll: number): void {
    const piece = player.pieces.find(p => p.id === pieceId);
    if (!piece) return;

    const startOffset = START_OFFSETS[player.color];
    let captured = false;

    if (piece.position === -1 && roll === 6) {
      // Deploy from base to start position
      piece.position = startOffset;
      piece.travelled = 0;

      // Check for capture at start position
      captured = this.checkCapture(game, player, piece);
    } else if (piece.position >= 0) {
      const newTravelled = piece.travelled + roll;

      if (newTravelled > 56) {
        // Can't overshoot home
        return;
      }

      if (newTravelled >= HOME_ENTRY_TRAVELLED) {
        // Entering or moving within home stretch (travelled >= 51)
        // Position becomes -2 to indicate "in home path"
        // Use travelled to track exact position
        piece.position = -2; // special: in home path
        piece.travelled = newTravelled;

        if (newTravelled === 56) {
          // Reached home center!
          piece.finished = true;
          piece.position = -3; // finished
          player.finishedCount++;

          this.broadcastToRoom(game.id, {
            type: 'piece_home',
            game: 'ludo',
            data: {
              playerId: player.id,
              playerColor: player.color,
              pieceId,
              finishedCount: player.finishedCount,
            },
          });

          // Check win
          if (player.finishedCount === 4) {
            game.finishOrder.push(player.id);
            this.checkGameEnd(game);
            return;
          }
        }
      } else {
        // Normal move on main path
        const newAbsPos = (startOffset + newTravelled) % MAIN_PATH_LENGTH;
        piece.position = newAbsPos;
        piece.travelled = newTravelled;

        // Check for capture
        if (!SAFE_SPOTS.includes(newAbsPos)) {
          captured = this.checkCapture(game, player, piece);
        }
      }
    }

    // Broadcast move
    this.broadcastToRoom(game.id, {
      type: 'piece_moved',
      game: 'ludo',
      data: {
        playerId: player.id,
        playerColor: player.color,
        pieceId,
        newPosition: piece.position,
        travelled: piece.travelled,
        roll,
        captured,
      },
    });

    this.broadcastGameState(game);

    // Next turn: bonus turn on 6 or capture
    const bonusTurn = roll === 6 || captured;
    setTimeout(() => this.nextTurn(game, bonusTurn), 1000);
  }

  private checkCapture(game: LudoGame, movingPlayer: LudoPlayer, movingPiece: LudoPiece): boolean {
    if (movingPiece.position < 0) return false; // In base/home path - no capture
    if (SAFE_SPOTS.includes(movingPiece.position)) return false;

    let captured = false;
    for (const other of game.players) {
      if (other.id === movingPlayer.id) continue;

      for (const otherPiece of other.pieces) {
        if (otherPiece.position === movingPiece.position && otherPiece.position >= 0) {
          // Capture! Send back to base
          otherPiece.position = -1;
          otherPiece.travelled = 0;
          captured = true;

          this.broadcastToRoom(game.id, {
            type: 'piece_captured',
            game: 'ludo',
            data: {
              capturedBy: movingPlayer.color,
              capturedPlayer: other.color,
              capturedPieceId: otherPiece.id,
              position: movingPiece.position,
            },
          });
        }
      }
    }
    return captured;
  }

  private getMovablePieces(player: LudoPlayer, roll: number): number[] {
    const movable: number[] = [];

    for (const piece of player.pieces) {
      if (piece.finished) continue;

      if (piece.position === -1) {
        // In base: can only deploy on 6
        if (roll === 6) movable.push(piece.id);
      } else if (piece.position === -2) {
        // In home stretch: check if can advance without overshooting
        if (piece.travelled + roll <= 56) {
          movable.push(piece.id);
        }
      } else {
        // On main path: check if can move (may enter home stretch or stay on path)
        const newTravelled = piece.travelled + roll;
        if (newTravelled <= 56) {
          movable.push(piece.id);
        }
      }
    }

    return movable;
  }

  // ─── Turn Management ─────────────────────────────────────────────────

  private scheduleTurn(game: LudoGame): void {
    if (game.status !== 'PLAYING') return;

    const player = game.players[game.currentPlayerIndex];

    // Skip finished players
    if (player.finishedCount === 4) {
      if (!game.finishOrder.includes(player.id)) {
        game.finishOrder.push(player.id);
      }
      this.nextTurn(game, false);
      return;
    }

    game.waitingForMove = false;
    game.movablePieces = [];

    this.broadcastToRoom(game.id, {
      type: 'turn_start',
      game: 'ludo',
      data: {
        playerId: player.id,
        playerColor: player.color,
        playerIndex: game.currentPlayerIndex,
        isBot: player.isBot,
      },
    });

    this.broadcastGameState(game);

    if (player.isBot) {
      // Bot rolls after a delay
      const delay = 1000 + Math.random() * 2000;
      setTimeout(() => {
        if (game.status === 'PLAYING' && game.players[game.currentPlayerIndex]?.id === player.id) {
          this.executeDiceRoll(game);
        }
      }, delay);
    } else {
      // Human: wait for roll_dice message, with timeout
      game.turnTimer = setTimeout(() => {
        if (game.status === 'PLAYING' && !game.waitingForMove && game.players[game.currentPlayerIndex]?.id === player.id) {
          // Auto-roll for AFK player
          this.executeDiceRoll(game);
        }
      }, TURN_TIMEOUT);
    }
  }

  private nextTurn(game: LudoGame, bonusTurn: boolean): void {
    if (game.status !== 'PLAYING') return;

    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    if (!bonusTurn) {
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      game.consecutiveSixes = 0;
    }

    game.lastRoll = 0;
    game.waitingForMove = false;
    game.movablePieces = [];

    this.scheduleTurn(game);
  }

  // ─── Bot AI ──────────────────────────────────────────────────────────

  private pickBestMove(game: LudoGame, player: LudoPlayer, movable: number[], roll: number): number {
    // Priority: capture > deploy on 6 > advance furthest piece > advance any
    const startOffset = START_OFFSETS[player.color];

    let bestPiece = movable[0];
    let bestScore = -Infinity;

    for (const pieceId of movable) {
      const piece = player.pieces.find(p => p.id === pieceId)!;
      let score = 0;

      if (piece.position === -1 && roll === 6) {
        // Deploying from base
        score = 50;
        // Check if we'd capture at start
        const startPos = startOffset;
        if (this.wouldCapture(game, player, startPos)) score += 100;
      } else if (piece.position >= 0 || piece.position === -2) {
        const newTravelled = piece.travelled + roll;

        if (newTravelled === 56) {
          // Finishing a piece is highest priority
          score = 200;
        } else if (newTravelled >= HOME_ENTRY_TRAVELLED) {
          // Moving into home stretch is good
          score = 150 + newTravelled;
        } else {
          const newAbsPos = (startOffset + newTravelled) % MAIN_PATH_LENGTH;
          // Check capture
          if (this.wouldCapture(game, player, newAbsPos)) {
            score = 100;
          }
          // Prefer advancing pieces closer to home
          score += newTravelled;
          // Bonus for landing on safe spot
          if (SAFE_SPOTS.includes(newAbsPos)) score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPiece = pieceId;
      }
    }

    return bestPiece;
  }

  private wouldCapture(game: LudoGame, movingPlayer: LudoPlayer, position: number): boolean {
    if (SAFE_SPOTS.includes(position)) return false;

    for (const other of game.players) {
      if (other.id === movingPlayer.id) continue;
      for (const piece of other.pieces) {
        if (piece.position === position && piece.position >= 0) return true;
      }
    }
    return false;
  }

  // ─── Game End ────────────────────────────────────────────────────────

  private async checkGameEnd(game: LudoGame): Promise<void> {
    // Count players who haven't finished all 4 pieces
    const unfinished = game.players.filter(p => p.finishedCount < 4);

    if (unfinished.length <= 1) {
      // Add remaining unfinished to finish order
      for (const p of unfinished) {
        if (!game.finishOrder.includes(p.id)) {
          game.finishOrder.push(p.id);
        }
      }

      game.status = 'FINISHED';
      game.winner = game.finishOrder[0];

      if (game.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
      }

      await this.settleBets(game);
      const settlement = this.calculateSettlement(game);

      this.broadcastToRoom(game.id, {
        type: 'game_finished',
        game: 'ludo',
        data: {
          winner: game.winner,
          payoutWinner: settlement.winnerId,
          finishOrder: game.finishOrder.map(id => {
            const p = game.players.find(pp => pp.id === id);
            return { id: p?.isBot ? null : id, username: p?.username, color: p?.color, isBot: p?.isBot };
          }),
          payouts: settlement.payouts,
          totalPool: settlement.totalPool,
          houseFee: settlement.houseFee,
          prizePool: settlement.prizePool,
          paidPlayers: settlement.paidPlayers.length,
        },
      });

      this.broadcastGameState(game);

      // Cleanup after delay
      setTimeout(() => this.cleanupGame(game), 30000);
    }
  }

  private calculateSettlement(game: LudoGame): LudoSettlement {
    const paidPlayers = game.players.filter(p => !p.isBot).map(p => p.id);
    const totalPool = game.betAmount * paidPlayers.length;
    const houseFee = Math.floor(totalPool * LUDO_HOUSE_EDGE);
    const prizePool = totalPool - houseFee;
    const payouts: Record<string, number> = {};

    if (game.finishOrder.length === 0 || totalPool <= 0) {
      return { paidPlayers, totalPool, houseFee, prizePool, winnerId: null, payouts };
    }

    // Award prize to the best-ranked human who actually paid entry.
    const winnerId = game.finishOrder.find(id => paidPlayers.includes(id)) || null;
    if (!winnerId) {
      return { paidPlayers, totalPool, houseFee, prizePool, winnerId: null, payouts };
    }

    payouts[winnerId] = prizePool;
    return { paidPlayers, totalPool, houseFee, prizePool, winnerId, payouts };
  }

  private async settleBets(game: LudoGame): Promise<void> {
    const settlement = this.calculateSettlement(game);
    const payouts = settlement.payouts;

    for (const [playerId, payout] of Object.entries(payouts)) {
      const player = game.players.find(p => p.id === playerId);
      if (!player || player.isBot) continue;

      try {
        const col = await this.getBalanceColumn(playerId);
        await query(`UPDATE users SET ${col} = ${col} + $1 WHERE id = $2`, [payout, playerId]);

        // Record game session
        await query(
          `INSERT INTO game_sessions (user_id, game_type, bet_amount, multiplier, payout, profit, result, game_data)
           VALUES ($1, 'ludo', $2, $3, $4, $5, 'win', $6)`,
          [
            playerId,
            game.betAmount,
            (payout / game.betAmount).toFixed(2),
            payout,
            payout - game.betAmount,
            JSON.stringify({
              gameId: game.id,
              players: game.players.map(p => ({ color: p.color, username: p.username, isBot: p.isBot })),
              finishOrder: game.finishOrder,
              totalPool: settlement.totalPool,
              houseFee: settlement.houseFee,
              prizePool: settlement.prizePool,
            }),
          ]
        );

        // Send balance update with the active balance
        const balRes = await query(`SELECT ${col} as active_balance FROM users WHERE id = $1`, [playerId]);
        if (balRes.rows.length > 0) {
          const wsClient = this.findClientByUserId(playerId);
          if (wsClient) {
            this.sendToClient(wsClient, {
              type: 'balance_update',
              data: { balance: balRes.rows[0].active_balance },
            });
          }
        }
      } catch (err) {
        console.error('Ludo settle error:', err);
      }
    }

    // Record losses for other human players
    for (const player of game.players) {
      if (player.isBot || payouts[player.id]) continue;
      try {
        await query(
          `INSERT INTO game_sessions (user_id, game_type, bet_amount, multiplier, payout, profit, result, game_data)
           VALUES ($1, 'ludo', $2, 0, 0, $3, 'loss', $4)`,
          [
            player.id,
            game.betAmount,
            -game.betAmount,
            JSON.stringify({
              gameId: game.id,
              totalPool: settlement.totalPool,
              houseFee: settlement.houseFee,
              prizePool: settlement.prizePool,
            }),
          ]
        );
      } catch (err) {
        console.error('Ludo loss record error:', err);
      }
    }
  }

  private async deductBets(game: LudoGame): Promise<boolean> {
    if (game.betAmount <= 0) return true;

    const humans = game.players.filter(p => !p.isBot);
    if (humans.length === 0) return true;

    try {
      await query('BEGIN');

      for (const player of humans) {
        const col = await this.getBalanceColumn(player.id);
        const res = await query(
          `UPDATE users SET ${col} = ${col} - $1 WHERE id = $2 AND ${col} >= $1 RETURNING id`,
          [game.betAmount, player.id]
        );
        if (res.rows.length === 0) {
          await query('ROLLBACK');
          return false;
        }
      }

      await query('COMMIT');

      for (const player of humans) {
        const col = await this.getBalanceColumn(player.id);
        const balRes = await query(`SELECT ${col} as active_balance FROM users WHERE id = $1`, [player.id]);
        if (balRes.rows.length > 0) {
          const wsClient = this.findClientByUserId(player.id);
          if (wsClient) {
            this.sendToClient(wsClient, {
              type: 'balance_update',
              data: { balance: balRes.rows[0].active_balance },
            });
          }
        }
      }

      return true;
    } catch (err) {
      try {
        await query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      console.error('Ludo deduct bet error:', err);
      return false;
    }
  }

  // ─── Leave / Disconnect ──────────────────────────────────────────────

  private async handleLeaveGame(client: Client): Promise<void> {
    // Remove from queue first
    this.handleCancelMatch(client);

    const gameId = this.playerGameMap.get(client.userId!);
    if (!gameId) return;

    const game = this.games.get(gameId);
    if (!game) return;

    this.removePlayerFromGame(game, client.userId!, client.id);
  }

  public handleDisconnect(client: Client): void {
    // Remove from queues
    for (const [key, entries] of this.matchQueues) {
      const idx = entries.findIndex(e => e.userId === client.userId || e.clientId === client.id);
      if (idx >= 0) {
        entries.splice(idx, 1);
        if (entries.length === 0) this.matchQueues.delete(key);
      }
    }

    const gameId = this.playerGameMap.get(client.userId!);
    if (!gameId) return;

    const game = this.games.get(gameId);
    if (!game) return;

    this.removePlayerFromGame(game, client.userId!, client.id);
  }

  private removePlayerFromGame(game: LudoGame, userId: string, clientId: string): void {
    const playerIdx = game.players.findIndex(p => p.id === userId);
    if (playerIdx < 0) return;

    if (game.status === 'WAITING') {
      // Remove from waiting room
      game.players.splice(playerIdx, 1);
      this.playerGameMap.delete(userId);

      const wsClient = this.wsServer.getClient(clientId);
      if (wsClient) {
        this.wsServer.unsubscribeFromRoom(wsClient.ws, game.id);
      }

      if (game.players.filter(p => !p.isBot).length === 0) {
        // No human players left
        this.cleanupGame(game);
      } else {
        this.broadcastGameState(game);
      }
    } else if (game.status === 'PLAYING') {
      // Replace with bot mid-game
      const player = game.players[playerIdx];
      const usedNames = new Set(game.players.map(p => p.username));
      const botName = BOT_NAMES.find(n => !usedNames.has(n)) || `Bot_${Math.floor(Math.random() * 999)}`;

      player.isBot = true;
      player.id = `bot_${Date.now()}_${playerIdx}`;
      player.username = botName;
      player.clientId = '';

      this.playerGameMap.delete(userId);

      const wsClient = this.wsServer.getClient(clientId);
      if (wsClient) {
        this.wsServer.unsubscribeFromRoom(wsClient.ws, game.id);
      }

      this.broadcastGameState(game);

      // If it was this player's turn, trigger bot play
      if (game.currentPlayerIndex === playerIdx) {
        if (game.turnTimer) {
          clearTimeout(game.turnTimer);
          game.turnTimer = null;
        }

        if (game.waitingForMove && game.movablePieces.length > 0) {
          const bestPiece = this.pickBestMove(game, player, game.movablePieces, game.lastRoll);
          game.waitingForMove = false;
          this.executeMove(game, player, bestPiece, game.lastRoll);
        } else {
          setTimeout(() => this.executeDiceRoll(game), 1500);
        }
      }

      // Check if all players are bots now
      if (game.players.every(p => p.isBot)) {
        // End game early, no real winner
        game.status = 'FINISHED';
        if (game.turnTimer) {
          clearTimeout(game.turnTimer);
          game.turnTimer = null;
        }
        this.cleanupGame(game);
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private createGameInstance(betAmount: number, maxPlayers: 2 | 3 | 4, isPrivate: boolean, creatorId: string): LudoGame {
    const id = 'ludo_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const code = this.generateRoomCode();

    return {
      id,
      code,
      players: [],
      currentPlayerIndex: 0,
      status: 'WAITING',
      lastRoll: 0,
      waitingForMove: false,
      consecutiveSixes: 0,
      winner: null,
      finishOrder: [],
      betAmount,
      maxPlayers,
      isPrivate,
      createdAt: Date.now(),
      creatorId,
      serverSeed: '',
      clientSeed: '',
      nonce: 0,
      turnTimer: null,
      movablePieces: [],
    };
  }

  private createPlayer(userId: string, clientId: string, username: string, color: PlayerColor, isBot: boolean): LudoPlayer {
    return {
      id: userId,
      clientId,
      username,
      color,
      isBot,
      pieces: Array.from({ length: 4 }, (_, i) => ({
        id: i,
        position: -1,
        travelled: 0,
        finished: false,
      })),
      finishedCount: 0,
    };
  }

  private createBot(color: PlayerColor, usedNames: Set<string>): LudoPlayer {
    const name = BOT_NAMES.find(n => !usedNames.has(n)) || `Bot_${Math.floor(Math.random() * 999)}`;
    return this.createPlayer(`bot_${Date.now()}_${color}`, '', name, color, true);
  }

  private getColorSlots(maxPlayers: 2 | 3 | 4): PlayerColor[] {
    switch (maxPlayers) {
      case 2: return COLOR_SLOTS_2;
      case 3: return COLOR_SLOTS_3;
      case 4: return COLOR_SLOTS_4;
    }
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 for clarity
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure uniqueness
    if (this.codeToGameId.has(code)) return this.generateRoomCode();
    return code;
  }

  private cleanupGame(game: LudoGame): void {
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    // Remove all player mappings
    for (const player of game.players) {
      if (!player.isBot) {
        this.playerGameMap.delete(player.id);
      }
    }

    this.codeToGameId.delete(game.code);
    this.games.delete(game.id);
  }

  private findClientByUserId(userId: string): Client | undefined {
    // Iterate wsServer clients to find by userId
    // wsServer.clients is a Map<string, Client>
    if (typeof this.wsServer.getClientCount === 'function') {
      // Use getClient with the client ID from the player
      for (const game of this.games.values()) {
        const player = game.players.find(p => p.id === userId);
        if (player && player.clientId) {
          return this.wsServer.getClient(player.clientId);
        }
      }
    }
    return undefined;
  }

  // ─── Communication ───────────────────────────────────────────────────

  private sendToClient(client: Client, message: any): void {
    if (client.ws && client.ws.readyState === 1) { // WebSocket.OPEN = 1
      try {
        client.ws.send(JSON.stringify(message));
      } catch (err) {
        // ignore
      }
    }
  }

  private broadcastToRoom(roomId: string, message: any): void {
    this.wsServer.broadcastToRoom(roomId, message);
  }

  private broadcastGameState(game: LudoGame): void {
    const currentPlayer = game.players[game.currentPlayerIndex];

    this.broadcastToRoom(game.id, {
      type: 'game_state',
      game: 'ludo',
      data: {
        gameId: game.id,
        code: game.isPrivate ? game.code : null,
        status: game.status,
        players: game.players.map(p => ({
          id: p.isBot ? null : p.id,
          username: p.username,
          color: p.color,
          isBot: p.isBot,
          pieces: p.pieces.map(pc => ({
            id: pc.id,
            position: pc.position,
            travelled: pc.travelled,
            finished: pc.finished,
          })),
          finishedCount: p.finishedCount,
        })),
        currentPlayerIndex: game.currentPlayerIndex,
        currentPlayerColor: currentPlayer?.color,
        lastRoll: game.lastRoll,
        waitingForMove: game.waitingForMove,
        movablePieces: game.movablePieces,
        winner: game.winner,
        finishOrder: game.finishOrder,
        betAmount: game.betAmount,
        maxPlayers: game.maxPlayers,
        isPrivate: game.isPrivate,
      },
    });
  }
}

export default LudoGameService;
export type { LudoGame, LudoPlayer, LudoPiece };
