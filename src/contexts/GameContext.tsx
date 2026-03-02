import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { apiService } from '../services/api';
import { wsService, type GameState } from '../services/websocket';

interface User {
  id: string;
  username: string;
  balance: number;
  demoBalance: number;
  isDemoMode: boolean;
  role: string;
}

interface GameSession {
  id: string;
  gameType: string;
  betAmount: number;
  multiplier: number;
  payout: number;
  result: 'WIN' | 'LOSS' | 'PUSH';
  createdAt: string;
}

interface GameContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  balance: number;
  demoBalance: number;
  isDemoMode: boolean;
  activeBalance: number; // The balance currently in use (demo or real)
  activeGameId: string | null;
  gameState: GameState | null;
  wsStatus: string;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  toggleDemoMode: () => Promise<void>;

  joinGame: (gameId: string) => void;
  leaveGame: () => void;

  placeBet: (amount: number, gameData?: any) => Promise<any> | boolean;
  collectWinnings: (amount: number) => void;
  cashout: (gameData?: any) => Promise<any>;
  sendGameAction: (action: string, data?: any) => Promise<any>;

  gameHistory: GameSession[];
  fetchGameHistory: () => Promise<void>;

  clientSeed: string;
  setClientSeed: (seed: string) => void;
  rotateClientSeed: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const generateClientSeed = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [demoBalance, setDemoBalance] = useState(1000);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [gameHistory, setGameHistory] = useState<GameSession[]>([]);
  const [clientSeed, setClientSeed] = useState(() => {
    const saved = localStorage.getItem('clientSeed');
    return saved || generateClientSeed();
  });

  const activeBalance = isDemoMode ? demoBalance : balance;

  const applyUserData = (userData: any) => {
    const realBal = (userData.balance || 0) / 100000;
    const demoBal = (userData.demoBalance || userData.demo_balance || 100000000) / 100000;
    const demoMode = userData.isDemoMode ?? userData.is_demo_mode ?? true;

    setUser({
      id: userData.id,
      username: userData.username,
      balance: realBal,
      demoBalance: demoBal,
      isDemoMode: demoMode,
      role: userData.role || 'user',
    });
    setBalance(realBal);
    setDemoBalance(demoBal);
    setIsDemoMode(demoMode);
  };

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const userData = await apiService.getMe();
          applyUserData(userData);
          setIsAuthenticated(true);
          wsService.connect();
        } catch {
          localStorage.removeItem('accessToken');
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  // WebSocket listeners
  useEffect(() => {
    const unsubscribeStatus = wsService.onStatusChange(setWsStatus);

    const unsubscribeBalance = wsService.onBalanceChange((newBalance) => {
      // WS sends the real balance in internal units
      const displayBalance = newBalance / 100000;
      if (isDemoMode) {
        setDemoBalance(displayBalance);
      } else {
        setBalance(displayBalance);
      }
      if (user) {
        setUser(prev => prev ? {
          ...prev,
          ...(isDemoMode ? { demoBalance: displayBalance } : { balance: displayBalance }),
        } : prev);
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeBalance();
    };
  }, [user, isDemoMode]);

  // Game state listener
  useEffect(() => {
    if (!activeGameId) {
      setGameState(null);
      return;
    }

    wsService.subscribeToGame(activeGameId);
    const unsubscribe = wsService.onGameStateChange(activeGameId, setGameState);

    return () => {
      unsubscribe();
      wsService.unsubscribeFromGame(activeGameId);
    };
  }, [activeGameId]);

  // Save client seed
  useEffect(() => {
    localStorage.setItem('clientSeed', clientSeed);
  }, [clientSeed]);

  const rotateClientSeed = useCallback(() => {
    setClientSeed(generateClientSeed());
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await apiService.login({ username, password });

      if (response.user) {
        applyUserData(response.user);
        setIsAuthenticated(true);
        wsService.connect();
        fetchGameHistory();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await apiService.register({ username, password });

      if (response.user) {
        applyUserData(response.user);
        setIsAuthenticated(true);
        wsService.connect();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setBalance(0);
    setDemoBalance(1000);
    setIsDemoMode(true);
    wsService.disconnect();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const toggleDemoMode = async () => {
    if (!isAuthenticated) return;
    try {
      const result = await apiService.toggleDemoMode();
      setIsDemoMode(result.isDemoMode);
      setBalance(result.balance / 100000);
      setDemoBalance(result.demoBalance / 100000);
      if (user) {
        setUser({
          ...user,
          isDemoMode: result.isDemoMode,
          balance: result.balance / 100000,
          demoBalance: result.demoBalance / 100000,
        });
      }
    } catch (err) {
      console.error('Toggle demo mode error:', err);
    }
  };

  const joinGame = useCallback((gameId: string) => {
    setActiveGameId(gameId);
  }, []);

  const leaveGame = useCallback(() => {
    if (activeGameId) {
      wsService.unsubscribeFromGame(activeGameId);
    }
    setActiveGameId(null);
    setGameState(null);
  }, [activeGameId]);

  const placeBet = (amount: number, gameData?: any) => {
    if (amount <= 0) return false;

    // Strict path: authenticated active game bets are backend-confirmed only.
    if (activeGameId && isAuthenticated) {
      return (async () => {
        if (activeBalance < amount) {
          return { success: false, error: 'Insufficient balance' };
        }

        if (wsStatus !== 'CONNECTED') {
          return { success: false, error: 'WebSocket not connected' };
        }

        try {
          const internalAmount = Math.floor(amount * 100000);
          const result = await wsService.placeBet(activeGameId, internalAmount, clientSeed, gameData);

          if (typeof result?.balance === 'number') {
            const displayBalance = result.balance / 100000;
            if (isDemoMode) {
              setDemoBalance(displayBalance);
            } else {
              setBalance(displayBalance);
            }
          }

          return result ?? { success: false, error: 'No response from game server' };
        } catch (err) {
          console.error('Place bet error:', err);
          return { success: false, error: 'Bet failed' };
        }
      })();
    }

    // Legacy local fallback path for unauthenticated/demo UI simulations.
    if (activeBalance < amount) return false;
    if (isDemoMode) {
      setDemoBalance(prev => prev - amount);
    } else {
      setBalance(prev => prev - amount);
    }
    return true;
  };

  const collectWinnings = (amount: number) => {
    if (amount <= 0) return;

    // Backend-controlled game sessions should settle from server events only.
    if (activeGameId && isAuthenticated) return;

    if (isDemoMode) {
      setDemoBalance(prev => prev + amount);
    } else {
      setBalance(prev => prev + amount);
    }
  };

  const cashout = async (gameData?: any) => {
    if (!activeGameId || !isAuthenticated) return null;

    try {
      const result = await wsService.cashout(activeGameId, gameData);

      if (result?.success && result.payout) {
        const payoutDisplay = result.payout / 100000;
        if (isDemoMode) {
          setDemoBalance(prev => prev + payoutDisplay);
        } else {
          setBalance(prev => prev + payoutDisplay);
        }
        fetchGameHistory();
      }

      return result;
    } catch (err) {
      console.error('Cashout error:', err);
      return null;
    }
  };

  const sendGameAction = async (action: string, data?: any) => {
    if (!activeGameId || !isAuthenticated) return null;

    try {
      return await wsService.sendGameAction(activeGameId, action, data);
    } catch (err) {
      console.error('Game action error:', err);
      return null;
    }
  };

  const fetchGameHistory = async () => {
    if (!isAuthenticated) return;

    try {
      const data = await apiService.getGameHistory(50);
      setGameHistory(data.map((s: any) => ({
        ...s,
        betAmount: s.bet_amount / 100000,
        payout: s.payout / 100000,
        multiplier: parseFloat(s.multiplier)
      })));
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const value: GameContextType = {
    user,
    isAuthenticated,
    isLoading,
    balance,
    demoBalance,
    isDemoMode,
    activeBalance,
    activeGameId,
    gameState,
    wsStatus,
    login,
    register,
    logout,
    toggleDemoMode,
    joinGame,
    leaveGame,
    placeBet,
    collectWinnings,
    cashout,
    sendGameAction,
    gameHistory,
    fetchGameHistory,
    clientSeed,
    setClientSeed,
    rotateClientSeed,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};

export default GameContext;
