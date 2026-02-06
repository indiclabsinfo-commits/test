import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { PlayingCard } from '../ui/PlayingCard';
import type { Suit, Rank } from '../ui/PlayingCard';
import { motion, AnimatePresence } from 'framer-motion';
import { playBet, playWin, playLoss, playClick } from '../../utils/sound';

interface Card {
    suit: Suit;
    rank: Rank;
    value: number; // 1-13
}

const SUITS: Suit[] = ['♠', '♥', '♣', '♦'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const drawCard = (): Card => {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const rankIndex = Math.floor(Math.random() * RANKS.length);
    return {
        suit,
        rank: RANKS[rankIndex],
        value: rankIndex + 1
    };
};

export const HiLoGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER' | 'WON'>('IDLE');
    const [betAmount, setBetAmount] = useState(10);
    const [currentCard, setCurrentCard] = useState<Card | null>(null);
    const [history, setHistory] = useState<Card[]>([]);
    const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
    const [roundCount, setRoundCount] = useState(0);


    const getOdds = (currentVal: number) => {
        const higherCards = 13 - currentVal;
        const lowerCards = currentVal - 1;
        const sameCards = 1;

        const pHighSame = (higherCards + sameCards) / 13;
        const pLowSame = (lowerCards + sameCards) / 13;

        const houseEdge = 0.96;
        const multHigh = (1 / pHighSame) * houseEdge;
        const multLow = (1 / pLowSame) * houseEdge;

        return {
            high: parseFloat(multHigh.toFixed(2)),
            low: parseFloat(multLow.toFixed(2)),
            pHigh: pHighSame,
            pLow: pLowSame
        };
    };

    const startGame = () => {
        if (placeBet(betAmount)) {
            playBet();
            const startInfo = drawCard();
            setCurrentCard(startInfo);
            setHistory([startInfo]);
            setCurrentMultiplier(1.0);
            setRoundCount(0);
            setGameState('PLAYING');
        } else {
            alert("Insufficient Funds");
        }
    };

    const handleGuess = (guess: 'HIGHER' | 'LOWER') => {
        if (!currentCard || gameState !== 'PLAYING') return;

        const nextCard = drawCard();
        const prevVal = currentCard.value;
        const nextVal = nextCard.value;

        const odds = getOdds(prevVal);
        const multiplierIncrement = guess === 'HIGHER' ? odds.high : odds.low;

        let won = false;
        if (guess === 'HIGHER' && nextVal >= prevVal) won = true;
        if (guess === 'LOWER' && nextVal <= prevVal) won = true;

        setHistory(prev => [...prev.slice(-3), nextCard]); // Keep last 4 visuals
        setCurrentCard(nextCard);
        setRoundCount(prev => prev + 1);

        if (won) {
            let moveMult = multiplierIncrement;
            if (roundCount === 0) {
                // First move multiplier handling if needed
            }
            playClick();
            setCurrentMultiplier(prev => prev * moveMult);
        } else {
            setGameState('GAMEOVER');
            playLoss();
            setCurrentMultiplier(0);
        }
    };

    const handleCashout = () => {
        if (gameState !== 'PLAYING' || roundCount === 0) return;
        const winAmount = Math.floor(betAmount * currentMultiplier);
        collectWinnings(winAmount);
        playWin();
        setGameState('WON');
    };

    const odds = currentCard ? getOdds(currentCard.value) : { high: 0, low: 0, pHigh: 0, pLow: 0 };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', height: '100%', alignItems: 'start' }}>
            {/* Sidebar */}
            <div className="stake-card">
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3', marginBottom: '8px', display: 'block', fontWeight: 600 }}>Bet Amount</label>
                    <div className="input-group" style={{ padding: '8px 12px', background: '#0f212e', border: '1px solid #2f4553' }}>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            disabled={gameState === 'PLAYING'}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                        />
                        <span style={{ color: '#b1bad3', fontWeight: 600 }}>$</span>
                    </div>
                </div>

                {gameState === 'PLAYING' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ background: '#0f212e', padding: '16px', borderRadius: '8px', border: '1px solid #2f4553' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3', marginBottom: '8px' }}>
                                <span>Multiplier</span>
                                <span style={{ color: '#00e701', fontWeight: 'bold' }}>{currentMultiplier.toFixed(2)}x</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3' }}>
                                <span>Profit</span>
                                <span style={{ color: '#00e701', fontWeight: 'bold' }}>${((betAmount * currentMultiplier) - betAmount).toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                className="btn-primary"
                                onClick={() => handleGuess('HIGHER')}
                                style={{
                                    background: '#2f4553',
                                    border: '1px solid #3f5563',
                                    padding: '16px',
                                    height: 'auto',
                                    flexDirection: 'column',
                                    alignItems: 'stretch'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '1rem' }}>Higher or Same</span>
                                    <span style={{ color: '#00e701', fontSize: '1rem' }}>{odds.high}x</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${odds.pHigh * 100}%`, height: '100%', background: '#00e701' }}></div>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#b1bad3', textAlign: 'left', marginTop: '4px' }}>{(odds.pHigh * 100).toFixed(0)}% Chance</div>
                            </button>

                            <button
                                className="btn-primary"
                                onClick={() => handleGuess('LOWER')}
                                style={{
                                    background: '#2f4553',
                                    border: '1px solid #3f5563',
                                    padding: '16px',
                                    height: 'auto',
                                    flexDirection: 'column',
                                    alignItems: 'stretch'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '1rem' }}>Lower or Same</span>
                                    <span style={{ color: '#00e701', fontSize: '1rem' }}>{odds.low}x</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${odds.pLow * 100}%`, height: '100%', background: '#00e701' }}></div>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#b1bad3', textAlign: 'left', marginTop: '4px' }}>{(odds.pLow * 100).toFixed(0)}% Chance</div>
                            </button>
                        </div>

                        <button
                            className="btn-primary"
                            onClick={handleCashout}
                            disabled={roundCount === 0}
                            style={{
                                background: roundCount === 0 ? '#2f4553' : '#00e701',
                                color: roundCount === 0 ? '#b1bad3' : '#011e01',
                                marginTop: '16px',
                                padding: '16px',
                                fontSize: '1.1rem'
                            }}
                        >
                            Cashout ${(betAmount * currentMultiplier).toFixed(2)}
                        </button>
                    </div>
                ) : (
                    <button className="btn-primary" onClick={startGame} style={{ width: '100%', background: '#00e701', color: '#011e01', padding: '16px', fontSize: '1.1rem' }}>
                        Play
                    </button>
                )}
            </div>

            {/* Game Board */}
            <div className="game-container" style={{
                position: 'relative',
                minHeight: '600px',
                background: 'radial-gradient(circle at center, #1a2c38 0%, #0f212e 100%)',
                borderColor: '#2f4553',
                overflow: 'hidden'
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
                                    +${((betAmount * currentMultiplier) - betAmount).toFixed(2)}
                                </div>
                            )}
                            <button className="btn-secondary" onClick={() => setGameState('IDLE')} style={{ marginTop: '24px', padding: '12px 32px' }}>
                                Play Again
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Cards Area */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    width: '100%'
                }}>

                    {/* Active Card Container */}
                    <div style={{ position: 'relative', width: 200, height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>

                        <AnimatePresence mode="popLayout">
                            {/* Current Card */}
                            {currentCard ? (
                                <motion.div
                                    key={`current-${roundCount}`}
                                    initial={{ x: 100, opacity: 0, rotate: 10 }}
                                    animate={{ x: 0, opacity: 1, rotate: 0 }}
                                    exit={{ x: -100, opacity: 0, scale: 0.8 }}
                                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                    style={{ position: 'absolute', zIndex: 2 }}
                                >
                                    <PlayingCard
                                        suit={currentCard.suit}
                                        rank={currentCard.rank}
                                        style={{ width: 180, height: 260, fontSize: '1.2rem' }}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <PlayingCard
                                        suit="♠"
                                        rank="A"
                                        hidden
                                        style={{ width: 180, height: 260, opacity: 0.5 }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* History */}
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '40px',
                        height: '120px',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {history.slice(0, -1).map((card, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 0.6, y: 0 }}
                                whileHover={{ opacity: 1, y: -10 }}
                            >
                                <PlayingCard
                                    suit={card.suit}
                                    rank={card.rank}
                                    style={{ width: 80, height: 115 }}
                                    className="history-card"
                                />
                            </motion.div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};
