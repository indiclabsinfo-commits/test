import React, { useEffect, useState, useRef } from 'react';
import { ODDS } from '../utils/probability';
import type { MoveType } from '../utils/probability';

interface ArenaScreenProps {
    entryFee: number;
    gameState: 'BETTING' | 'RESULT';
    lastOutcome: { win: boolean; amount: number; move: MoveType } | null;
    onPlaceBet: (move: MoveType) => void;
    onNextRound: () => void;
    onReplay: (fee: number) => void;
}

export const ArenaScreen: React.FC<ArenaScreenProps> = ({
    entryFee,
    gameState,
    lastOutcome,
    onPlaceBet,
    onNextRound,
    onReplay
}) => {
    const [showResult, setShowResult] = useState(false);
    const [betType, setBetType] = useState<'MANUAL' | 'AUTO'>('MANUAL');

    // Auto Betting State
    const [betsAmount, setBetsAmount] = useState<string>('10');
    const [betsRemaining, setBetsRemaining] = useState(0);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [autoStrategy, setAutoStrategy] = useState<MoveType>('SAFE');

    // To prevent rapid firing
    const processingRef = useRef(false);

    useEffect(() => {
        if (gameState === 'RESULT') {
            setShowResult(true);
            processingRef.current = false;

            if (isAutoRunning) {
                const newRemaining = betsRemaining - 1;
                setBetsRemaining(newRemaining);

                if (newRemaining > 0) {
                    const timer = setTimeout(() => {
                        onReplay(entryFee);
                    }, 1500); // 1.5s delay between rounds
                    return () => clearTimeout(timer);
                } else {
                    setIsAutoRunning(false);
                }
            }
        } else {
            setShowResult(false);
        }
    }, [gameState]);

    // Effect to trigger bet place when Auto enters BETTING state
    useEffect(() => {
        if (isAutoRunning && gameState === 'BETTING' && !processingRef.current) {
            processingRef.current = true;
            // Add slight delay to feel natural
            const timer = setTimeout(() => {
                onPlaceBet(autoStrategy);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isAutoRunning, gameState, autoStrategy, onPlaceBet]);

    const handleStartAuto = () => {
        const amount = parseInt(betsAmount);
        if (isNaN(amount) || amount <= 0) return;

        setBetsRemaining(amount);
        setIsAutoRunning(true);
        // If we are currently betting, place the bet immediately
        if (gameState === 'BETTING') {
            onPlaceBet(autoStrategy);
        }
        // If result screen, user should click Play Again to start or we auto start?
        // Let's assume start from result triggers next round.
        if (gameState === 'RESULT') {
            onReplay(entryFee);
        }
    };

    const handleStopAuto = () => {
        setIsAutoRunning(false);
        setBetsRemaining(0);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 25%) 1fr', gap: '16px', width: '100%', height: '100%' }}>

            {/* Left Sidebar - Controls */}
            <div className="stake-card" style={{ height: 'fit-content', padding: '16px' }}>
                <div style={{ display: 'flex', background: '#0f212e', padding: '4px', borderRadius: '24px', marginBottom: '16px' }}>
                    <button
                        onClick={() => !isAutoRunning && setBetType('MANUAL')}
                        style={{
                            flex: 1,
                            borderRadius: '20px',
                            padding: '8px',
                            background: betType === 'MANUAL' ? '#2f4553' : 'transparent',
                            color: betType === 'MANUAL' ? 'white' : '#b1bad3',
                            opacity: isAutoRunning ? 0.5 : 1,
                            cursor: isAutoRunning ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Manual
                    </button>
                    <button
                        onClick={() => !isAutoRunning && setBetType('AUTO')}
                        style={{
                            flex: 1,
                            borderRadius: '20px',
                            padding: '8px',
                            background: betType === 'AUTO' ? '#2f4553' : 'transparent',
                            color: betType === 'AUTO' ? 'white' : '#b1bad3',
                            opacity: isAutoRunning ? 0.5 : 1,
                            cursor: isAutoRunning ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Auto
                    </button>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#b1bad3', marginBottom: '4px', display: 'block' }}>Bet Amount</label>
                    <div className="input-group">
                        <input
                            type="number"
                            disabled
                            value={entryFee}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                width: '100%',
                                padding: '8px',
                                outline: 'none'
                            }}
                        />
                        <span style={{ color: '#b1bad3', paddingRight: '12px' }}>$</span>
                    </div>
                </div>

                {betType === 'MANUAL' ? (
                    /* MANUAL CONTROLS */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                        <button
                            className="btn-bet-safe"
                            onClick={() => onPlaceBet('SAFE')}
                            disabled={gameState !== 'BETTING'}
                        >
                            <span>Safe Mode</span>
                            <span style={{ color: '#00e701' }}>{ODDS.SAFE.multiplier}x</span>
                        </button>
                        <div style={{ fontSize: '0.75rem', color: '#55657e', textAlign: 'right' }}>Win Chance: {ODDS.SAFE.winProbability * 100}%</div>

                        <button
                            className="btn-bet-risk"
                            onClick={() => onPlaceBet('AGGRESSIVE')}
                            disabled={gameState !== 'BETTING'}
                        >
                            <span>Aggressive</span>
                            <span style={{ color: '#00e701' }}>{ODDS.AGGRESSIVE.multiplier}x</span>
                        </button>
                        <div style={{ fontSize: '0.75rem', color: '#55657e', textAlign: 'right' }}>Win Chance: {ODDS.AGGRESSIVE.winProbability * 100}%</div>
                    </div>
                ) : (
                    /* AUTO CONTROLS */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: '#b1bad3', marginBottom: '4px', display: 'block' }}>Number of Bets</label>
                            <div className="input-group">
                                <input
                                    type="number"
                                    value={betsAmount}
                                    onChange={(e) => setBetsAmount(e.target.value)}
                                    disabled={isAutoRunning}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'white',
                                        width: '100%',
                                        padding: '8px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.8rem', color: '#b1bad3', marginBottom: '4px', display: 'block' }}>Strategy</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setAutoStrategy('SAFE')}
                                    disabled={isAutoRunning}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: autoStrategy === 'SAFE' ? '#2f4553' : '#0f212e',
                                        color: 'white',
                                        border: autoStrategy === 'SAFE' ? '1px solid #00e701' : '1px solid transparent',
                                        cursor: isAutoRunning ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Safe
                                </button>
                                <button
                                    onClick={() => setAutoStrategy('AGGRESSIVE')}
                                    disabled={isAutoRunning}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: autoStrategy === 'AGGRESSIVE' ? '#2f4553' : '#0f212e',
                                        color: 'white',
                                        border: autoStrategy === 'AGGRESSIVE' ? '1px solid #00e701' : '1px solid transparent',
                                        cursor: isAutoRunning ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Aggressive
                                </button>
                            </div>
                        </div>

                        <button
                            className="btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '1.1rem', background: isAutoRunning ? '#ea3e3e' : '#00e701', color: '#011e01' }}
                            onClick={isAutoRunning ? handleStopAuto : handleStartAuto}
                        >
                            {isAutoRunning ? `Stop Auto (${betsRemaining})` : 'Start Auto Bet'}
                        </button>
                    </div>
                )}

                {/* Only show "select strategy" prompt if manual and no bets placed */}
                {!isAutoRunning && betType === 'MANUAL' && (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#55657e', fontSize: '0.9rem' }}>
                        Select a strategy above to play.
                    </div>
                )}
            </div>

            {/* Main Game Area */}
            <div className="game-container" style={{ position: 'relative' }}>
                {showResult && lastOutcome ? (
                    <div className="stake-card" style={{ maxWidth: '400px', textAlign: 'center', border: lastOutcome.win ? '2px solid #00e701' : '2px solid #ea3e3e', animation: 'pulse 0.5s' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>
                            {lastOutcome.win ? '🏆' : '💀'}
                        </div>
                        <h2 style={{ color: lastOutcome.win ? '#00e701' : '#ea3e3e', fontSize: '2rem', marginBottom: '8px' }}>
                            {lastOutcome.win ? "YOU WON" : "CRASHED"}
                        </h2>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '24px', color: 'white' }}>
                            {lastOutcome.win ? `${(lastOutcome.amount / entryFee).toFixed(2)}x` : '0.00x'}
                        </div>

                        <p style={{ fontSize: '1.1rem', marginBottom: '24px', color: '#b1bad3' }}>
                            {lastOutcome.win ? `Profit: +$${lastOutcome.amount - entryFee}` : `Loss: -$${entryFee}`}
                        </p>

                        {!isAutoRunning && (
                            <button className="btn-primary" onClick={onNextRound} style={{ width: '100%', padding: '16px' }}>
                                Play Again
                            </button>
                        )}
                        {isAutoRunning && (
                            <div style={{ color: '#00e701', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                                Auto-Betting... Next round in 1.5s
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', opacity: 0.5 }}>
                        <div style={{ fontSize: '5rem', marginBottom: '24px' }}>📊</div>
                        <h3>{isAutoRunning ? 'Auto-Bet Running...' : 'Ready to Play'}</h3>
                        <p>{isAutoRunning ? `Strategy: ${autoStrategy} | Bets Left: ${betsRemaining}` : 'Select a strategy on the left to begin.'}</p>
                    </div>
                )}

                {/* Footer of game area */}
                <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '16px' }}>
                    <div style={{ background: '#0f212e', padding: '8px 16px', borderRadius: '4px', fontSize: '0.8rem', color: '#b1bad3' }}>
                        Fairness Verified ✅
                    </div>
                </div>
            </div>
        </div>
    );
};
