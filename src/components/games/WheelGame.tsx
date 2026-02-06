import React, { useState, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIndianNumber } from '../../utils/format';
import { playBet, playWin, playLoss } from '../../utils/sound';

// Wheel Segments
const SEGMENTS = [
    { multiplier: 0, color: '#2f4553', probability: 0.5 }, // Loss
    { multiplier: 1.5, color: '#3b82f6', probability: 0.3 },
    { multiplier: 3.0, color: '#00e701', probability: 0.1 },
    { multiplier: 5.0, color: '#ea3e3e', probability: 0.05 }, // Rare
];

// Wheel Slices Implementation for House Edge
// 0 (Loss): 13 slices
// 1.5x: 8 slices
// 3.0x: 3 slices
// Total 24. EV = (1.5*8 + 3*3)/24 = 21/24 = 0.875 (12.5% Edge)
const WHEEL_SLICES = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 13 Loss
    1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, // 8 x 1.5
    3.0, 3.0, 3.0 // 3 x 3.0
];

const getColor = (multiplier: number) => {
    return SEGMENTS.find(s => s.multiplier === multiplier)?.color || '#2f4553';
}

export const WheelGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [gameState, setGameState] = useState<'IDLE' | 'SPINNING' | 'RESULT'>('IDLE');
    const [selectedMultiplier, setSelectedMultiplier] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState(10);
    const [resultMultiplier, setResultMultiplier] = useState<number | null>(null);
    const [winnings, setWinnings] = useState(0);

    const wheelRef = useRef<HTMLDivElement>(null);

    const spin = () => {
        if (!selectedMultiplier) return alert("Select a multiplier to bet on!");
        if (!placeBet(betAmount)) return alert("Insufficient funds");

        playBet();
        setGameState('SPINNING');
        setResultMultiplier(null);
        setWinnings(0);

        // Determine result based on random index of WHEEL_SLICES
        const resultIndex = Math.floor(Math.random() * WHEEL_SLICES.length);
        const outcomeMultiplier = WHEEL_SLICES[resultIndex];

        // Animate
        const sliceDeg = 360 / WHEEL_SLICES.length;
        const extraSpins = 5;
        // Aligns the result segment to the top (marker)
        const randomOffset = (Math.random() - 0.5) * (sliceDeg * 0.8);
        const finalAngle = 360 * extraSpins + (360 - (resultIndex * sliceDeg)) + randomOffset;

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

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3', marginBottom: '8px', display: 'block' }}>Select Target</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {SEGMENTS.map(s => (
                            <button
                                key={s.multiplier}
                                onClick={() => setSelectedMultiplier(s.multiplier)}
                                disabled={gameState !== 'IDLE'}
                                style={{
                                    padding: '12px',
                                    background: selectedMultiplier === s.multiplier ? s.color : '#0f212e',
                                    border: `2px solid ${selectedMultiplier === s.multiplier ? '#fff' : s.color}`,
                                    color: selectedMultiplier === s.multiplier ? '#000' : '#fff',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: gameState === 'IDLE' ? 'pointer' : 'not-allowed',
                                    opacity: gameState !== 'IDLE' && selectedMultiplier !== s.multiplier ? 0.5 : 1
                                }}
                            >
                                {s.multiplier}x
                            </button>
                        ))}
                    </div>
                </div>

                {gameState === 'IDLE' ? (
                    <button className="btn-primary" onClick={spin} disabled={!selectedMultiplier} style={{ width: '100%', background: '#00e701', color: '#011e01' }}>Spin</button>
                ) : gameState === 'RESULT' ? (
                    <button className="btn-primary" onClick={resetGame} style={{ width: '100%' }}>Play Again</button>
                ) : (
                    <button className="btn-primary" disabled style={{ width: '100%', opacity: 0.5 }}>Spinning...</button>
                )}
            </div>

            {/* Game Area */}
            <div className="game-container" style={{
                position: 'relative',
                background: '#0f212e',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '40px', overflow: 'hidden'
            }}>

                {/* Result Overlay */}
                <AnimatePresence>
                    {gameState === 'RESULT' && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute', zIndex: 20,
                                background: 'rgba(15, 33, 46, 0.95)',
                                padding: '24px 48px', borderRadius: '16px',
                                border: `2px solid ${winnings > 0 ? '#00e701' : '#ea3e3e'}`,
                                textAlign: 'center',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                            }}
                        >
                            <div style={{ fontSize: '1rem', color: '#b1bad3' }}>Result</div>
                            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: getColor(resultMultiplier!) }}>
                                {resultMultiplier}x
                            </div>
                            {winnings > 0 ? (
                                <div style={{ color: '#00e701', marginTop: '8px', fontSize: '1.2rem' }}>
                                    Win: +{formatIndianNumber(winnings, true)}
                                </div>
                            ) : (
                                <div style={{ color: '#ea3e3e', marginTop: '8px', fontSize: '1.2rem' }}>
                                    Try Again
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Wheel */}
                <div style={{ position: 'relative', width: '400px', height: '400px' }}>
                    {/* Marker */}
                    <div style={{
                        position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 10, width: '0', height: '0',
                        borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderTop: '25px solid #fff',
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))'
                    }}></div>

                    <div ref={wheelRef} style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        position: 'relative', overflow: 'hidden',
                        border: '10px solid #2f4553',
                        boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                    }}>
                        {WHEEL_SLICES.map((val, i) => {
                            const angle = (360 / WHEEL_SLICES.length) * i;
                            const color = getColor(val);
                            return (
                                <div key={i} style={{
                                    position: 'absolute', top: '0', left: '50%', width: '2px', height: '50%',
                                    transformOrigin: 'bottom center', transform: `translateX(-50%) rotate(${angle}deg)`,
                                    display: 'flex', justifyContent: 'center', paddingTop: '10px'
                                }}>
                                    {/* Slice Shape (simulated with border or clip-path? simple text placement for now) */}
                                    {/* Using a conic gradient background on the main wheel is better for slices, but lines + text works for simple */}
                                    <div style={{
                                        position: 'absolute', top: '0', left: '-20px', width: '40px', height: '200px',
                                        transformOrigin: 'bottom center',
                                        clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                                        background: color, // This doesn't quite work for geometry math without precise angles
                                        display: 'none' // Simpler visual:
                                    }}></div>

                                    <span style={{
                                        position: 'absolute', top: '20px',
                                        color: '#fff', fontWeight: 'bold', fontSize: '14px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                        background: color,
                                        padding: '4px 8px', borderRadius: '4px',
                                        transform: 'rotate(0deg)' // Keep text readable or rotate with wheel?
                                    }}>
                                        {val}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Center Cap */}
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: '#2f4553', border: '4px solid #1a2c38', zIndex: 5
                        }}></div>
                    </div>
                </div>

            </div>
        </div>
    );
};
