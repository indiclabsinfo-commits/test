import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDice } from 'react-icons/fa';
import soundManager from '../../utils/soundManager';

export const DiceGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [betAmount, setBetAmount] = useState(10);
    const [prediction, setPrediction] = useState(50);
    const [rollType, setRollType] = useState<'OVER' | 'UNDER'>('OVER');
    const [lastRoll, setLastRoll] = useState<number | null>(null);
    const [isRolling, setIsRolling] = useState(false);

    const winChance = rollType === 'OVER' ? (100 - prediction) : prediction;
    const multiplier = (98 / winChance).toFixed(4);

    const handleRoll = () => {
        if (!placeBet(betAmount)) {
            soundManager.loss();
            alert("Insufficient funds!");
            return;
        }

        soundManager.bet();
        setIsRolling(true);
        setLastRoll(null);

        soundManager.diceShake();

        setTimeout(() => {
            const roll = Math.random() * 100;
            setLastRoll(roll);
            setIsRolling(false);

            const win = rollType === 'OVER' ? roll > prediction : roll < prediction;

            if (win) {
                soundManager.win();
                collectWinnings(betAmount * parseFloat(multiplier));
            } else {
                soundManager.loss();
            }
        }, 500);
    };

    const isWin = lastRoll !== null && ((rollType === 'OVER' && lastRoll > prediction) || (rollType === 'UNDER' && lastRoll < prediction));

    return (
        <div className="game-shell game-layout-two game-theme-dice">

            {/* Sidebar */}
            <div className="stake-card game-panel">
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3', marginBottom: '8px', display: 'block' }}>Bet Amount</label>
                    <div className="input-group" style={{ padding: '8px 12px', background: '#0f212e', border: '1px solid #2f4553' }}>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
                            disabled={isRolling}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '1rem', outline: 'none' }}
                        />
                        <span style={{ color: '#b1bad3' }}>₹</span>
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.9rem', color: '#b1bad3' }}>Prediction</label>
                        <span style={{ color: 'white', fontWeight: 'bold' }}>{rollType} {prediction}</span>
                    </div>

                    <div style={{ background: '#0f212e', padding: '16px', borderRadius: '8px', border: '1px solid #2f4553' }}>
                        <input
                            type="range"
                            min="2" max="98"
                            value={prediction}
                            onChange={(e) => setPrediction(parseInt(e.target.value))}
                            disabled={isRolling}
                            style={{ width: '100%', accentColor: '#00e701', cursor: 'pointer' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <button
                        onClick={() => setRollType('OVER')}
                        style={{ flex: 1, padding: '12px', background: rollType === 'OVER' ? '#2f4553' : '#0f212e', color: 'white', border: '1px solid #2f4553', borderRadius: '8px' }}
                    >
                        Roll Over
                    </button>
                    <button
                        onClick={() => setRollType('UNDER')}
                        style={{ flex: 1, padding: '12px', background: rollType === 'UNDER' ? '#2f4553' : '#0f212e', color: 'white', border: '1px solid #2f4553', borderRadius: '8px' }}
                    >
                        Roll Under
                    </button>
                </div>

                <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '16px', fontSize: '1.2rem', boxShadow: '0 4px 12px rgba(0, 231, 1, 0.2)' }}
                    onClick={handleRoll}
                    disabled={isRolling}
                >
                    {isRolling ? 'Rolling...' : 'Roll Dice'}
                </button>

                <div style={{ marginTop: '24px', background: '#0f212e', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#b1bad3' }}>
                        <span>Multiplier</span>
                        <span style={{ color: '#fff' }}>{multiplier}x</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#b1bad3' }}>
                        <span>Win Chance</span>
                        <span style={{ color: '#fff' }}>{winChance.toFixed(2)}%</span>
                    </div>
                </div>
            </div>

            {/* Game Area */}
            <div className="game-container game-stage" style={{
                position: 'relative',
                background: 'radial-gradient(circle at center, #1a2c38 0%, #0f212e 100%)',
                borderColor: '#2f4553',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>

                {/* Result Display */}
                <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AnimatePresence mode='wait'>
                        {lastRoll !== null && (
                            <motion.div
                                key={lastRoll} // Re-render on new roll
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                style={{
                                    background: isWin ? 'rgba(0, 231, 1, 0.1)' : 'rgba(234, 62, 62, 0.1)',
                                    padding: '24px 48px',
                                    borderRadius: '16px',
                                    border: `1px solid ${isWin ? '#00e701' : '#ea3e3e'}`,
                                    textAlign: 'center'
                                }}
                            >
                                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: isWin ? '#00e701' : '#ea3e3e' }}>
                                    {lastRoll.toFixed(2)}
                                </div>
                                <div style={{ color: '#b1bad3', marginTop: '8px' }}>
                                    {isWin ? 'You Won!' : 'Better luck next time'}
                                </div>
                            </motion.div>
                        )}
                        {lastRoll === null && !isRolling && (
                            <div style={{ opacity: 0.5, textAlign: 'center' }}>
                                <FaDice size={64} style={{ marginBottom: '16px' }} />
                                <h3>Ready to Roll</h3>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Slider Render */}
                <div style={{
                    position: 'relative', width: 'min(92%, 820px)', height: '80px', background: '#0f212e', borderRadius: '40px', margin: 'clamp(22px, 6vw, 60px) 0',
                    display: 'flex', alignItems: 'center', padding: '0 10px',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                }}>
                    {/* Win Zone Indicator */}
                    <div style={{
                        position: 'absolute', left: 0, height: '100%', borderRadius: '40px',
                        width: `${prediction}%`,
                        background: rollType === 'UNDER' ? 'linear-gradient(90deg, #00e701 0%, #00b301 100%)' : '#2f4553',
                        opacity: rollType === 'UNDER' ? 0.3 : 1,
                        transition: 'width 0.3s ease',
                        borderRight: '2px solid rgba(255,255,255,0.1)'
                    }}></div>
                    <div style={{
                        position: 'absolute', right: 0, height: '100%', borderRadius: '40px',
                        width: `${100 - prediction}%`,
                        background: rollType === 'OVER' ? 'linear-gradient(90deg, #00e701 0%, #00b301 100%)' : '#2f4553',
                        opacity: rollType === 'OVER' ? 0.3 : 1,
                        transition: 'width 0.3s ease',
                        borderLeft: '2px solid rgba(255,255,255,0.1)'
                    }}></div>

                    {/* Slider Knob / Prediction Line */}
                    <motion.div
                        animate={{ left: `${prediction}%` }}
                        style={{
                            position: 'absolute', width: '4px', height: '100%', background: 'white',
                            transform: 'translateX(-50%)', zIndex: 10,
                            boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                        }}
                    >
                        <div style={{
                            position: 'absolute', top: '-40px', left: '-50%', transform: 'translateX(-20%)',
                            color: 'white', background: '#213743', padding: '4px 8px', borderRadius: '4px', border: '1px solid #2f4553'
                        }}>
                            {prediction}
                        </div>
                    </motion.div>

                    {/* Result Puck Animation */}
                    <AnimatePresence>
                        {lastRoll !== null && (
                            <motion.div
                                initial={{ left: '0%', rotate: 0, opacity: 0 }}
                                animate={{ left: `${lastRoll}%`, rotate: 360 * 3, opacity: 1 }}
                                transition={{ type: 'spring', damping: 15, stiffness: 100, duration: 0.8 }}
                                style={{
                                    position: 'absolute',
                                    width: '50px', height: '50px', borderRadius: '12px', // Square with rounded corners for die
                                    background: 'white', border: '2px solid #0f212e',
                                    transform: 'translateX(-50%)', zIndex: 20,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', color: '#0f212e',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}
                            >
                                <FaDice size={32} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
