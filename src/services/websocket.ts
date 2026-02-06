type MessageHandler = (data: any) => void;

interface GameMessage {
  type: string;
  game?: string;
  data: any;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

      this.ws = new WebSocket(`${wsUrl}?token=${token}`);

      this.ws.onopen = () => {
        console.log('✓ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: GameMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.attemptReconnect(token);
      };
    });
  }

  private attemptReconnect(token: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.connect(token).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts', {});
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }

  send(message: GameMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      throw new Error('WebSocket not connected');
    }
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: MessageHandler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  private handleMessage(message: GameMessage) {
    this.emit(message.type, message.data);

    if (message.game) {
      this.emit(`${message.game}:${message.type}`, message.data);
    }
  }

  // Crash game methods
  placeCrashBet(betAmount: number, autoCashout?: number) {
    this.send({
      type: 'place_bet',
      game: 'crash',
      data: { betAmount, autoCashout },
    });
  }

  crashCashout() {
    this.send({
      type: 'cashout',
      game: 'crash',
      data: {},
    });
  }

  getCrashHistory() {
    this.send({
      type: 'get_history',
      game: 'crash',
      data: {},
    });
  }

  // Mines game methods
  startMinesGame(betAmount: number, mineCount: number) {
    this.send({
      type: 'start_game',
      game: 'mines',
      data: { betAmount, mineCount },
    });
  }

  revealTile(tileIndex: number) {
    this.send({
      type: 'reveal_tile',
      game: 'mines',
      data: { tileIndex },
    });
  }

  minesCashout() {
    this.send({
      type: 'cashout',
      game: 'mines',
      data: {},
    });
  }

  // Dice game methods
  rollDice(betAmount: number, target: number, rollOver: boolean) {
    this.send({
      type: 'roll',
      game: 'dice',
      data: { betAmount, target, rollOver },
    });
  }

  // Plinko game methods
  dropPlinko(betAmount: number, risk: 'low' | 'medium' | 'high') {
    this.send({
      type: 'drop',
      game: 'plinko',
      data: { betAmount, risk },
    });
  }

  // Chat methods
  sendChatMessage(message: string, room: string = 'global') {
    this.send({
      type: 'send_message',
      game: 'chat',
      data: { message, room },
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
export default wsService;
