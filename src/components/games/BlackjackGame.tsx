import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { PlayingCard } from '../ui/PlayingCard';
import type { Suit, Rank } from '../ui/PlayingCard';
import { motion, AnimatePresence } from 'framer-motion';
import { playBet, playWin, playLoss, playCardFlip } from '../../utils/sound';

const SUITS: Suit[] = ['♠', '♥', '♣', '♦'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

interface CardObj {
    suit: Suit;
    rank: Rank;
    id: string; // Unique ID for animations
}

const getCardValue = (rank: Rank): number => {
    if (rank === 'A') return 11;
    if (['K', 'Q', 'J'].includes(rank)) return 10;
    return parseInt(rank);
};

const calculateHand = (cards: CardObj[]) => {
    let total = 0;
    let aces = 0;

    cards.forEach(card => {
        const val = getCardValue(card.rank);
        total += val;
        if (card.rank === 'A') aces++;
    });

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
};

export const BlackjackGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [betAmount, setBetAmount] = useState(10);
    const [gameState, setGameState] = useState<'BETTING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'FINISHED'>('BETTING');
    const [playerHand, setPlayerHand] = useState<CardObj[]>([]);
    const [dealerHand, setDealerHand] = useState<CardObj[]>([]);
    const [result, setResult] = useState<'WIN' | 'LOSE' | 'PUSH' | 'BLACKJACK' | 'BUST' | null>(null);

    // Initial Deal
    const deal = () => {
        if (!placeBet(betAmount)) {
            alert("Insufficient funds");
            return;
        }

        playBet();
        setGameState('PLAYER_TURN');
        setResult(null);
        setPlayerHand([]);
        setDealerHand([]);

        setDealerHand([]);

        // Simulate dealing delay
        setTimeout(() => {
            playCardFlip();
            const p1 = drawCard();
            setTimeout(() => playCardFlip(), 200);
            const d1 = drawCard();
            setTimeout(() => playCardFlip(), 400);
            const p2 = drawCard();
            setTimeout(() => playCardFlip(), 600);
            const d2 = drawCard();

            setPlayerHand([p1, p2]);
            setDealerHand([d1, d2]);

            // Check Instant Blackjack
            const pScore = calculateHand([p1, p2]);
            if (pScore === 21) {
                // Check dealer blackjack later, or immediately win/push logic?
                // Usually instant win unless dealer has Ace/10. 
                // For simplicity: Auto-stand behavior or instant finish.
                setGameState('DEALER_TURN'); // Let dealer play (reveal hole card)
            }
        }, 500);
    };

    const drawCard = (): CardObj => {
        const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
        const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
        return { suit, rank, id: Math.random().toString(36).substr(2, 9) };
    };

    const handleHit = () => {
        const newCard = drawCard();
        playCardFlip();
        const newHand = [...playerHand, newCard];
        setPlayerHand(newHand);

        if (calculateHand(newHand) > 21) {
            setResult('BUST');
            setGameState('FINISHED');
        }
    };

    const handleStand = () => {
        setGameState('DEALER_TURN');
    };

    // Dealer Logic
    useEffect(() => {
        if (gameState === 'DEALER_TURN') {
            let currentDealerHand = [...dealerHand];
            let dealerScore = calculateHand(currentDealerHand);
            const playerScore = calculateHand(playerHand);

            const playDealer = async () => {
                // Dealer hits on soft 17? Let's say stands on all 17s for simplicity or hits soft 17.
                // Standard: Hit < 17.
                while (dealerScore < 17) {
                    await new Promise(r => setTimeout(r, 800)); // Delay for dramatic effect
                    const newCard = drawCard();
                    currentDealerHand = [...currentDealerHand, newCard];
                    setDealerHand(currentDealerHand);
                    dealerScore = calculateHand(currentDealerHand);
                }

                // Evaluate Result
                await new Promise(r => setTimeout(r, 500));
                setGameState('FINISHED');

                // Determine Winner
                if (playerScore > 21) {
                    setResult('BUST'); // Already handled, but safety
                } else if (dealerScore > 21) {
                    collectWinnings(betAmount * 2);
                    playWin();
                } else if (dealerScore > playerScore) {
                    setResult('LOSE');
                    playLoss();
                } else if (dealerScore < playerScore) {
                    if (playerScore === 21 && playerHand.length === 2) {
                        setResult('BLACKJACK');
                        collectWinnings(betAmount * 2.5); // 3:2 payout standard
                        playWin();
                    } else {
                        setResult('WIN');
                        collectWinnings(betAmount * 2);
                        playWin();
                    }
                } else {
                    // Push
                    setResult('PUSH');
                    collectWinnings(betAmount); // Return bet
                }
            };
            playDealer();
        }
    }, [gameState]);

    const playerTotal = calculateHand(playerHand);


    return (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', height: '100%' }}>

            {/* Sidebar Controls */}
            <div className="stake-card">
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3', marginBottom: '8px', display: 'block' }}>Bet Amount</label>
                    <div className="input-group" style={{ padding: '8px 12px', background: '#0f212e', border: '1px solid #2f4553' }}>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            disabled={gameState !== 'BETTING'}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '1rem', outline: 'none' }}
                        />
                        <span style={{ color: '#b1bad3' }}>₹</span>
                    </div>
                </div>

                {gameState === 'BETTING' || gameState === 'FINISHED' ? (
                    <button className="btn-primary" onClick={deal} style={{ width: '100%', padding: '16px', fontSize: '1.2rem', background: '#00e701', color: '#011e01' }}>
                        {gameState === 'FINISHED' ? 'Dealt Again' : 'Deal'}
                    </button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '16px', color: '#fff' }}>
                            Decision Required
                        </div>
                        <button
                            className="btn-primary"
                            onClick={handleHit}
                            disabled={gameState !== 'PLAYER_TURN'}
                            style={{ background: '#2f4553', border: '1px solid #00e701', color: '#00e701' }}
                        >
                            Hit
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleStand}
                            disabled={gameState !== 'PLAYER_TURN'}
                            style={{ background: '#00e701', color: '#011e01' }}
                        >
                            Stand
                        </button>
                    </div>
                )}
            </div>

            {/* Game Table */}
            <div className="game-container" style={{
                position: 'relative',
                background: '#15202b', // Dark felt
                border: '8px solid #3c2a1e', // Wood border simulation
                borderRadius: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '40px',
                boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)'
            }}>

                {/* Result Overlay */}
                <AnimatePresence>
                    {gameState === 'FINISHED' && result && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                zIndex: 10, background: 'rgba(0,0,0,0.8)', padding: '24px 48px', borderRadius: '16px',
                                border: `2px solid ${['WIN', 'BLACKJACK'].includes(result) ? '#00e701' : result === 'PUSH' ? '#b1bad3' : '#ea3e3e'}`,
                                textAlign: 'center'
                            }}
                        >
                            <h2 style={{ fontSize: '3rem', margin: 0, color: ['WIN', 'BLACKJACK'].includes(result) ? '#00e701' : result === 'PUSH' ? '#b1bad3' : '#ea3e3e' }}>
                                {result}
                            </h2>
                            {['WIN', 'BLACKJACK'].includes(result) && (
                                <div style={{ color: '#fff', fontSize: '1.5rem', marginTop: '8px' }}>+₹{betAmount}</div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* Dealer Area */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ color: '#b1bad3', marginBottom: '12px', opacity: 0.8 }}>Dealer - {gameState === 'PLAYER_TURN' ? '?' : calculateHand(dealerHand)}</div>
                    <div style={{ display: 'flex', gap: '12px', height: '180px' }}>
                        <AnimatePresence>
                            {dealerHand.map((card, i) => (
                                <motion.div
                                    key={card.id || i}
                                    initial={{ y: -200, opacity: 0, rotateX: 180 }}
                                    animate={{
                                        y: 0,
                                        opacity: 1,
                                        rotateX: (i === 1 && gameState === 'PLAYER_TURN') ? 180 : 0, // Hole card logic
                                        transition: { delay: i * 0.2 }
                                    }}
                                    style={{ perspective: 1000 }}
                                >
                                    <PlayingCard
                                        suit={card.suit}
                                        rank={card.rank}
                                        hidden={i === 1 && gameState === 'PLAYER_TURN'}
                                        style={{ width: 120, height: 168 }}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Deck / Center Decoration */}
                <div style={{
                    width: '100px', height: '140px',
                    borderRadius: '8px', border: '2px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0.3
                }}>
                    <div style={{ fontSize: '3rem' }}>♠️</div>
                </div>

                {/* Player Area */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px', height: '180px' }}>
                        <AnimatePresence>
                            {playerHand.map((card, i) => (
                                <motion.div
                                    key={card.id || i}
                                    initial={{ y: 200, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1, transition: { delay: i * 0.2 + 0.5 } }}
                                >
                                    <PlayingCard
                                        suit={card.suit}
                                        rank={card.rank}
                                        style={{ width: 120, height: 168 }}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    <div style={{
                        marginTop: '12px',
                        background: '#0f212e', padding: '8px 24px', borderRadius: '20px',
                        border: '1px solid #2f4553', fontWeight: 'bold', fontSize: '1.2rem'
                    }}>
                        {playerTotal}
                    </div>
                </div>

            </div>
        </div>
    );
};
