import React, { useState, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIndianNumber } from '../../utils/format';
import { playBet, playWin, playLoss } from '../../utils/sound';

// Roulette Numbers in Wheel Order (standard European)
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

const getColor = (num: number) => {
    if (num === 0) return '#00e701'; // Green
    const redNums = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNums.includes(num) ? '#ea3e3e' : '#2f4553'; // Red or Black (Dark Blue/Grey)
};

interface Bet {
    type: 'NUMBER' | 'COLOR' | 'PARITY' | 'RANGE';
    value: number | string;
    amount: number;
}

export const RouletteGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    // State
    const [gameState, setGameState] = useState<'IDLE' | 'SPINNING' | 'RESULT'>('IDLE');
    const [bets, setBets] = useState<Bet[]>([]);
    const [currentBetAmount, setCurrentBetAmount] = useState(10);
    const [resultNumber, setResultNumber] = useState<number | null>(null);
    const [winnings, setWinnings] = useState(0);

    // Animation Refs
    const wheelRef = useRef<HTMLDivElement>(null);

    const handlePlaceBet = (type: Bet['type'], value: number | string) => {
        if (gameState !== 'IDLE') return;

        // Add or increment bet
        setBets(prev => {
            const existing = prev.find(b => b.type === type && b.value === value);
            if (existing) {
                return prev.map(b => b === existing ? { ...b, amount: b.amount + currentBetAmount } : b);
            }
            return [...prev, { type, value, amount: currentBetAmount }];
        });
    };

    const clearBets = () => {
        if (gameState === 'IDLE') setBets([]);
    };

    const spinWheel = () => {
        const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
        if (totalBet === 0) return alert("Place a bet first!");

        if (!placeBet(totalBet)) {
            return alert("Insufficient funds");
        }

        playBet();
        setGameState('SPINNING');
        setResultNumber(null);
        setWinnings(0);

        // Determine result (SERVER SIDE LOGIC SIMULATION)
        const outcomeIndex = Math.floor(Math.random() * 37); // 0-36
        const outcomeNumber = WHEEL_NUMBERS[outcomeIndex];

        // Calculate Rotation
        // Base spins (e.g., 5 full rotations) + arc to target
        // Each slice is 360 / 37 deg
        const sliceDeg = 360 / 37;

        // Let's say 0 is at top. To land on Index I, we rotate such that I is at top.
        // Actually, easiest visual hack:
        // Rotate random amount (huge) + specific remainder.

        const extraSpins = 5;
        const randomOffset = Math.random() * (sliceDeg * 0.8) - (sliceDeg * 0.4); // Jitter
        // To get specific number under the marker (assuming marker is top center):
        // If wheel rotates Clockwise, numbers move Counter-Clockwise relative to top.
        // Target Angle = -(Index * SliceDeg)

        const finalAngle = 360 * extraSpins + (360 - (outcomeIndex * sliceDeg)) + randomOffset;

        // Animate
        if (wheelRef.current) {
            wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.1, 0, 0.2, 1)';
            wheelRef.current.style.transform = `rotate(${finalAngle}deg)`;
        }

        setTimeout(() => {
            setResultNumber(outcomeNumber);
            handleGameEnd(outcomeNumber);
        }, 4000);
    };

    const handleGameEnd = (number: number) => {
        let totalWin = 0;
        const color = getColor(number);
        const isEven = number !== 0 && number % 2 === 0;
        const isRed = color === '#ea3e3e';

        bets.forEach(bet => {
            let win = false;
            let multiplier = 0;

            if (bet.type === 'NUMBER' && bet.value === number) {
                win = true;
                multiplier = 36;
            } else if (bet.type === 'COLOR') {
                if (bet.value === 'RED' && isRed) { win = true; multiplier = 2; }
                if (bet.value === 'BLACK' && !isRed && number !== 0) { win = true; multiplier = 2; }
            } else if (bet.type === 'PARITY') {
                if (bet.value === 'EVEN' && isEven) { win = true; multiplier = 2; }
                if (bet.value === 'ODD' && !isEven && number !== 0) { win = true; multiplier = 2; }
            }
            // Add range bets later

            if (win) {
                totalWin += bet.amount * multiplier;
            }
        });

        if (totalWin > 0) {
            collectWinnings(totalWin);
            setWinnings(totalWin);
            playWin();
        } else {
            playLoss();
        }

        setGameState('RESULT');

        // Reset wheel rotation for next spin (remove transition to snap back or handle cumulative?)
        // Cumulative is better visually. We just keep adding to state if we tracked it, 
        // but simple style override works if we don't care about "unwinding" visually.
        // Actually, for React, simpler to just start from 0 if we reset 'IDLE' after a delay?
        // Let's leave it rotated.
    };

    const resetGame = () => {
        setGameState('IDLE');
        // Clean up bits if needed
        if (wheelRef.current) {
            wheelRef.current.style.transition = 'none';
            wheelRef.current.style.transform = 'rotate(0deg)';
        }
    };


    return (
        <div className="game-shell game-layout-two game-theme-roulette">

            {/* Sidebar Controls */}
            <div className="stake-card game-panel">
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3', marginBottom: '8px', display: 'block' }}>Chip Value</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[10, 50, 100, 500, 1000].map(val => (
                            <button
                                key={val}
                                onClick={() => setCurrentBetAmount(val)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '50%', width: '40px', height: '40px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: currentBetAmount === val ? '#fff' : '#2f4553',
                                    color: currentBetAmount === val ? '#000' : '#fff',
                                    border: '2px solid',
                                    borderColor: currentBetAmount === val ? '#00e701' : 'transparent',
                                    fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer'
                                }}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3', marginBottom: '4px' }}>
                        <span>Total Bet</span>
                        <span>₹{formatIndianNumber(bets.reduce((a, b) => a + b.amount, 0))}</span>
                    </div>
                </div>

                {gameState === 'IDLE' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" onClick={clearBets} style={{ flex: 1 }}>Clear</button>
                        <button className="btn-primary" onClick={spinWheel} style={{ flex: 2, background: '#00e701', color: '#011e01' }}>Spin</button>
                    </div>
                ) : gameState === 'RESULT' ? (
                    <button className="btn-primary" onClick={resetGame} style={{ width: '100%' }}>Play Again</button>
                ) : (
                    <button className="btn-primary" disabled style={{ width: '100%', opacity: 0.5 }}>Spinning...</button>
                )}
            </div>

            {/* Game Board & Wheel */}
            <div className="game-container game-stage" style={{
                position: 'relative',
                background: '#0f212e',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                padding: '24px', gap: '40px'
            }}>

                {/* Result Overlay used to be here, moved relative to wheel or board? global overlay better */}
                <AnimatePresence>
                    {gameState === 'RESULT' && (
                        <motion.div
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -50, opacity: 0 }}
                            style={{
                                position: 'absolute', top: '20px', zIndex: 20,
                                background: 'rgba(21, 32, 43, 0.95)', padding: '16px 32px', borderRadius: '50px',
                                border: `2px solid ${winnings > 0 ? '#00e701' : '#b1bad3'}`,
                                display: 'flex', alignItems: 'center', gap: '16px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                            }}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: getColor(resultNumber!),
                                color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {resultNumber}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', color: '#b1bad3', textTransform: 'uppercase' }}>Result</span>
                                <span style={{ fontSize: '1.2rem', color: 'white', fontWeight: 'bold' }}>
                                    {winnings > 0 ? `YOU WON ₹${formatIndianNumber(winnings)}` : 'TRY AGAIN'}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* Wheel */}
                <div style={{ position: 'relative', width: 'min(82vw, 300px)', height: 'min(82vw, 300px)' }}>
                    {/* Marker */}
                    <div style={{
                        position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 10, width: '0', height: '0',
                        borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '20px solid #fff'
                    }}></div>

                    {/* Rotating Part */}
                    <div ref={wheelRef} style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        border: '10px solid #2f4553', position: 'relative',
                        background: '#1a2c38', overflow: 'hidden',
                        boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                    }}>
                        {WHEEL_NUMBERS.map((num, i) => {
                            const angle = (360 / 37) * i;
                            const color = getColor(num);
                            return (
                                <div key={num} style={{
                                    position: 'absolute', top: '0', left: '50%', width: '2px', height: '50%',
                                    transformOrigin: 'bottom center', transform: `translateX(-50%) rotate(${angle}deg)`,
                                    display: 'flex', justifyContent: 'center', paddingTop: '10px'
                                }}>
                                    <span style={{
                                        position: 'absolute', top: '10px', transform: 'rotate(0deg)', // text orientation 
                                        color: '#fff', fontSize: '10px', fontWeight: 'bold',
                                        background: color, width: '24px', height: '24px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {num}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Betting Board */}
                <div style={{ width: '100%', maxWidth: '800px', marginTop: '20px', overflowX: 'auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '50px repeat(12, 1fr)',
                    gap: '4px',
                    minWidth: '680px'
                }}>
                    {/* Zero */}
                    <button
                        onClick={() => handlePlaceBet('NUMBER', 0)}
                        style={{
                            gridRow: '1 / span 3',
                            background: '#00e701',
                            border: 'none', borderRadius: '4px',
                            cursor: 'pointer', color: 'white', fontWeight: 'bold',
                            position: 'relative' // for chips
                        }}
                    >
                        0
                        {bets.find(b => b.type === 'NUMBER' && b.value === 0) && (
                            <div className="chip">{bets.find(b => b.type === 'NUMBER' && b.value === 0)?.amount}</div>
                        )}
                    </button>

                    {/* Numbers 1-36 */}


                    {/* Correct Grid Layout generation */}
                    {/* Row 3 (3, 6, 9...) */}
                    {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(num => (
                        <NumberBtn key={num} num={num} onClick={() => handlePlaceBet('NUMBER', num)} bets={bets} />
                    ))}
                    {/* Row 2 (2, 5, 8...) */}
                    <div style={{ gridColumn: '1', gridRow: '2' }}></div> {/* Spacer if needed? No, 0 spans. */}
                    {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map(num => (
                        <NumberBtn key={num} num={num} onClick={() => handlePlaceBet('NUMBER', num)} bets={bets} />
                    ))}
                    {/* Row 1 (1, 4, 7...) */}
                    <div style={{ gridColumn: '1', gridRow: '3' }}></div>
                    {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map(num => (
                        <NumberBtn key={num} num={num} onClick={() => handlePlaceBet('NUMBER', num)} bets={bets} />
                    ))}

                    {/* Meta Bets Row */}
                    <div style={{ gridColumn: '2 / span 4', marginTop: '8px' }}>
                        <MetaBtn label="1st 12" onClick={() => { }} />
                    </div>
                    <div style={{ gridColumn: '6 / span 4', marginTop: '8px' }}>
                        <MetaBtn label="2nd 12" onClick={() => { }} />
                    </div>
                    <div style={{ gridColumn: '10 / span 4', marginTop: '8px' }}>
                        <MetaBtn label="3rd 12" onClick={() => { }} />
                    </div>

                    <div style={{ gridColumn: '2 / span 2', marginTop: '8px' }}>
                        <MetaBtn label="1-18" onClick={() => { }} />
                    </div>
                    <div style={{ gridColumn: '4 / span 2', marginTop: '8px' }}>
                        <MetaBtn label="EVEN" onClick={() => handlePlaceBet('PARITY', 'EVEN')} bets={bets} type="PARITY" val="EVEN" />
                    </div>
                    <div style={{ gridColumn: '6 / span 2', marginTop: '8px' }}>
                        <MetaBtn label="RED" color="#ea3e3e" onClick={() => handlePlaceBet('COLOR', 'RED')} bets={bets} type="COLOR" val="RED" />
                    </div>
                    <div style={{ gridColumn: '8 / span 2', marginTop: '8px' }}>
                        <MetaBtn label="BLACK" color="#2f4553" onClick={() => handlePlaceBet('COLOR', 'BLACK')} bets={bets} type="COLOR" val="BLACK" />
                    </div>
                    <div style={{ gridColumn: '10 / span 2', marginTop: '8px' }}>
                        <MetaBtn label="ODD" onClick={() => handlePlaceBet('PARITY', 'ODD')} bets={bets} type="PARITY" val="ODD" />
                    </div>
                    <div style={{ gridColumn: '12 / span 2', marginTop: '8px' }}>
                        <MetaBtn label="19-36" onClick={() => { }} />
                    </div>

                </div>
                </div>

            </div>

            <style>{`
                .chip {
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 24px; height: 24px;
                    border-radius: 50%;
                    background: #fff;
                    color: #000;
                    border: 2px solid #00e701;
                    font-size: 0.7rem;
                    display: flex; alignItems: center; justifyContent: center;
                    font-weight: bold;
                    pointer-events: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
            `}</style>
        </div>
    );
};

// Helper Components
const NumberBtn = ({ num, onClick, bets }: any) => {
    const color = getColor(num);
    const bet = bets.find((b: Bet) => b.type === 'NUMBER' && b.value === num);
    return (
        <button
            onClick={onClick}
            style={{
                height: '40px',
                background: color,
                color: 'white',
                border: 'none', borderRadius: '4px',
                cursor: 'pointer', fontWeight: 'bold',
                position: 'relative',
                transition: 'filter 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.2)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
        >
            {num}
            {bet && <div className="chip">{bet.amount}</div>}
        </button>
    );
};

const MetaBtn = ({ label, color = 'transparent', onClick, bets, type, val }: any) => {
    const bet = type ? bets.find((b: Bet) => b.type === type && b.value === val) : null;
    return (
        <button
            onClick={onClick}
            style={{
                width: '100%', height: '40px',
                background: color,
                border: '1px solid #2f4553',
                color: 'white', borderRadius: '4px',
                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem',
                position: 'relative'
            }}
        >
            {label}
            {bet && <div className="chip">{bet.amount}</div>}
        </button>
    );
};
