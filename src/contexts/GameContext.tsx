import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface GameContextType {
    balance: number;
    activeGameId: string | null;
    joinGame: (gameId: string) => void;
    leaveGame: () => void;
    placeBet: (amount: number) => boolean;
    collectWinnings: (amount: number) => void;
    isAuthenticated: boolean;
    login: (method: 'phone' | 'email', value: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [balance, setBalance] = useState(1000);
    const [activeGameId, setActiveGameId] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const login = (method: 'phone' | 'email', value: string) => {
        console.log(`Logging in with ${method}: ${value}`);
        setIsAuthenticated(true);
        // Reset balance or fetch user balance here usually
    };

    const joinGame = (gameId: string) => {
        setActiveGameId(gameId);
    };

    const leaveGame = () => {
        setActiveGameId(null);
    };

    const placeBet = (amount: number): boolean => {
        if (balance >= amount) {
            setBalance(prev => prev - amount);
            return true;
        }
        return false;
    };

    const collectWinnings = (amount: number) => {
        setBalance(prev => prev + amount);
    };

    return (
        <GameContext.Provider value={{
            balance,
            activeGameId,
            joinGame,
            leaveGame,
            placeBet,
            collectWinnings,
            isAuthenticated,
            login
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};
