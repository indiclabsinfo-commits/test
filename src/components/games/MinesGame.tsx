import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { playBet, playWin, playLoss, playClick } from '../../utils/sound';

export const MinesGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    // Config
    const [betAmount, setBetAmount] = useState(10);
    const [minesCount, setMinesCount] = useState(3);

    // Game State
    const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'CASHED_OUT' | 'BUSTED'>('IDLE');
    const [grid, setGrid] = useState<boolean[]>(Array(25).fill(false)); // true = mine
    const [revealed, setRevealed] = useState<boolean[]>(Array(25).fill(false));
    const [multiplier, setMultiplier] = useState(1.0);

    // Logic
    const startGame = () => {
        if (!placeBet(betAmount)) return alert("Insufficient balance");

        playBet();

        // Generate Mines
        const newGrid = Array(25).fill(false);
        let placed = 0;
        while (placed < minesCount) {
            const idx = Math.floor(Math.random() * 25);
            if (!newGrid[idx]) {
                newGrid[idx] = true;
                placed++;
            }
        }

        setGrid(newGrid);
        setRevealed(Array(25).fill(false));
        setGameState('PLAYING');
        setMultiplier(1.0);
    };

    const handleTileClick = (index: number) => {
        if (gameState !== 'PLAYING' || revealed[index]) return;

        const newRevealed = [...revealed];
        newRevealed[index] = true;
        setRevealed(newRevealed);

        if (grid[index]) {
            // Hit Mine
            setGameState('BUSTED');
            playLoss();
            // Reveal all
            setRevealed(Array(25).fill(true));
        } else {
            // Safe
            playClick();
            // Calculate new multiplier based on odds
            // Simplification: each step adds roughly 15%ish compounding based on risk


            setMultiplier(prev => parseFloat((prev * (1 + (minesCount / (25 - newRevealed.filter(r => r).length)) * 0.9)).toFixed(2)));
        }
    };

    const cashout = () => {
        if (gameState !== 'PLAYING') return;
        collectWinnings(betAmount * multiplier);
        playWin();
        setGameState('CASHED_OUT');
        setRevealed(Array(25).fill(true)); // Show board
    };

    return (
        <div className="game-shell game-layout-two game-theme-mines">
            {/* Sidebar */}
            <div className="stake-card game-panel" style={{ padding: '16px', height: 'fit-content' }}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#b1bad3' }}>Bet Amount</label>
                    <div className="input-group">
                        <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} disabled={gameState === 'PLAYING'}
                            style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '8px', outline: 'none' }} />
                    </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#b1bad3' }}>Mines (1-24)</label>
                    <div className="input-group">
                        <input type="number" min="1" max="24" value={minesCount} onChange={e => setMinesCount(Number(e.target.value))} disabled={gameState === 'PLAYING'}
                            style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '8px', outline: 'none' }} />
                    </div>
                </div>

                {gameState === 'PLAYING' ? (
                    <button className="btn-primary" onClick={cashout} style={{ width: '100%', padding: '16px' }}>
                        Cashout ${(betAmount * multiplier).toFixed(2)} ({multiplier.toFixed(2)}x)
                    </button>
                ) : (
                    <button className="btn-primary" onClick={startGame} style={{ width: '100%', padding: '16px' }}>
                        Play
                    </button>
                )}
            </div>

            {/* Grid */}
            <div className="game-container game-stage" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', padding: 'min(5vw, 28px)', width: '100%', maxWidth: '520px', margin: '0 auto', alignItems: 'stretch', justifyItems: 'stretch' }}>
                {Array(25).fill(null).map((_, i) => (
                    <button
                        key={i}
                        onClick={() => handleTileClick(i)}
                        disabled={gameState !== 'PLAYING' && !revealed[i]}
                        style={{
                            aspectRatio: '1',
                            width: '100%',
                            background: revealed[i] ? (grid[i] ? '#ea3e3e' : '#0f212e') : '#2f4553',
                            border: '4px solid #1a2c38',
                            borderRadius: '8px',
                            fontSize: '2rem',
                            cursor: gameState === 'PLAYING' && !revealed[i] ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: revealed[i] ? 'inset 0 0 10px rgba(0,0,0,0.5)' : '0 4px 6px rgba(0,0,0,0.2)'
                        }}
                    >
                        {revealed[i] ? (grid[i] ? '💣' : '💎') : ''}
                    </button>
                ))}
            </div>
        </div>
    );
};
