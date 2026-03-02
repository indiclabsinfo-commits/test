import React, { useMemo, useRef, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIndianNumber } from '../../utils/format';
import { playBet, playWin, playLoss } from '../../utils/sound';

const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

const getColor = (num: number) => {
    if (num === 0) return '#00e701';
    const redNums = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNums.includes(num) ? '#ea3e3e' : '#2f4553';
};

interface Bet {
    type: 'NUMBER' | 'COLOR' | 'PARITY' | 'RANGE';
    value: number | string;
    amount: number;
}

export const RouletteGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    const [gameState, setGameState] = useState<'IDLE' | 'SPINNING' | 'RESULT'>('IDLE');
    const [bets, setBets] = useState<Bet[]>([]);
    const [currentBetAmount, setCurrentBetAmount] = useState(10);
    const [resultNumber, setResultNumber] = useState<number | null>(null);
    const [winnings, setWinnings] = useState(0);
    const [recent, setRecent] = useState<number[]>([]);

    const wheelRef = useRef<HTMLDivElement>(null);

    const totalBet = useMemo(() => bets.reduce((sum, b) => sum + b.amount, 0), [bets]);

    const handlePlaceBet = (type: Bet['type'], value: number | string) => {
        if (gameState !== 'IDLE') return;

        setBets(prev => {
            const existing = prev.find(b => b.type === type && b.value === value);
            if (existing) {
                return prev.map(b => (b === existing ? { ...b, amount: b.amount + currentBetAmount } : b));
            }
            return [...prev, { type, value, amount: currentBetAmount }];
        });
    };

    const clearBets = () => {
        if (gameState === 'IDLE') setBets([]);
    };

    const spinWheel = () => {
        if (totalBet === 0) return alert('Place a bet first!');
        if (!placeBet(totalBet)) return alert('Insufficient funds');

        playBet();
        setGameState('SPINNING');
        setResultNumber(null);
        setWinnings(0);

        const outcomeIndex = Math.floor(Math.random() * 37);
        const outcomeNumber = WHEEL_NUMBERS[outcomeIndex];

        const sliceDeg = 360 / 37;
        const extraSpins = 5;
        const randomOffset = Math.random() * (sliceDeg * 0.8) - (sliceDeg * 0.4);
        const finalAngle = 360 * extraSpins + (360 - (outcomeIndex * sliceDeg)) + randomOffset;

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

        bets.forEach((bet) => {
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
            } else if (bet.type === 'RANGE') {
                if (bet.value === 'LOW' && number >= 1 && number <= 18) { win = true; multiplier = 2; }
                if (bet.value === 'HIGH' && number >= 19 && number <= 36) { win = true; multiplier = 2; }
                if (bet.value === 'DOZEN_1' && number >= 1 && number <= 12) { win = true; multiplier = 3; }
                if (bet.value === 'DOZEN_2' && number >= 13 && number <= 24) { win = true; multiplier = 3; }
                if (bet.value === 'DOZEN_3' && number >= 25 && number <= 36) { win = true; multiplier = 3; }
            }

            if (win) totalWin += bet.amount * multiplier;
        });

        if (totalWin > 0) {
            collectWinnings(totalWin);
            setWinnings(totalWin);
            playWin();
        } else {
            playLoss();
        }

        setRecent(prev => [number, ...prev].slice(0, 12));
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
        <div className="game-shell game-layout-two game-theme-roulette">
            <div className="stake-card game-panel">
                <div style={{ marginBottom: '16px' }}>
                    <div className="game-section-title">Chip Value</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                        {[10, 50, 100, 500, 1000].map(val => (
                            <button
                                key={val}
                                onClick={() => setCurrentBetAmount(val)}
                                style={{
                                    padding: '10px 4px',
                                    borderRadius: '999px',
                                    background: currentBetAmount === val ? '#fff' : '#2f4553',
                                    color: currentBetAmount === val ? '#000' : '#fff',
                                    border: `2px solid ${currentBetAmount === val ? '#00e701' : 'transparent'}`,
                                    fontWeight: 800,
                                    fontSize: '0.8rem'
                                }}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="game-stat-block" style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3', fontSize: '0.85rem' }}>
                        <span>Total Bet</span>
                        <strong style={{ color: '#fff' }}>₹{formatIndianNumber(totalBet)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8ea4b8', fontSize: '0.78rem', marginTop: '6px' }}>
                        <span>Bets Placed</span>
                        <span>{bets.length}</span>
                    </div>
                </div>

                {gameState === 'IDLE' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" onClick={clearBets} style={{ flex: 1 }}>Clear</button>
                        <button className="btn-primary" onClick={spinWheel} style={{ flex: 2 }}>Spin</button>
                    </div>
                ) : gameState === 'RESULT' ? (
                    <button className="btn-primary" onClick={resetGame} style={{ width: '100%' }}>Play Again</button>
                ) : (
                    <button className="btn-primary" disabled style={{ width: '100%', opacity: 0.55 }}>Spinning...</button>
                )}

                <div style={{ marginTop: '12px' }}>
                    <div className="game-section-title">Recent Numbers</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {recent.length === 0 && <span style={{ color: '#6d8094', fontSize: '0.8rem' }}>No rounds yet</span>}
                        {recent.map((num, i) => (
                            <span
                                key={`${num}_${i}`}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: getColor(num),
                                    color: '#fff',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800
                                }}
                            >
                                {num}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="game-container game-stage" style={{ position: 'relative', background: '#0f212e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '20px', gap: '22px' }}>
                <AnimatePresence>
                    {gameState === 'RESULT' && resultNumber !== null && (
                        <motion.div
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -30, opacity: 0 }}
                            style={{
                                position: 'absolute',
                                top: '12px',
                                zIndex: 20,
                                background: 'rgba(21, 32, 43, 0.95)',
                                padding: '12px 18px',
                                borderRadius: '12px',
                                border: `2px solid ${winnings > 0 ? '#00e701' : '#b1bad3'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                        >
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: getColor(resultNumber), color: 'white', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {resultNumber}
                            </div>
                            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 700 }}>
                                {winnings > 0 ? `Win ₹${formatIndianNumber(winnings)}` : 'No Win'}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{ position: 'relative', width: 'min(82vw, 300px)', height: 'min(82vw, 300px)', marginTop: '10px' }}>
                    <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '20px solid #fff' }} />

                    <div ref={wheelRef} style={{ width: '100%', height: '100%', borderRadius: '50%', border: '10px solid #2f4553', position: 'relative', background: '#1a2c38', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.45)' }}>
                        {WHEEL_NUMBERS.map((num, i) => {
                            const angle = (360 / 37) * i;
                            const color = getColor(num);
                            return (
                                <div key={num} style={{ position: 'absolute', top: '0', left: '50%', width: '2px', height: '50%', transformOrigin: 'bottom center', transform: `translateX(-50%) rotate(${angle}deg)`, display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
                                    <span style={{ position: 'absolute', top: '9px', color: '#fff', fontSize: '9px', fontWeight: 800, background: color, width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {num}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ width: '100%', maxWidth: '840px', overflowX: 'auto', paddingBottom: '2px' }}>
                    <div style={{ color: '#8ba0b5', fontSize: '0.75rem', marginBottom: '6px' }}>Swipe to view full table</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(12, 1fr)', gap: '4px', minWidth: '680px' }}>
                        <button
                            onClick={() => handlePlaceBet('NUMBER', 0)}
                            style={{ gridRow: '1 / span 3', background: '#00e701', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 800, position: 'relative' }}
                        >
                            0
                            {bets.find(b => b.type === 'NUMBER' && b.value === 0) && <div className="chip">{bets.find(b => b.type === 'NUMBER' && b.value === 0)?.amount}</div>}
                        </button>

                        {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(num => (
                            <NumberBtn key={num} num={num} onClick={() => handlePlaceBet('NUMBER', num)} bets={bets} />
                        ))}
                        <div style={{ gridColumn: '1', gridRow: '2' }} />
                        {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map(num => (
                            <NumberBtn key={num} num={num} onClick={() => handlePlaceBet('NUMBER', num)} bets={bets} />
                        ))}
                        <div style={{ gridColumn: '1', gridRow: '3' }} />
                        {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map(num => (
                            <NumberBtn key={num} num={num} onClick={() => handlePlaceBet('NUMBER', num)} bets={bets} />
                        ))}

                        <div style={{ gridColumn: '2 / span 4', marginTop: '8px' }}>
                            <MetaBtn label="1st 12" onClick={() => handlePlaceBet('RANGE', 'DOZEN_1')} bets={bets} type="RANGE" val="DOZEN_1" />
                        </div>
                        <div style={{ gridColumn: '6 / span 4', marginTop: '8px' }}>
                            <MetaBtn label="2nd 12" onClick={() => handlePlaceBet('RANGE', 'DOZEN_2')} bets={bets} type="RANGE" val="DOZEN_2" />
                        </div>
                        <div style={{ gridColumn: '10 / span 4', marginTop: '8px' }}>
                            <MetaBtn label="3rd 12" onClick={() => handlePlaceBet('RANGE', 'DOZEN_3')} bets={bets} type="RANGE" val="DOZEN_3" />
                        </div>

                        <div style={{ gridColumn: '2 / span 2', marginTop: '8px' }}>
                            <MetaBtn label="1-18" onClick={() => handlePlaceBet('RANGE', 'LOW')} bets={bets} type="RANGE" val="LOW" />
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
                            <MetaBtn label="19-36" onClick={() => handlePlaceBet('RANGE', 'HIGH')} bets={bets} type="RANGE" val="HIGH" />
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
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    pointer-events: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
            `}</style>
        </div>
    );
};

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
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 800,
                position: 'relative',
                transition: 'filter 0.2s'
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
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
                width: '100%',
                height: '40px',
                background: color,
                border: '1px solid #2f4553',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem',
                position: 'relative'
            }}
        >
            {label}
            {bet && <div className="chip">{bet.amount}</div>}
        </button>
    );
};
