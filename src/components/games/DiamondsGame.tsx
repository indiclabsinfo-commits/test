import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GiDiamondHard, GiCutDiamond, GiCrystalGrowth, GiEmerald, GiFloatingCrystal as GiRubyIcon, GiTopaz, GiAmethyst } from 'react-icons/gi';
import { formatIndianNumber } from '../../utils/format';
import { playBet, playWin, playLoss } from '../../utils/sound';

// Gem Types
const GEMS = [
    { id: 'green', color: '#00e701', icon: GiEmerald },
    { id: 'purple', color: '#9d00ff', icon: GiAmethyst },
    { id: 'yellow', color: '#ffd700', icon: GiTopaz },
    { id: 'red', color: '#ff003c', icon: GiRubyIcon },
    { id: 'blue', color: '#00ccff', icon: GiCutDiamond },
    { id: 'cyan', color: '#00ffcc', icon: GiDiamondHard },
    { id: 'orange', color: '#ffaa00', icon: GiCrystalGrowth },
];

const PAYOUTS = [
    { name: '5 x Matches', multiplier: 50.00 },
    { name: '4 x Matches', multiplier: 5.00 }, // Stake uses 4, 3, 2 for matches
    { name: 'Full House', multiplier: 4.00 },
    { name: '3 x Matches', multiplier: 3.00 },
    { name: '2 Pair', multiplier: 2.00 },
    { name: 'Pair', multiplier: 0.00 }, // Usually 0 or return bet? Let's say 0 to keep it simple high variance.
];

export const DiamondsGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [gameState, setGameState] = useState<'IDLE' | 'DEALING' | 'RESULT'>('IDLE');
    const [betAmount, setBetAmount] = useState(10);
    const [dealtGems, setDealtGems] = useState<typeof GEMS>(Array(5).fill(GEMS[0])); // Initial placeholder
    const [winnings, setWinnings] = useState(0);
    const [resultRank, setResultRank] = useState<string | null>(null);

    const spin = async () => {
        if (!placeBet(betAmount)) {
            alert("Insufficient funds");
            return;
        }

        playBet();
        setGameState('DEALING');
        setWinnings(0);
        setResultRank(null);

        // Simulate Network Delay / Animation
        // In reality, we'd determine result immediately but animate reveal.

        // Generate Result
        const result: typeof GEMS = [];
        for (let i = 0; i < 5; i++) {
            const randomGem = GEMS[Math.floor(Math.random() * GEMS.length)];
            result.push(randomGem);
        }

        // Trigger Animations one by one? 
        // Let's just set them and let framer-motion stagger.
        // Actually, for "dealing" effect, we might want a delay.

        await new Promise(r => setTimeout(r, 600)); // Initial pause
        setDealtGems(result);

        // Calculate Payout after reveal
        setTimeout(() => {
            calculateResult(result);
        }, 1000); // Wait for animations
    };

    const calculateResult = (finalGems: typeof GEMS) => {
        const counts: Record<string, number> = {};
        finalGems.forEach(g => {
            counts[g.id] = (counts[g.id] || 0) + 1;
        });

        const countsValues = Object.values(counts).sort((a, b) => b - a); // e.g. [3, 2] for Full House

        let multiplier = 0.00;
        let rank = '';

        if (countsValues[0] === 5) {
            multiplier = 50.00;
            rank = '5 x Matches';
        } else if (countsValues[0] === 4) {
            multiplier = 5.00;
            rank = '4 x Matches';
        } else if (countsValues[0] === 3 && countsValues[1] === 2) {
            multiplier = 4.00;
            rank = 'Full House';
        } else if (countsValues[0] === 3) {
            multiplier = 3.00;
            rank = '3 x Matches';
        } else if (countsValues[0] === 2 && countsValues[1] === 2) {
            multiplier = 2.00;
            rank = '2 Pair';
        } else if (countsValues[0] === 2) {
            rank = 'Pair';
            multiplier = 0.00;
        } else {
            rank = 'No Match';
            multiplier = 0.00;
        }

        if (multiplier > 0) {
            const winAmount = betAmount * multiplier;
            collectWinnings(winAmount);
            setWinnings(winAmount);
            playWin();
        } else {
            playLoss();
        }

        setResultRank(rank);
        setGameState('RESULT');
    };


    return (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', height: '100%' }}>
            {/* Sidebar Controls */}
            <div className="stake-card">
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3', marginBottom: '8px', display: 'block' }}>Bet Amount</label>
                    <div className="input-group">
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff' }}
                        />
                        <span style={{ color: '#b1bad3' }}>₹</span>
                    </div>
                </div>

                {/* Payout Table */}
                <div style={{ marginBottom: '24px', background: '#0f212e', borderRadius: '8px', padding: '12px' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: '#fff' }}>Payouts</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {PAYOUTS.map(p => (
                            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: resultRank === p.name ? '#00e701' : '#b1bad3', fontWeight: resultRank === p.name ? 'bold' : 'normal' }}>{p.name}</span>
                                <span style={{ color: '#fff' }}>{p.multiplier.toFixed(2)}x</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    className="btn-primary"
                    onClick={spin}
                    disabled={gameState === 'DEALING'}
                    style={{ width: '100%', padding: '16px', fontSize: '1.2rem', background: '#00e701', color: '#011e01' }}
                >
                    {gameState === 'DEALING' ? 'Dealing...' : 'Bet'}
                </button>
            </div>

            {/* Game Area */}
            <div className="game-container" style={{
                position: 'relative',
                background: '#0f212e',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '40px'
            }}>

                {/* Gems Row */}
                <div style={{ display: 'flex', gap: '20px', perspective: '1000px' }}>
                    {dealtGems.map((gem, i) => (
                        <GemCard
                            key={i}
                            gem={gem}
                            index={i}
                            revealing={gameState === 'DEALING'}
                            isResult={gameState === 'RESULT'}
                        />
                    ))}
                </div>

                {/* Result Text */}
                <AnimatePresence>
                    {gameState === 'RESULT' && resultRank && winnings > 0 && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute', bottom: '10%',
                                background: 'rgba(0, 231, 1, 0.1)', border: '1px solid #00e701',
                                padding: '16px 32px', borderRadius: '12px',
                                textAlign: 'center'
                            }}
                        >
                            <div style={{ color: '#00e701', fontSize: '1.5rem', fontWeight: 'bold' }}>
                                {formatIndianNumber(winnings, true)}
                            </div>
                            <div style={{ color: '#fff', fontSize: '0.9rem' }}>
                                {resultRank}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

const GemCard = ({ gem, index, revealing, isResult }: any) => {
    // Basic Flip Animation when gem changes (handled by key or effect? Here simple layout animation)
    return (
        <motion.div
            initial={{ rotateY: 0, scale: 1 }}
            animate={{
                rotateY: revealing ? [0, 90, 0] : 0,
                scale: isResult ? 1.1 : 1
            }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            style={{
                width: '80px', height: '80px',
                background: '#2f4553',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 6px rgba(0,0,0,0.3)`
            }}
        >
            <div style={{
                fontSize: '3rem',
                color: gem.color,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
            }}>
                <gem.icon />
            </div>
        </motion.div>
    );
}
