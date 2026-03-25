import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { formatIndianNumber } from '../../utils/format';
import { playBet, playExplosion } from '../../utils/sound';

interface BotPlayer {
    id: number;
    name: string;
    bet: number;
    cashOutAt: number; // Target multiplier
    status: 'BETTING' | 'CASHED_OUT' | 'CRASHED';
    wonAmount?: number;
}

const BOT_NAMES = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya'];

export const CrashGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();

    // Game State
    const [gameState, setGameState] = useState<'BETTING' | 'FLYING' | 'CRASHED'>('BETTING');
    const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
    const [crashPoint, setCrashPoint] = useState(0);

    // User State
    const [betAmount, setBetAmount] = useState(10);
    const [autoCashout, setAutoCashout] = useState<number | null>(null);
    const [hasBet, setHasBet] = useState(false);
    const [hasCashedOut, setHasCashedOut] = useState(false);
    const [userWinAmount, setUserWinAmount] = useState(0);

    // Bot State
    const [bots, setBots] = useState<BotPlayer[]>([]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);

    // Init Bots
    const generateBots = () => {
        const count = 3 + Math.floor(Math.random() * 3); // 3-5 bots
        const newBots: BotPlayer[] = [];
        for (let i = 0; i < count; i++) {
            const riskProfile = Math.random(); // 0-1
            let target = 0;
            if (riskProfile < 0.6) target = 1.1 + Math.random() * 0.9;
            else if (riskProfile < 0.9) target = 2.0 + Math.random() * 3.0;
            else target = 5.0 + Math.random() * 10.0;

            newBots.push({
                id: i,
                name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
                bet: 10 * Math.floor(1 + Math.random() * 10), // 10-100
                cashOutAt: parseFloat(target.toFixed(2)),
                status: 'BETTING'
            });
        }
        setBots(newBots);
    };

    useEffect(() => {
        if (gameState === 'BETTING') {
            generateBots();
            // Start countdown to Fly
            const timer = setTimeout(() => {
                startRound();
            }, 3000); // 3s betting phase
            return () => clearTimeout(timer);
        }
    }, [gameState]);

    const startRound = () => {
        // House Edge: 1% chance to crash immediately @ 1.00
        // Distribution: 1 / (1-random)
        const instantCrash = Math.random() < 0.01;
        const generatedCrash = instantCrash ? 1.00 : 0.99 / (Math.random() || 0.01); // E(x)=0.99
        // Allow up to 100x max usually
        const finalCrash = Math.min(1000, Math.max(1.00, generatedCrash));

        setCrashPoint(finalCrash);
        setGameState('FLYING');
        setCurrentMultiplier(1.00);
        setHasCashedOut(false);
        setUserWinAmount(0);

        // Update Bot Bets (Visual only really)
        setBots(prev => prev.map(b => ({ ...b, status: 'BETTING', wonAmount: undefined })));

        startTimeRef.current = Date.now();
        requestRef.current = requestAnimationFrame(gameLoop);
    };

    const gameLoop = () => {
        const now = Date.now();
        const elapsed = (now - (startTimeRef.current || now)) / 1000; // seconds

        // Growth Function: Exponential
        const nextMult = Math.pow(Math.E, 0.15 * elapsed);

        // Update Bots Live
        setBots(prev => prev.map(bot => {
            if (bot.status === 'BETTING' && nextMult >= bot.cashOutAt) {
                return { ...bot, status: 'CASHED_OUT', wonAmount: bot.bet * bot.cashOutAt };
            }
            return bot;
        }));

        // Auto-cashout for user if enabled
        if (autoCashout && hasBet && !hasCashedOut && nextMult >= autoCashout) {
            const win = betAmount * autoCashout;
            collectWinnings(win);
            setHasCashedOut(true);
            setUserWinAmount(win);
        }

        if (nextMult >= crashPoint) {
            // CRASH
            setCurrentMultiplier(crashPoint);
            setGameState('CRASHED');
            if (hasBet && !hasCashedOut) playExplosion(); // Big sound for crash
            
            // Mark bots who didn't cash out as crashed
            setBots(prev => prev.map(bot => 
                bot.status === 'BETTING' ? { ...bot, status: 'CRASHED' } : bot
            ));
            
            drawGraph(crashPoint, true);
            
            // Auto-reset after 5 seconds
            setTimeout(() => {
                setGameState('BETTING');
                setHasBet(false);
                setHasCashedOut(false);
                setUserWinAmount(0);
                setCurrentMultiplier(1.00);
            }, 5000);
        } else {
            setCurrentMultiplier(nextMult);
            drawGraph(nextMult, false);
            requestRef.current = requestAnimationFrame(gameLoop);
        }
    };

    const drawGraph = (mult: number, crashed: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Handle high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }

        const w = rect.width;
        const h = rect.height;

        // Reset transform then apply DPR scaling each frame
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        // Padding for axes labels
        const padLeft = 45;
        const padBottom = 30;
        const padTop = 20;
        const padRight = 20;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        // Dynamic Y-axis scale
        const maxMult = Math.max(2, crashed ? mult * 1.15 : mult * 1.3);

        // --- Grid background ---
        ctx.save();

        // Subtle grid lines
        ctx.strokeStyle = 'rgba(47, 69, 83, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);

        // Horizontal grid lines (multiplier values)
        const ySteps = maxMult <= 3 ? 0.5 : maxMult <= 10 ? 1 : maxMult <= 50 ? 5 : 10;
        for (let v = 1; v <= maxMult; v += ySteps) {
            const y = padTop + chartH - ((v - 1) / (maxMult - 1)) * chartH;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + chartW, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = 'rgba(177, 186, 211, 0.6)';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(v.toFixed(v < 10 ? 1 : 0) + 'x', padLeft - 6, y + 4);
        }

        // Vertical grid lines (time markers)
        const xSteps = Math.max(1, Math.floor(chartW / 80));
        for (let i = 0; i <= xSteps; i++) {
            const x = padLeft + (i / xSteps) * chartW;
            ctx.beginPath();
            ctx.moveTo(x, padTop);
            ctx.lineTo(x, padTop + chartH);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // --- Axes ---
        ctx.strokeStyle = 'rgba(47, 69, 83, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop);
        ctx.lineTo(padLeft, padTop + chartH);
        ctx.lineTo(padLeft + chartW, padTop + chartH);
        ctx.stroke();

        // --- Draw the curve ---
        // Build points array for smooth curve
        const points: { x: number; y: number }[] = [];
        const stepSize = 2;
        for (let px = 0; px <= chartW; px += stepSize) {
            const t = px / chartW;
            // Map t to multiplier value using log scale that matches the exponential growth
            const val = 1 + (mult - 1) * Math.pow(t, 1.8);
            if (val > mult && !crashed) break;

            const x = padLeft + px;
            const y = padTop + chartH - ((val - 1) / (maxMult - 1)) * chartH;
            points.push({ x, y });
        }

        if (points.length < 2) {
            ctx.restore();
            return;
        }

        // Gradient fill under the curve
        const lastPt = points[points.length - 1];
        const fillGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        if (crashed) {
            fillGrad.addColorStop(0, 'rgba(234, 62, 62, 0.25)');
            fillGrad.addColorStop(1, 'rgba(234, 62, 62, 0.02)');
        } else {
            fillGrad.addColorStop(0, 'rgba(0, 231, 1, 0.2)');
            fillGrad.addColorStop(0.5, 'rgba(0, 231, 1, 0.08)');
            fillGrad.addColorStop(1, 'rgba(0, 231, 1, 0.01)');
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, padTop + chartH);
        for (const pt of points) {
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.lineTo(lastPt.x, padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = fillGrad;
        ctx.fill();

        // The line itself
        const lineGrad = ctx.createLinearGradient(padLeft, 0, lastPt.x, 0);
        if (crashed) {
            lineGrad.addColorStop(0, '#ea3e3e');
            lineGrad.addColorStop(1, '#ff6b6b');
        } else {
            lineGrad.addColorStop(0, '#00e701');
            lineGrad.addColorStop(0.7, '#00ff88');
            lineGrad.addColorStop(1, '#ffffff');
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // --- Glowing tip at the current point ---
        if (!crashed && points.length > 0) {
            const tip = points[points.length - 1];

            // Outer glow
            const glowRadius = 18 + Math.sin(Date.now() / 200) * 4;
            const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, glowRadius);
            glow.addColorStop(0, 'rgba(0, 255, 136, 0.5)');
            glow.addColorStop(0.4, 'rgba(0, 231, 1, 0.2)');
            glow.addColorStop(1, 'rgba(0, 231, 1, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Inner dot
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Bright ring
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // --- Crash marker ---
        if (crashed && points.length > 0) {
            const tip = points[points.length - 1];

            // Red explosion glow
            const crashGlow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 30);
            crashGlow.addColorStop(0, 'rgba(234, 62, 62, 0.6)');
            crashGlow.addColorStop(0.5, 'rgba(234, 62, 62, 0.2)');
            crashGlow.addColorStop(1, 'rgba(234, 62, 62, 0)');
            ctx.fillStyle = crashGlow;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 30, 0, Math.PI * 2);
            ctx.fill();

            // X mark
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            const sz = 8;
            ctx.beginPath();
            ctx.moveTo(tip.x - sz, tip.y - sz);
            ctx.lineTo(tip.x + sz, tip.y + sz);
            ctx.moveTo(tip.x + sz, tip.y - sz);
            ctx.lineTo(tip.x - sz, tip.y + sz);
            ctx.stroke();
        }

        ctx.restore();
    };

    const handlePlaceBet = () => {
        if (gameState !== 'BETTING') return;
        if (placeBet(betAmount)) {
            playBet();
            setHasBet(true);
        } else {
            alert('Insufficient Funds');
        }
    };

    const handleCashOut = () => {
        if (gameState !== 'FLYING' || !hasBet || hasCashedOut) return;

        const win = betAmount * currentMultiplier;
        collectWinnings(win);
        setHasCashedOut(true);
        setUserWinAmount(win);
    };

    // cleanup
    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div className="game-shell game-layout-three game-theme-crash">

            {/* Left: Controls */}
            <div className="stake-card game-panel" style={{ zIndex: 10 }}>
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3' }}>Bet Amount</label>
                    <div className="input-group">
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                            disabled={hasBet}
                            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff' }}
                        />
                        <span style={{ color: '#b1bad3' }}>₹</span>
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#b1bad3' }}>Auto Cashout (Optional)</label>
                    <div className="input-group">
                        <input
                            type="number"
                            value={autoCashout || ''}
                            onChange={(e) => setAutoCashout(e.target.value ? Number(e.target.value) : null)}
                            placeholder="e.g. 2.00"
                            disabled={hasBet}
                            step="0.1"
                            min="1.01"
                            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff' }}
                        />
                        <span style={{ color: '#b1bad3' }}>x</span>
                    </div>
                </div>

                {gameState === 'BETTING' ? (
                    <button
                        className="btn-primary"
                        onClick={handlePlaceBet}
                        disabled={hasBet}
                        style={{ width: '100%', background: hasBet ? '#2f4553' : '#00e701', color: hasBet ? '#fff' : '#011e01' }}
                    >
                        {hasBet ? 'Bet Placed' : 'Place Bet'}
                    </button>
                ) : (
                    <button
                        className="btn-primary"
                        onClick={handleCashOut}
                        disabled={!hasBet || hasCashedOut || gameState === 'CRASHED'}
                        style={{ width: '100%', background: hasCashedOut ? '#2f4553' : (gameState === 'CRASHED' ? '#ea3e3e' : '#ffaa00'), color: '#000' }}
                    >
                        {hasCashedOut ? 'Cashed Out' : (gameState === 'CRASHED' ? 'Crashed' : 'Cash Out')}
                    </button>
                )}

                {hasCashedOut && (
                    <div style={{ marginTop: '16px', color: '#00e701', fontWeight: 'bold', textAlign: 'center' }}>
                        You Won ₹{formatIndianNumber(userWinAmount)}
                    </div>
                )}
            </div>

            {/* Middle: Graph */}
            <div className="game-container game-stage" style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                animation: gameState === 'CRASHED' ? 'crash-shake 0.5s ease-out' : undefined,
            }}>
                {/* Red flash overlay on crash */}
                {gameState === 'CRASHED' && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle, rgba(234, 62, 62, 0.3) 0%, rgba(234, 62, 62, 0.1) 50%, transparent 80%)',
                        animation: 'crash-flash 0.6s ease-out forwards',
                        pointerEvents: 'none',
                        zIndex: 2,
                    }} />
                )}

                <canvas
                    ref={canvasRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                    }}
                />

                <div style={{ position: 'absolute', textAlign: 'center', zIndex: 3, pointerEvents: 'none' }}>
                    {gameState === 'BETTING' && (
                        <div style={{
                            fontSize: '1.5rem',
                            color: 'rgba(255,255,255,0.6)',
                            animation: 'pulse-text 1.5s ease-in-out infinite',
                        }}>
                            Starting...
                        </div>
                    )}
                    {gameState === 'FLYING' && (
                        <div style={{
                            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                            fontWeight: 900,
                            color: '#fff',
                            textShadow: '0 0 30px rgba(0, 231, 1, 0.4), 0 2px 10px rgba(0, 0, 0, 0.5)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.02em',
                            transition: 'color 0.1s',
                        }}>
                            {currentMultiplier.toFixed(2)}x
                        </div>
                    )}
                    {gameState === 'CRASHED' && (
                        <>
                            <div style={{
                                fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                                fontWeight: 900,
                                color: '#ea3e3e',
                                textShadow: '0 0 30px rgba(234, 62, 62, 0.5), 0 2px 10px rgba(0, 0, 0, 0.5)',
                                fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-0.02em',
                            }}>
                                {currentMultiplier.toFixed(2)}x
                            </div>
                            <div style={{
                                color: '#ea3e3e',
                                fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                                marginTop: '4px',
                                textShadow: '0 0 20px rgba(234, 62, 62, 0.6)',
                                animation: 'crash-text-shake 0.4s ease-out',
                            }}>
                                CRASHED!
                            </div>
                        </>
                    )}
                </div>

                {/* Inline keyframes for crash effects */}
                <style>{`
                    @keyframes crash-shake {
                        0%, 100% { transform: translate(0, 0); }
                        10% { transform: translate(-6px, -3px); }
                        20% { transform: translate(5px, 2px); }
                        30% { transform: translate(-4px, 4px); }
                        40% { transform: translate(3px, -2px); }
                        50% { transform: translate(-2px, 3px); }
                        60% { transform: translate(2px, -1px); }
                        70% { transform: translate(-1px, 1px); }
                        80% { transform: translate(1px, -1px); }
                    }
                    @keyframes crash-flash {
                        0% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    @keyframes crash-text-shake {
                        0% { transform: scale(1.3) rotate(-2deg); opacity: 0; }
                        30% { transform: scale(1.1) rotate(1deg); opacity: 1; }
                        60% { transform: scale(1.05) rotate(-0.5deg); }
                        100% { transform: scale(1) rotate(0deg); }
                    }
                    @keyframes pulse-text {
                        0%, 100% { opacity: 0.5; }
                        50% { opacity: 1; }
                    }
                `}</style>
            </div>

            {/* Right: Leaderboard (Group Aspect) */}
            <div className="stake-card game-panel" style={{ maxHeight: '100%', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>👥</span> Players ({bots.length + 1})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* User Row */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '8px',
                        background: hasCashedOut ? 'rgba(0, 231, 1, 0.1)' : 'transparent',
                        border: hasBet ? '1px solid #2f4553' : 'none',
                        borderRadius: '4px'
                    }}>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>You</span>
                        <div style={{ textAlign: 'right' }}>
                            {hasCashedOut ? (
                                <span style={{ color: '#00e701' }}>{userWinAmount.toFixed(0)}</span>
                            ) : (
                                <span style={{ color: '#b1bad3' }}>{hasBet ? 'Betting' : '-'}</span>
                            )}
                        </div>
                    </div>

                    {/* Bots */}
                    {bots.map(bot => (
                        <div key={bot.id} style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '8px',
                            background: bot.status === 'CASHED_OUT' ? 'rgba(0, 231, 1, 0.1)' : (bot.status === 'CRASHED' && gameState === 'CRASHED' ? 'rgba(234, 62, 62, 0.1)' : 'transparent'),
                            borderRadius: '4px'
                        }}>
                            <span style={{ color: '#b1bad3' }}>{bot.name}</span>
                            <div style={{ textAlign: 'right' }}>
                                {bot.status === 'CASHED_OUT' ? (
                                    <span style={{ color: '#00e701' }}>{(bot.wonAmount || 0).toFixed(0)}</span>
                                ) : (
                                    <span style={{ color: gameState === 'CRASHED' ? '#ea3e3e' : '#fff' }}>
                                        {gameState === 'CRASHED' ? 'Lost' : 'Betting'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
