import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSkull } from 'react-icons/fa';
import { GiDinosaurEgg } from 'react-icons/gi';
import { playBet, playWin, playLoss, playClick } from '../../utils/sound';

const TOWER_LEVELS = 8;
const TOWER_COLS = 3;
const BOMBS_PER_ROW = 1;

const MULTIPLIERS = [1.42, 2.02, 2.87, 4.08, 5.80, 8.24, 11.71, 16.63];

export const DragonTowerGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER' | 'WON'>('IDLE');
    const [betAmount, setBetAmount] = useState(10);
    const [currentRow, setCurrentRow] = useState(0);
    const [gridParams, setGridParams] = useState<boolean[][]>([]);
    const [revealedCells, setRevealedCells] = useState<boolean[][]>([]);

    const generateTower = () => {
        const newGrid: boolean[][] = [];
        for (let r = 0; r < TOWER_LEVELS; r++) {
            const row: boolean[] = [true, true, true];
            let bombsPlaced = 0;
            while (bombsPlaced < BOMBS_PER_ROW) {
                const bombIndex = Math.floor(Math.random() * TOWER_COLS);
                if (row[bombIndex]) {
                    row[bombIndex] = false;
                    bombsPlaced++;
                }
            }
            newGrid.push(row);
        }
        return newGrid;
    };

    const startGame = () => {
        if (placeBet(betAmount)) {
            playBet();
            setGridParams(generateTower());

            const initialRevealed = Array(TOWER_LEVELS).fill(null).map(() => Array(TOWER_COLS).fill(false));
            setRevealedCells(initialRevealed);

            setCurrentRow(0);
            setGameState('PLAYING');
        } else {
            alert("Insufficient Funds");
        }
    };

    const handleCellClick = (row: number, col: number) => {
        if (gameState !== 'PLAYING') return;
        if (row !== currentRow) return;

        const isSafe = gridParams[row][col];

        const newRevealed = [...revealedCells];
        newRevealed[row][col] = true;
        setRevealedCells(newRevealed);

        if (isSafe) {
            if (currentRow === TOWER_LEVELS - 1) {
                setGameState('WON');
                const winAmount = Math.floor(betAmount * MULTIPLIERS[currentRow]);
                collectWinnings(winAmount);
                playWin();
            } else {
                playClick();
                setCurrentRow(prev => prev + 1);
            }
        } else {
            setGameState('GAMEOVER');
            playLoss();
            // Reveal all for that row? Or just show bomb.
        }
    };

    const handleCashout = () => {
        if (gameState !== 'PLAYING' || currentRow === 0) return;

        const winIndex = currentRow - 1;
        if (winIndex >= 0) {
            const winAmount = Math.floor(betAmount * MULTIPLIERS[winIndex]);
            collectWinnings(winAmount);
            playWin();
            setGameState('WON');
        }
    };

    const getProfit = () => {
        if (currentRow === 0) return 0;
        return Math.floor(betAmount * MULTIPLIERS[currentRow - 1]) - betAmount;
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 25%) 1fr', gap: '24px', height: '100%' }}>
            {/* Sidebar */}
            <div className="stake-card">
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3', marginBottom: '8px', display: 'block' }}>Bet Amount</label>
                    <div className="input-group" style={{ padding: '8px 12px', background: '#0f212e', border: '1px solid #2f4553' }}>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            disabled={gameState === 'PLAYING'}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '1rem', outline: 'none' }}
                        />
                        <span style={{ color: '#b1bad3' }}>$</span>
                    </div>
                </div>

                {gameState === 'PLAYING' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '8px', color: '#b1bad3', background: '#0f212e', padding: '12px', borderRadius: '8px', border: '1px solid #2f4553' }}>
                            Current Profit
                            <div style={{ color: '#00e701', fontSize: '1.5rem', fontWeight: 'bold' }}>${getProfit().toFixed(2)}</div>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={handleCashout}
                            disabled={currentRow === 0}
                            style={{
                                background: currentRow === 0 ? '#2f4553' : '#00e701',
                                color: currentRow === 0 ? '#b1bad3' : '#011e01',
                                padding: '16px',
                                fontSize: '1.1rem'
                            }}
                        >
                            Cashout
                        </button>
                    </div>
                ) : (
                    <button className="btn-primary" onClick={startGame} style={{ width: '100%', padding: '16px', fontSize: '1.1rem', background: '#00e701', color: '#011e01' }}>
                        Play
                    </button>
                )}
            </div>

            {/* Game Board */}
            <div className="game-container" style={{
                position: 'relative',
                background: 'radial-gradient(circle at center, #1a2c38 0%, #0f212e 100%)',
                borderColor: '#2f4553',
                alignItems: 'center',
                justifyContent: 'center'
            }}>

                {/* Result Overlay */}
                <AnimatePresence>
                    {(gameState === 'GAMEOVER' || gameState === 'WON') && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute',
                                zIndex: 10,
                                background: 'rgba(15, 33, 46, 0.95)',
                                padding: '40px',
                                borderRadius: '16px',
                                textAlign: 'center',
                                border: `2px solid ${gameState === 'WON' ? '#00e701' : '#ea3e3e'}`,
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{gameState === 'WON' ? '🏆' : '💀'}</div>
                            <h2 style={{ color: gameState === 'WON' ? '#00e701' : '#ea3e3e', fontSize: '2.5rem', marginBottom: '8px' }}>
                                {gameState === 'WON' ? 'YOU WON!' : 'GAME OVER'}
                            </h2>
                            {gameState === 'WON' && (
                                <div style={{ fontSize: '2rem', color: '#fff', fontWeight: 'bold' }}>
                                    +${((betAmount * MULTIPLIERS[currentRow]).toFixed(2))}
                                </div>
                            )}
                            <button className="btn-secondary" onClick={() => setGameState('IDLE')} style={{ marginTop: '24px', padding: '12px 32px' }}>
                                Play Again
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tower Grid */}
                <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '12px', padding: '24px' }}>
                    {Array.from({ length: TOWER_LEVELS }).map((_, rIndex) => (
                        <div key={rIndex} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            {/* Multiplier Label */}
                            <div style={{
                                width: '60px',
                                textAlign: 'right',
                                color: currentRow === rIndex ? '#fff' : '#b1bad3',
                                fontWeight: currentRow === rIndex ? 'bold' : 'normal',
                                opacity: gameState === 'PLAYING' && rIndex > currentRow ? 0.3 : 1
                            }}>
                                {MULTIPLIERS[rIndex]}x
                            </div>

                            {/* Row Cells */}
                            <div style={{
                                display: 'flex',
                                gap: '12px',
                                padding: '8px',
                                borderRadius: '12px',
                                background: currentRow === rIndex && gameState === 'PLAYING' ? 'rgba(0, 231, 1, 0.05)' : 'transparent',
                                border: currentRow === rIndex && gameState === 'PLAYING' ? '1px solid rgba(0, 231, 1, 0.2)' : '1px solid transparent',
                                transition: 'all 0.3s ease'
                            }}>
                                {Array.from({ length: TOWER_COLS }).map((_, cIndex) => {
                                    const isRevealed = revealedCells[rIndex]?.[cIndex];
                                    const isBomb = gridParams[rIndex]?.[cIndex] === false;
                                    const isActiveRow = currentRow === rIndex && gameState === 'PLAYING';

                                    return (
                                        <motion.button
                                            key={cIndex}
                                            onClick={() => handleCellClick(rIndex, cIndex)}
                                            disabled={!isActiveRow}
                                            whileHover={isActiveRow ? { scale: 1.05, backgroundColor: '#3f5563' } : {}}
                                            whileTap={isActiveRow ? { scale: 0.95 } : {}}
                                            style={{
                                                width: '80px',
                                                height: '60px',
                                                background: isRevealed ? (isBomb ? '#ea3e3e' : '#00e701') : '#2f4553',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                fontSize: '1.5rem',
                                                cursor: isActiveRow ? 'pointer' : 'default',
                                                opacity: gameState === 'PLAYING' && rIndex > currentRow ? 0.5 : 1,
                                                border: 'none',
                                                boxShadow: isRevealed
                                                    ? (isBomb ? '0 0 10px rgba(234, 62, 62, 0.5)' : '0 0 10px rgba(0, 231, 1, 0.5)')
                                                    : '0 4px 6px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            <AnimatePresence mode='wait'>
                                                {isRevealed ? (
                                                    isBomb ? (
                                                        <motion.div
                                                            key="bomb"
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: 'spring' }}
                                                        >
                                                            <FaSkull size={24} color="#fff" />
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div
                                                            key="egg"
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: 'spring' }}
                                                        >
                                                            <GiDinosaurEgg size={28} color="#fff" />
                                                        </motion.div>
                                                    )
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%' }}></div>
                                                )}
                                            </AnimatePresence>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};
