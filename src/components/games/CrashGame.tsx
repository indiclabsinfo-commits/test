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

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = '#2f4553';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h); ctx.lineTo(w, h);
        ctx.moveTo(0, 0); ctx.lineTo(0, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = crashed ? '#ea3e3e' : '#fff';

        // Simple animated exponential line
        ctx.moveTo(0, h);
        for (let i = 0; i < w; i += 5) {
            const t = i / w; // 0 to 1
            const val = Math.pow(Math.E, t * 2); // 1 to 7
            // If val > mult, stop
            if (val > mult && !crashed) break;

            const y = h - ((val - 1) / (Math.max(2, mult) - 1)) * (h * 0.8);
            ctx.lineTo(i, y);
        }
        ctx.stroke();
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 20%) 1fr minmax(250px, 20%)', gap: '16px', height: '100%' }}>

            {/* Left: Controls */}
            <div className="stake-card" style={{ zIndex: 10 }}>
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
            <div className="game-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <canvas ref={canvasRef} width={600} height={400} style={{ width: '100%', height: '100%' }} />

                <div style={{ position: 'absolute', textAlign: 'center' }}>
                    {gameState === 'BETTING' && (
                        <div style={{ fontSize: '1.5rem', color: '#fff' }}>Starting...</div>
                    )}
                    {(gameState === 'FLYING' || gameState === 'CRASHED') && (
                        <div style={{
                            fontSize: '5rem',
                            fontWeight: 'bold',
                            color: gameState === 'CRASHED' ? '#ea3e3e' : '#fff'
                        }}>
                            {currentMultiplier.toFixed(2)}x
                        </div>
                    )}
                    {gameState === 'CRASHED' && (
                        <div style={{ color: '#ea3e3e', fontSize: '1.5rem', fontWeight: 'bold' }}>CRASHED</div>
                    )}
                </div>
            </div>

            {/* Right: Leaderboard (Group Aspect) */}
            <div className="stake-card" style={{ maxHeight: '100%', overflowY: 'auto' }}>
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
