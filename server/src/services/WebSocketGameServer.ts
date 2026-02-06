import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { JWTService } from '../utils/jwt.js';
import { query } from '../config/database.js';
import { CrashGameService } from './games/CrashGameService.js';
import { MinesGameService } from './games/MinesGameService.js';
import { DiceGameService } from './games/DiceGameService.js';
import { PlinkoGameService } from './games/PlinkoGameService.js';

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
  private crashGame: CrashGameService;
  private minesGame: MinesGameService;
  private diceGame: DiceGameService;
  private plinkoGame: PlinkoGameService;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.clients = new Map();

    // Initialize game services
    this.crashGame = new CrashGameService(this);
    this.minesGame = new MinesGameService(this);
    this.diceGame = new DiceGameService(this);
    this.plinkoGame = new PlinkoGameService(this);

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
      const msg: GameMessage = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) return;

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
    }
  }

  // Public methods for game services

  public sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
      }
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
