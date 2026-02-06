import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { playBet, playWin, playLoss } from '../../utils/sound';

export const LimboGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();
    const [betAmount, setBetAmount] = useState(10);
    const [target, setTarget] = useState(2.0);
    const [result, setResult] = useState<number | null>(null);
    const [displayedResult, setDisplayedResult] = useState<number>(1.00);
    const [isPlaying, setIsPlaying] = useState(false);

    // Animation refs
    const requestRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);
    const finalResultRef = useRef<number>(0);

    // Win Chance = 99 / Target
    const winChance = 99 / target;

    const animate = (time: number) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        const progress = time - startTimeRef.current;

        // Duration based on size of result? Fixed 2s for excitement?
        // Let's do exponential growth simulation: v = e^(t) kind of look.
        // Or simpler: displayedResult increases by % every frame.

        // Let's stick to a duration-based ease-out for control.
        const duration = 2000; // 2 seconds

        if (progress < duration) {
            // Cubic ease out? 
            // We want it to look like it's "flying" up.
            // Linear until the end?
            // Let's try exponential interpolation: 
            // Val = 1 * (Final / 1) ^ (progress / duration)
            const final = finalResultRef.current;
            // Avoid crazy numbers if final is huge

            const ratio = progress / duration;
            // const current = 1.00 + (final - 1.00) * (ratio * ratio);
            // Actually, crash games usually accelerate upwards.
            // Let's use: Val = 1 * (Final ^ ratio)

            // Safe math
            const nextVal = Math.pow(final, ratio);

            setDisplayedResult(Math.max(1, nextVal));
            requestRef.current = requestAnimationFrame(animate);
        } else {
            setDisplayedResult(finalResultRef.current);
            finishGame(finalResultRef.current);
        }
    };

    const play = () => {
        if (!placeBet(betAmount)) return alert("Insufficient funds");

        playBet();
        setIsPlaying(true);
        setResult(null); // Clear previous final result state, but keep displayedResult visible or reset?
        setDisplayedResult(1.00);

        // Generate outcome
        const random = Math.random() * 100;
        const outcome = 99 / (random || 1);
        const finalOutcome = Math.max(1.00, parseFloat(outcome.toFixed(2)));

        finalResultRef.current = finalOutcome;
        startTimeRef.current = undefined;

        // Start Animation
        requestRef.current = requestAnimationFrame(animate);
    };

    const finishGame = (finalOutcome: number) => {
        setResult(finalOutcome);
        if (finalOutcome >= target) {
            collectWinnings(betAmount * target);
            playWin();
        } else {
            playLoss();
        }
        setIsPlaying(false);
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', width: '100%', height: '100%' }}>
            <div className="stake-card" style={{ padding: '16px', height: 'fit-content' }}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#b1bad3' }}>Bet Amount</label>
                    <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                        style={{ width: '100%', background: '#0f212e', border: 'none', color: 'white', padding: '8px', borderRadius: '4px' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#b1bad3' }}>Target Multiplier</label>
                    <input type="number" step="0.01" value={target} onChange={e => setTarget(Number(e.target.value))}
                        style={{ width: '100%', background: '#0f212e', border: 'none', color: 'white', padding: '8px', borderRadius: '4px' }} />
                    <div style={{ fontSize: '0.8rem', color: '#55657e', marginTop: '4px' }}>Win Chance: {winChance.toFixed(2)}%</div>
                </div>
                <button className="btn-primary" onClick={play} disabled={isPlaying} style={{ width: '100%', padding: '16px', background: '#00e701', color: '#011e01' }}>
                    {isPlaying ? 'Flying...' : 'Bet'}
                </button>
            </div>

            <div className="game-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div style={{
                    fontSize: '6rem',
                    fontWeight: 'bold',
                    color: !isPlaying && result ? (result >= target ? '#00e701' : '#ea3e3e') : '#fff', // White while flying, color on result? Or always color?
                    // Usually crash games are white/neutral until crash/stop.
                    fontFamily: 'monospace'
                }}>
                    {displayedResult.toFixed(2)}x
                </div>

                {/* Result Message for clarity */}
                {!isPlaying && result !== null && (
                    <div style={{
                        marginTop: '16px',
                        fontSize: '1.5rem',
                        color: result >= target ? '#00e701' : '#ea3e3e',
                        fontWeight: 'bold'
                    }}>
                        {result >= target ? 'WIN' : 'LOSS'}
                    </div>
                )}

                <div style={{ color: '#b1bad3', marginTop: '32px' }}>Target: {target.toFixed(2)}x</div>
            </div>
        </div>
    );
};
