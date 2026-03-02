import React, { useMemo, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GiDiamondHard, GiCutDiamond, GiCrystalGrowth, GiEmerald, GiFloatingCrystal as GiRubyIcon, GiTopaz, GiAmethyst } from 'react-icons/gi';
import { formatIndianNumber } from '../../utils/format';
import { playBet, playWin, playLoss } from '../../utils/sound';

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
    { name: '5 x Matches', multiplier: 50.0 },
    { name: '4 x Matches', multiplier: 5.0 },
    { name: 'Full House', multiplier: 4.0 },
    { name: '3 x Matches', multiplier: 3.0 },
    { name: '2 Pair', multiplier: 2.0 },
    { name: 'Pair', multiplier: 0.0 },
];

type Gem = (typeof GEMS)[number];

interface RoundResult {
    rank: string;
    winnings: number;
}

export const DiamondsGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [gameState, setGameState] = useState<'IDLE' | 'DEALING' | 'RESULT'>('IDLE');
    const [betAmount, setBetAmount] = useState(10);
    const [dealtGems, setDealtGems] = useState<Gem[]>(() => [GEMS[0], GEMS[1], GEMS[2], GEMS[3], GEMS[4]]);
    const [winnings, setWinnings] = useState(0);
    const [resultRank, setResultRank] = useState<string | null>(null);
    const [history, setHistory] = useState<RoundResult[]>([]);

    const totalBet = useMemo(() => betAmount, [betAmount]);

    const spin = async () => {
        if (gameState === 'DEALING') return;
        if (!placeBet(betAmount)) {
            alert('Insufficient funds');
            return;
        }

        playBet();
        setGameState('DEALING');
        setWinnings(0);
        setResultRank(null);

        const result: Gem[] = [];
        for (let i = 0; i < 5; i += 1) {
            result.push(GEMS[Math.floor(Math.random() * GEMS.length)]);
        }

        await new Promise(r => setTimeout(r, 520));
        setDealtGems(result);

        setTimeout(() => {
            calculateResult(result);
        }, 750);
    };

    const calculateResult = (finalGems: Gem[]) => {
        const counts: Record<string, number> = {};
        finalGems.forEach(g => {
            counts[g.id] = (counts[g.id] || 0) + 1;
        });

        const values = Object.values(counts).sort((a, b) => b - a);

        let multiplier = 0;
        let rank = 'No Match';

        if (values[0] === 5) {
            multiplier = 50;
            rank = '5 x Matches';
        } else if (values[0] === 4) {
            multiplier = 5;
            rank = '4 x Matches';
        } else if (values[0] === 3 && values[1] === 2) {
            multiplier = 4;
            rank = 'Full House';
        } else if (values[0] === 3) {
            multiplier = 3;
            rank = '3 x Matches';
        } else if (values[0] === 2 && values[1] === 2) {
            multiplier = 2;
            rank = '2 Pair';
        } else if (values[0] === 2) {
            multiplier = 0;
            rank = 'Pair';
        }

        let roundWinnings = 0;
        if (multiplier > 0) {
            roundWinnings = betAmount * multiplier;
            collectWinnings(roundWinnings);
            playWin();
        } else {
            playLoss();
        }

        setWinnings(roundWinnings);
        setResultRank(rank);
        setHistory(prev => [{ rank, winnings: roundWinnings }, ...prev].slice(0, 8));
        setGameState('RESULT');
    };

    return (
        <div className="game-shell game-layout-two game-theme-diamonds">
            <div className="stake-card game-panel">
                <div style={{ marginBottom: '16px' }}>
                    <div className="game-section-title">Bet Amount</div>
                    <div className="bet-input-row">
                        <input
                            type="number"
                            value={betAmount}
                            min={1}
                            disabled={gameState === 'DEALING'}
                            onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value) || 0))}
                        />
                        <span style={{ color: '#b1bad3' }}>₹</span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                    {[10, 25, 50, 100].map(amount => (
                        <button key={amount} className="btn-quick" disabled={gameState === 'DEALING'} onClick={() => setBetAmount(amount)}>
                            {amount}
                        </button>
                    ))}
                </div>

                <div className="game-stat-block" style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#fff' }}>Payouts</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {PAYOUTS.map(p => (
                            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: resultRank === p.name ? '#00e701' : '#b1bad3', fontWeight: resultRank === p.name ? 700 : 500 }}>{p.name}</span>
                                <span style={{ color: '#fff' }}>{p.multiplier.toFixed(2)}x</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <div className="game-stat-block" style={{ flex: 1 }}>
                        <div style={{ color: '#8ba0b5', fontSize: '0.75rem' }}>Bet</div>
                        <div style={{ color: '#fff', fontWeight: 800 }}>₹{formatIndianNumber(totalBet)}</div>
                    </div>
                    <div className="game-stat-block" style={{ flex: 1 }}>
                        <div style={{ color: '#8ba0b5', fontSize: '0.75rem' }}>Last Win</div>
                        <div style={{ color: winnings > 0 ? '#00e701' : '#fff', fontWeight: 800 }}>₹{formatIndianNumber(winnings || 0)}</div>
                    </div>
                </div>

                <button className="btn-primary" onClick={spin} disabled={gameState === 'DEALING'} style={{ width: '100%', padding: '16px', fontSize: '1.05rem' }}>
                    {gameState === 'DEALING' ? 'Dealing...' : 'Bet'}
                </button>

                <div style={{ marginTop: '12px' }}>
                    <div className="game-section-title">Recent Rounds</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {history.length === 0 && <span style={{ color: '#6d8094', fontSize: '0.8rem' }}>No rounds yet</span>}
                        {history.map((item, i) => (
                            <span
                                key={`${item.rank}_${i}`}
                                style={{
                                    background: item.winnings > 0 ? '#2b8af7' : '#34495e',
                                    color: '#fff',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700
                                }}
                            >
                                {item.rank}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div
                className="game-container game-stage"
                style={{
                    position: 'relative',
                    background: 'radial-gradient(circle at 50% 10%, rgba(70, 131, 255, 0.26), #0f212e 68%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '28px'
                }}
            >
                <div style={{ display: 'flex', gap: 'clamp(8px, 1.8vw, 20px)', perspective: '1000px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {dealtGems.map((gem, i) => (
                        <GemCard
                            key={`${gem.id}_${i}_${gameState}`}
                            gem={gem}
                            index={i}
                            revealing={gameState === 'DEALING'}
                            isResult={gameState === 'RESULT'}
                        />
                    ))}
                </div>

                <AnimatePresence>
                    {gameState === 'RESULT' && resultRank && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                background: winnings > 0 ? 'rgba(0, 231, 1, 0.11)' : 'rgba(234, 62, 62, 0.14)',
                                border: `1px solid ${winnings > 0 ? '#00e701' : '#ea3e3e'}`,
                                padding: '14px 26px',
                                borderRadius: '12px',
                                textAlign: 'center',
                                minWidth: '220px'
                            }}
                        >
                            <div style={{ color: winnings > 0 ? '#00e701' : '#ea3e3e', fontSize: '1.5rem', fontWeight: 800 }}>
                                {winnings > 0 ? formatIndianNumber(winnings, true) : 'No Win'}
                            </div>
                            <div style={{ color: '#fff', fontSize: '0.9rem' }}>{resultRank}</div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

interface GemCardProps {
    gem: Gem;
    index: number;
    revealing: boolean;
    isResult: boolean;
}

const GemCard: React.FC<GemCardProps> = ({ gem, index, revealing, isResult }) => {
    return (
        <motion.div
            initial={{ rotateY: 0, scale: 1 }}
            animate={{
                rotateY: revealing ? [0, 90, 0] : 0,
                scale: isResult ? 1.06 : 1,
                y: isResult ? -2 : 0
            }}
            transition={{ delay: index * 0.08, duration: 0.45 }}
            style={{
                width: 'clamp(58px, 12vw, 86px)',
                height: 'clamp(58px, 12vw, 86px)',
                background: 'linear-gradient(180deg, #314b66, #263b53)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 14px rgba(0,0,0,0.32)',
                border: '1px solid rgba(255,255,255,0.12)'
            }}
        >
            <div style={{ fontSize: 'clamp(1.8rem, 5.5vw, 3rem)', color: gem.color, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>
                <gem.icon />
            </div>
        </motion.div>
    );
};
