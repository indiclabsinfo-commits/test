export type WebSocketStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface GameState {
  type: string;
  data: any;
  timestamp: number;
}

export interface BetResult {
  success: boolean;
  betId?: string;
  payout?: number;
  multiplier?: number;
  error?: string;
  balance?: number;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private manualDisconnect = false;
  
  private statusListeners: Set<(status: WebSocketStatus) => void> = new Set();
  private gameStateListeners: Map<string, Set<(state: GameState) => void>> = new Map();
  private balanceListeners: Set<(balance: number) => void> = new Set();
  private messageListeners: Set<(msg: any) => void> = new Set();
  
  private subscribedGames: Set<string> = new Set();
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.setStatus('ERROR');
      return;
    }

    this.setStatus('CONNECTING');

    try {
      this.manualDisconnect = false;
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
      const url = new URL(wsUrl);
      url.searchParams.set('token', token);
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (err) {
      console.error('WebSocket creation error:', err);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.clearReconnect();
    this.stopHeartbeat();
    this.subscribedGames.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setStatus('DISCONNECTED');
  }

  private handleOpen(): void {
    this.setStatus('CONNECTED');
    this.reconnectAttempts = 0;

    this.subscribedGames.forEach((gameId) => {
      this.send({ type: 'subscribe', game: gameId });
    });

    this.startHeartbeat();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      // Many game services reply with game-specific message types while still echoing betId.
      // Resolve pending requests opportunistically when a matching betId is present.
      const responseBetId = message?.data?.betId;
      if (typeof responseBetId === 'string') {
        const pending = this.pendingRequests.get(responseBetId);
        if (pending) {
          pending.resolve(message.data);
          this.pendingRequests.delete(responseBetId);
        }
      }

      this.messageListeners.forEach((handler) => {
        try { handler(message); } catch (e) {}
      });

      switch (message.type) {
        case 'game_state':
          this.handleGameState(message);
          break;
        case 'bet_result':
          this.handleBetResult(message);
          break;
        case 'balance_update':
          this.handleBalanceUpdate(message);
          break;
        case 'auth_success':
          console.log('WebSocket auth successful');
          break;
        case 'error':
          console.error('Server error:', message.data);
          break;
      }
    } catch (err) {
      console.error('Message parsing error:', err);
    }
  }

  private handleClose(): void {
    this.stopHeartbeat();
    if (!this.manualDisconnect) {
      this.scheduleReconnect();
    } else {
      this.setStatus('DISCONNECTED');
    }
  }

  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.setStatus('ERROR');
  }

  private handleGameState(message: any): void {
    if (!message.game) return;
    
    const handlers = this.gameStateListeners.get(message.game);
    handlers?.forEach((handler) => {
      try {
        handler({
          type: message.type,
          data: message.data,
          timestamp: message.timestamp || Date.now(),
        });
      } catch (e) {}
    });
  }

  private handleBetResult(message: any): void {
    const pending = this.pendingRequests.get(message.data?.betId);
    if (pending) {
      pending.resolve(message.data);
      this.pendingRequests.delete(message.data.betId);
    }
  }

  private handleBalanceUpdate(message: any): void {
    if (typeof message.data?.balance === 'number') {
      this.balanceListeners.forEach((handler) => {
        try { handler(message.data.balance); } catch (e) {}
      });
    }
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  subscribeToGame(gameId: string): void {
    this.subscribedGames.add(gameId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'subscribe', game: gameId });
    }
  }

  unsubscribeFromGame(gameId: string): void {
    this.subscribedGames.delete(gameId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'unsubscribe', game: gameId });
    }
  }

  async placeBet(gameId: string, amount: number, clientSeed: string, gameData?: any): Promise<BetResult> {
    return new Promise((resolve, reject) => {
      const betId = `${gameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.pendingRequests.set(betId, { resolve, reject });
      
      setTimeout(() => {
        if (this.pendingRequests.has(betId)) {
          this.pendingRequests.delete(betId);
          reject(new Error('Bet timeout'));
        }
      }, 10000);

      this.send({
        type: 'place_bet',
        game: gameId,
        data: { betId, amount, betAmount: amount, clientSeed, ...gameData },
      });
    });
  }

  async cashout(gameId: string, gameData?: any): Promise<BetResult> {
    return new Promise((resolve, reject) => {
      const betId = `cashout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.pendingRequests.set(betId, { resolve, reject });
      
      setTimeout(() => {
        if (this.pendingRequests.has(betId)) {
          this.pendingRequests.delete(betId);
          reject(new Error('Cashout timeout'));
        }
      }, 10000);

      this.send({
        type: 'cashout',
        game: gameId,
        data: { betId, ...gameData },
      });
    });
  }

  async sendGameAction(gameId: string, action: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.pendingRequests.set(requestId, { resolve, reject });
      
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Action timeout'));
        }
      }, 10000);

      this.send({
        type: action,
        game: gameId,
        data: { requestId, ...data },
      });
    });
  }

  onStatusChange(handler: (status: WebSocketStatus) => void) {
    this.statusListeners.add(handler);
    handler(this.status);
    return () => this.statusListeners.delete(handler);
  }

  onGameStateChange(gameId: string, handler: (state: GameState) => void) {
    if (!this.gameStateListeners.has(gameId)) {
      this.gameStateListeners.set(gameId, new Set());
    }
    this.gameStateListeners.get(gameId)!.add(handler);
    return () => this.gameStateListeners.get(gameId)?.delete(handler);
  }

  onBalanceChange(handler: (balance: number) => void) {
    this.balanceListeners.add(handler);
    return () => this.balanceListeners.delete(handler);
  }

  onMessage(handler: (msg: any) => void) {
    this.messageListeners.add(handler);
    return () => this.messageListeners.delete(handler);
  }

  private setStatus(status: WebSocketStatus): void {
    this.status = status;
    this.statusListeners.forEach((handler) => {
      try { handler(status); } catch (e) {}
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.setStatus('RECONNECTING');
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;
