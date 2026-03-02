import React, { useMemo, useRef, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIndianNumber } from '../../utils/format';
import { playBet, playWin, playLoss } from '../../utils/sound';

const SEGMENTS = [
    { multiplier: 0, color: '#34495e' },
    { multiplier: 1.5, color: '#4f8cff' },
    { multiplier: 3.0, color: '#67e15b' },
    { multiplier: 5.0, color: '#ff6a52' }
];

// 24 slices: 0x(14), 1.5x(7), 3x(2), 5x(1)
const WHEEL_SLICES = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
    3, 3,
    5
];

const getColor = (multiplier: number) => {
    return SEGMENTS.find(s => s.multiplier === multiplier)?.color || '#2f4553';
};

export const WheelGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [gameState, setGameState] = useState<'IDLE' | 'SPINNING' | 'RESULT'>('IDLE');
    const [selectedMultiplier, setSelectedMultiplier] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState(10);
    const [resultMultiplier, setResultMultiplier] = useState<number | null>(null);
    const [winnings, setWinnings] = useState(0);
    const [recent, setRecent] = useState<number[]>([]);

    const wheelRef = useRef<HTMLDivElement>(null);
    const sliceDeg = 360 / WHEEL_SLICES.length;

    const wheelGradient = useMemo(() => {
        return `conic-gradient(${WHEEL_SLICES
            .map((val, i) => `${getColor(val)} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`)
            .join(',')})`;
    }, [sliceDeg]);

    const selectableTargets = SEGMENTS.filter(s => s.multiplier > 0);

    const counts = useMemo(() => {
        const total = WHEEL_SLICES.length;
        return {
            p15: (WHEEL_SLICES.filter(x => x === 1.5).length / total) * 100,
            p3: (WHEEL_SLICES.filter(x => x === 3).length / total) * 100,
            p5: (WHEEL_SLICES.filter(x => x === 5).length / total) * 100
        };
    }, []);

    const spin = () => {
        if (!selectedMultiplier) return alert('Select a multiplier to bet on!');
        if (!placeBet(betAmount)) return alert('Insufficient funds');

        playBet();
        setGameState('SPINNING');
        setResultMultiplier(null);
        setWinnings(0);

        const resultIndex = Math.floor(Math.random() * WHEEL_SLICES.length);
        const outcomeMultiplier = WHEEL_SLICES[resultIndex];

        const extraSpins = 5;
        const sliceCenterAngle = (resultIndex * sliceDeg) + (sliceDeg / 2);
        const randomOffset = (Math.random() - 0.5) * (sliceDeg * 0.6);
        const finalAngle = (360 * extraSpins) - sliceCenterAngle + randomOffset;

        if (wheelRef.current) {
            wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.1, 0, 0.2, 1)';
            wheelRef.current.style.transform = `rotate(${finalAngle}deg)`;
        }

        setTimeout(() => {
            handleGameEnd(outcomeMultiplier);
        }, 4000);
    };

    const handleGameEnd = (outcome: number) => {
        let winAmount = 0;
        if (selectedMultiplier === outcome) {
            winAmount = betAmount * outcome;
            collectWinnings(winAmount);
            playWin();
        } else {
            playLoss();
        }

        setRecent(prev => [outcome, ...prev].slice(0, 12));
        setResultMultiplier(outcome);
        setWinnings(winAmount);
        setGameState('RESULT');
    };

    const resetGame = () => {
        setGameState('IDLE');
        if (wheelRef.current) {
            wheelRef.current.style.transition = 'none';
            wheelRef.current.style.transform = 'rotate(0deg)';
        }
    };

    return (
        <div className="game-shell game-layout-two game-theme-wheel">
            <div className="stake-card game-panel">
                <div style={{ marginBottom: '14px' }}>
                    <div className="game-section-title">Bet Amount</div>
                    <div className="bet-input-row">
                        <input
                            type="number"
                            value={betAmount}
                            min={1}
                            onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value) || 0))}
                            disabled={gameState === 'SPINNING'}
                        />
                        <span style={{ color: '#b1bad3' }}>₹</span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                    {[10, 50, 100].map(v => (
                        <button key={v} className="btn-quick" onClick={() => setBetAmount(v)} disabled={gameState === 'SPINNING'}>
                            {v}
                        </button>
                    ))}
                </div>

                <div style={{ marginBottom: '14px' }}>
                    <div className="game-section-title">Select Target</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {selectableTargets.map(s => (
                            <button
                                key={s.multiplier}
                                onClick={() => setSelectedMultiplier(s.multiplier)}
                                disabled={gameState !== 'IDLE'}
                                style={{
                                    padding: '12px',
                                    background: selectedMultiplier === s.multiplier ? s.color : '#0f212e',
                                    border: `2px solid ${selectedMultiplier === s.multiplier ? '#fff' : s.color}`,
                                    color: selectedMultiplier === s.multiplier ? '#061423' : '#fff',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    opacity: gameState !== 'IDLE' && selectedMultiplier !== s.multiplier ? 0.55 : 1
                                }}
                            >
                                {s.multiplier}x
                            </button>
                        ))}
                    </div>
                </div>

                <div className="game-stat-block" style={{ marginBottom: '12px' }}>
                    <div style={{ color: '#b1bad3', fontSize: '0.83rem' }}>Approx. hit rates</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', marginTop: '6px' }}>
                        <span>1.5x: {counts.p15.toFixed(1)}%</span>
                        <span>3x: {counts.p3.toFixed(1)}%</span>
                        <span>5x: {counts.p5.toFixed(1)}%</span>
                    </div>
                </div>

                {gameState === 'IDLE' ? (
                    <button className="btn-primary" onClick={spin} disabled={!selectedMultiplier} style={{ width: '100%' }}>
                        Spin
                    </button>
                ) : gameState === 'RESULT' ? (
                    <button className="btn-primary" onClick={resetGame} style={{ width: '100%' }}>Play Again</button>
                ) : (
                    <button className="btn-primary" disabled style={{ width: '100%', opacity: 0.55 }}>Spinning...</button>
                )}

                <div style={{ marginTop: '12px' }}>
                    <div className="game-section-title">Recent</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {recent.length === 0 && <span style={{ color: '#6d8094', fontSize: '0.8rem' }}>No rounds yet</span>}
                        {recent.map((value, i) => (
                            <span
                                key={`${value}_${i}`}
                                style={{
                                    background: getColor(value),
                                    color: '#061423',
                                    padding: '3px 7px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800
                                }}
                            >
                                {value}x
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="game-container game-stage" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px', overflow: 'hidden' }}>
                <AnimatePresence>
                    {gameState === 'RESULT' && (
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute',
                                zIndex: 20,
                                background: 'rgba(15, 33, 46, 0.95)',
                                padding: '22px 40px',
                                borderRadius: '16px',
                                border: `2px solid ${winnings > 0 ? '#00e701' : '#ea3e3e'}`,
                                textAlign: 'center',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                            }}
                        >
                            <div style={{ fontSize: '0.95rem', color: '#b1bad3' }}>Result</div>
                            <div style={{ fontSize: '2.8rem', fontWeight: 900, color: getColor(resultMultiplier || 0) }}>
                                {resultMultiplier}x
                            </div>
                            {winnings > 0 ? (
                                <div style={{ color: '#00e701', marginTop: '8px', fontSize: '1.1rem' }}>
                                    Win: +{formatIndianNumber(winnings, true)}
                                </div>
                            ) : (
                                <div style={{ color: '#ea3e3e', marginTop: '8px', fontSize: '1.1rem' }}>
                                    Missed this round
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{ position: 'relative', width: 'min(86vw, 420px)', height: 'min(86vw, 420px)' }}>
                    <div style={{
                        position: 'absolute',
                        top: '-16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        width: 0,
                        height: 0,
                        borderLeft: '14px solid transparent',
                        borderRight: '14px solid transparent',
                        borderTop: '24px solid #fff',
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))'
                    }} />

                    <div
                        ref={wheelRef}
                        style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '10px solid #2f4553',
                            boxShadow: '0 0 50px rgba(0,0,0,0.5), inset 0 0 50px rgba(255,255,255,0.04)',
                            background: wheelGradient
                        }}
                    >
                        {WHEEL_SLICES.map((val, i) => {
                            const angle = (sliceDeg * i) + (sliceDeg / 2);
                            const radius = 42;
                            const rad = ((angle - 90) * Math.PI) / 180;
                            const x = 50 + (radius * Math.cos(rad));
                            const y = 50 + (radius * Math.sin(rad));
                            return (
                                <div
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        top: `${y}%`,
                                        left: `${x}%`,
                                        transform: 'translate(-50%, -50%)',
                                        minWidth: '20px',
                                        textAlign: 'center',
                                        fontSize: '0.66rem',
                                        fontWeight: 900,
                                        color: '#fff',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                                        background: 'rgba(9,18,30,0.36)',
                                        border: `1px solid ${getColor(val)}`,
                                        borderRadius: '999px',
                                        padding: '2px 5px'
                                    }}
                                >
                                    {val === 0 ? '0' : `${val}`}
                                </div>
                            );
                        })}

                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '54px',
                            height: '54px',
                            borderRadius: '50%',
                            background: '#1f3348',
                            border: '6px solid #3a5168',
                            zIndex: 5,
                            boxShadow: 'inset 0 0 12px rgba(255,255,255,0.15)'
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );
};
