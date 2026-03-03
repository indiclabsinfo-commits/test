import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { JWTService } from '../utils/jwt.js';
import { query } from '../config/database.js';
import { CrashGameService } from './games/CrashGameService.js';
import { MinesGameService } from './games/MinesGameService.js';
import { DiceGameService } from './games/DiceGameService.js';
import { PlinkoGameService } from './games/PlinkoGameService.js';
import { LimboGameService } from './games/LimboGameService.js';
import { BlackjackGameService } from './games/BlackjackGameService.js';
import { RouletteGameService } from './games/RouletteGameService.js';
import { WheelGameService } from './games/WheelGameService.js';
import { KenoGameService } from './games/KenoGameService.js';
import { HiLoGameService } from './games/HiLoGameService.js';
import { DragonTowerGameService } from './games/DragonTowerGameService.js';
import { DiamondsGameService } from './games/DiamondsGameService.js';
import { LudoGameService } from './games/LudoGameService.js';

interface Client {
  id: string;
  ws: WebSocket;
  userId: string;
  username: string;
  isAlive: boolean;
  currentGame?: string;
}

interface GameMessage {
  type: string;
  game: string;
  data: any;
}

export class WebSocketGameServer {
  private wss: WebSocketServer;
  private clients: Map<string, Client>;
  private clientSecurity: Map<string, {
    windowStartMs: number;
    msgCount: number;
    recentFingerprints: Map<string, number>;
    recentRequestIds: Map<string, number>;
    lastActionAt: Map<string, number>;
  }>;
  private crashGame: CrashGameService;
  private minesGame: MinesGameService;
  private diceGame: DiceGameService;
  private plinkoGame: PlinkoGameService;
  private limboGame: LimboGameService;
  private blackjackGame: BlackjackGameService;
  private rouletteGame: RouletteGameService;
  private wheelGame: WheelGameService;
  private kenoGame: KenoGameService;
  private hiloGame: HiLoGameService;
  private dragonTowerGame: DragonTowerGameService;
  private diamondsGame: DiamondsGameService;
  private ludoGame: LudoGameService;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.clients = new Map();
    this.clientSecurity = new Map();

    // Initialize game services
    this.crashGame = new CrashGameService(this);
    this.minesGame = new MinesGameService(this);
    this.diceGame = new DiceGameService(this);
    this.plinkoGame = new PlinkoGameService(this);
    this.limboGame = new LimboGameService(this);
    this.blackjackGame = new BlackjackGameService(this);
    this.rouletteGame = new RouletteGameService(this);
    this.wheelGame = new WheelGameService(this);
    this.kenoGame = new KenoGameService(this);
    this.hiloGame = new HiLoGameService(this);
    this.dragonTowerGame = new DragonTowerGameService(this);
    this.diamondsGame = new DiamondsGameService(this);
    this.ludoGame = new LudoGameService(this);

    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat to detect broken connections
    const interval = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          this.removeClient(client.id);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log('✓ WebSocket game server initialized');
  }

  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    const clientId = uuidv4();

    // Extract token from query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      // Verify token
      const payload = JWTService.verifyAccessToken(token);

      // Create client
      const client: Client = {
        id: clientId,
        ws,
        userId: payload.userId,
        username: payload.username,
        isAlive: true,
      };

      this.clients.set(clientId, client);
      this.clientSecurity.set(clientId, {
        windowStartMs: Date.now(),
        msgCount: 0,
        recentFingerprints: new Map(),
        recentRequestIds: new Map(),
        lastActionAt: new Map(),
      });

      // Attempt stateful rejoin for ongoing Ludo sessions.
      this.ludoGame.handleReconnect(client);

      // Setup event handlers
      ws.on('message', (message: string) => {
        this.handleMessage(clientId, message);
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) client.isAlive = true;
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.removeClient(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        data: {
          clientId,
          userId: payload.userId,
          username: payload.username,
        },
      });

      console.log(`Client connected: ${payload.username} (${clientId})`);
    } catch (error) {
      console.error('Authentication failed:', error);
      ws.close(1008, 'Invalid token');
    }
  }

  private async handleMessage(clientId: string, message: string): Promise<void> {
    try {
      if (!this.validateMessageSize(clientId, message)) return;
      const msg: GameMessage = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) return;
      if (!this.validateMessageShape(clientId, msg)) return;
      if (!this.enforceRateLimit(clientId)) return;
      if (!this.enforceReplayProtection(clientId, msg)) return;
      if (!this.enforceActionCooldown(clientId, msg)) return;

      // Handle control messages that are not game actions
      if (msg.type === 'subscribe') {
        if (msg.game) {
          client.currentGame = msg.game;
          this.sendToClient(clientId, {
            type: 'subscribed',
            game: msg.game,
            data: { game: msg.game },
          });
        }
        return;
      }

      if (msg.type === 'unsubscribe') {
        if (!msg.game || client.currentGame === msg.game) {
          client.currentGame = undefined;
        }
        this.sendToClient(clientId, {
          type: 'unsubscribed',
          game: msg.game,
          data: { game: msg.game },
        });
        return;
      }

      if (msg.type === 'ping') {
        this.sendToClient(clientId, { type: 'pong', data: { timestamp: Date.now() } });
        return;
      }

      // Route message to appropriate game service
      switch (msg.game) {
        case 'crash':
          await this.crashGame.handleMessage(client, msg);
          break;
        case 'mines':
          await this.minesGame.handleMessage(client, msg);
          break;
        case 'dice':
          await this.diceGame.handleMessage(client, msg);
          break;
        case 'plinko':
          await this.plinkoGame.handleMessage(client, msg);
          break;
        case 'limbo':
          await this.limboGame.handleMessage(client, msg);
          break;
        case 'blackjack':
          await this.blackjackGame.handleMessage(client, msg);
          break;
        case 'roulette':
          await this.rouletteGame.handleMessage(client, msg);
          break;
        case 'wheel':
          await this.wheelGame.handleMessage(client, msg);
          break;
        case 'keno':
          await this.kenoGame.handleMessage(client, msg);
          break;
        case 'hilo':
          await this.hiloGame.handleMessage(client, msg);
          break;
        case 'dragon_tower':
          await this.dragonTowerGame.handleMessage(client, msg);
          break;
        case 'diamonds':
          await this.diamondsGame.handleMessage(client, msg);
          break;
        case 'ludo':
          await this.ludoGame.handleMessage(client, msg);
          break;
        case 'chat':
          await this.handleChatMessage(client, msg);
          break;
        default:
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: 'Unknown game type' },
          });
      }
    } catch (error) {
      console.error(`Message handling error for client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' },
      });
    }
  }

  private async handleChatMessage(client: Client, msg: GameMessage): Promise<void> {
    if (msg.type === 'send_message') {
      const { message, room } = msg.data;

      // Save to database
      await query(
        `INSERT INTO chat_messages (user_id, room, message)
         VALUES ($1, $2, $3)`,
        [client.userId, room || 'global', message]
      );

      // Broadcast to all clients in the same room
      this.broadcast({
        type: 'chat_message',
        data: {
          username: client.username,
          message,
          room: room || 'global',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`Client disconnected: ${client.username} (${clientId})`);

      // Notify game services
      if (client.currentGame === 'crash') {
        this.crashGame.handleDisconnect(client);
      }

      // Notify Ludo service (handles queue removal + in-game replacement with bot)
      this.ludoGame.handleDisconnect(client);

      this.removeClient(clientId);
    }
  }

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.ws.terminate();
      } catch (error) {
        // Ignore errors during termination
      }
      this.clients.delete(clientId);
      this.clientSecurity.delete(clientId);
    }
  }

  private validateMessageSize(clientId: string, message: string): boolean {
    const MAX_MESSAGE_SIZE = 8 * 1024; // 8KB
    if (message.length <= MAX_MESSAGE_SIZE) return true;
    this.sendToClient(clientId, {
      type: 'error',
      data: { message: 'Message too large' },
    });
    return false;
  }

  private validateMessageShape(clientId: string, msg: any): msg is GameMessage {
    if (!msg || typeof msg !== 'object') {
      this.sendToClient(clientId, { type: 'error', data: { message: 'Invalid message' } });
      return false;
    }
    if (typeof msg.type !== 'string' || msg.type.length === 0 || msg.type.length > 50) {
      this.sendToClient(clientId, { type: 'error', data: { message: 'Invalid message type' } });
      return false;
    }
    if (msg.game !== undefined && (typeof msg.game !== 'string' || msg.game.length > 50)) {
      this.sendToClient(clientId, { type: 'error', data: { message: 'Invalid game field' } });
      return false;
    }
    return true;
  }

  private enforceRateLimit(clientId: string): boolean {
    const state = this.clientSecurity.get(clientId);
    if (!state) return true;

    const WINDOW_MS = 10_000;
    const MAX_MESSAGES_PER_WINDOW = 100;
    const now = Date.now();

    if (now - state.windowStartMs > WINDOW_MS) {
      state.windowStartMs = now;
      state.msgCount = 0;
    }

    state.msgCount += 1;
    if (state.msgCount <= MAX_MESSAGES_PER_WINDOW) return true;

    this.sendToClient(clientId, {
      type: 'error',
      data: { message: 'Rate limit exceeded' },
    });
    return false;
  }

  private enforceReplayProtection(clientId: string, msg: GameMessage): boolean {
    const state = this.clientSecurity.get(clientId);
    if (!state) return true;

    const now = Date.now();
    const FINGERPRINT_TTL_MS = 5_000;
    const REQUEST_ID_TTL_MS = 5 * 60_000;

    // Garbage collect old entries
    for (const [key, ts] of state.recentFingerprints) {
      if (now - ts > FINGERPRINT_TTL_MS) state.recentFingerprints.delete(key);
    }
    for (const [key, ts] of state.recentRequestIds) {
      if (now - ts > REQUEST_ID_TTL_MS) state.recentRequestIds.delete(key);
    }

    const requestId = msg?.data?.requestId || msg?.data?.betId;
    if (typeof requestId === 'string' && requestId.length > 0) {
      if (state.recentRequestIds.has(requestId)) {
        this.sendToClient(clientId, {
          type: 'error',
          data: { message: 'Duplicate request' },
        });
        return false;
      }
      state.recentRequestIds.set(requestId, now);
    }

    const fingerprintSource = JSON.stringify({
      type: msg.type,
      game: msg.game,
      data: msg.data,
    });
    const fingerprint = createHash('sha256').update(fingerprintSource).digest('hex');
    if (state.recentFingerprints.has(fingerprint)) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Replay detected' },
      });
      return false;
    }
    state.recentFingerprints.set(fingerprint, now);
    return true;
  }

  private enforceActionCooldown(clientId: string, msg: GameMessage): boolean {
    const state = this.clientSecurity.get(clientId);
    if (!state) return true;

    const guardedActions = new Set([
      'place_bet',
      'cashout',
      'reveal_tile',
      'guess',
      'spin',
      'roll',
      'drop',
      'move',
    ]);
    if (!guardedActions.has(msg.type)) return true;

    const now = Date.now();
    const key = `${msg.game || 'global'}:${msg.type}`;
    const last = state.lastActionAt.get(key) || 0;
    const MIN_ACTION_INTERVAL_MS = 120;
    if (now - last < MIN_ACTION_INTERVAL_MS) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Too many actions, slow down' },
      });
      return false;
    }

    state.lastActionAt.set(key, now);
    return true;
  }

  // Public methods for game services

  public sendToClient(clientOrId: string | WebSocket, message: any): void {
    if (typeof clientOrId !== 'string') {
      this.sendToClientWs(clientOrId, message);
      return;
    }

    const client = this.clients.get(clientOrId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to client ${clientOrId}:`, error);
    }
  }

  public broadcast(message: any, excludeClientId?: string): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client, id) => {
      if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (error) {
          console.error(`Failed to broadcast to client ${id}:`, error);
        }
      }
    });
  }

  public broadcastToGame(game: string, message: any): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.currentGame === game && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (error) {
          console.error(`Failed to broadcast to game ${game}:`, error);
        }
      }
    });
  }

  public subscribeToRoom(ws: WebSocket, room: string): void {
    // Rooms are tracked via client.currentGame or could extend Client interface
    const client = Array.from(this.clients.values()).find(c => c.ws === ws);
    if (client) {
      client.currentGame = room;
    }
  }

  public unsubscribeFromRoom(ws: WebSocket, room: string): void {
    const client = Array.from(this.clients.values()).find(c => c.ws === ws);
    if (client && client.currentGame === room) {
      client.currentGame = undefined;
    }
  }

  public broadcastToRoom(room: string, message: any): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.currentGame === room && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (error) {
          console.error(`Failed to broadcast to room ${room}:`, error);
        }
      }
    });
  }

  public sendToClientWs(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to client ws:', error);
      }
    }
  }

  public notifyUser(userId: string, message: any): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (error) {
          console.error(`Failed to notify user ${userId}:`, error);
        }
      }
    });
  }

  public getClient(clientId: string): Client | undefined {
    return this.clients.get(clientId);
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public shutdown(): void {
    console.log('Shutting down WebSocket server...');
    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });
    this.clients.clear();
  }
}

export default WebSocketGameServer;
export type { Client, GameMessage };
