import React, { useMemo, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { playBet, playWin, playLoss } from '../../utils/sound';
import { formatIndianNumber } from '../../utils/format';

interface PlinkoResult {
    bin: number;
    multiplier: number;
    payout: number;
}

export const PlinkoGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();
    const [betAmount, setBetAmount] = useState(10);
    const [balls, setBalls] = useState<{ id: number; left: number; row: number }[]>([]);
    const [isDropping, setIsDropping] = useState(false);
    const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);
    const [history, setHistory] = useState<PlinkoResult[]>([]);

    const rows = 12;
    const multipliers = useMemo(() => [30, 10, 4, 1.6, 1, 0.6, 0.4, 0.6, 1, 1.6, 4, 10, 30], []);

    const dropBall = () => {
        if (isDropping) return;
        if (!placeBet(betAmount)) return alert('Insufficient funds');

        playBet();
        setIsDropping(true);
        setLastResult(null);

        const ballId = Date.now();
        const path: (1 | -1)[] = [];
        for (let i = 0; i < rows; i += 1) path.push(Math.random() > 0.5 ? 1 : -1);

        let rightMoves = 0;
        setBalls(prev => [...prev, { id: ballId, left: 50, row: 0 }]);

        let r = 0;
        const interval = setInterval(() => {
            const step = path[r];
            if (step === 1) rightMoves += 1;
            r += 1;

            setBalls(prev => prev.map(b => {
                if (b.id !== ballId) return b;
                const targetLeft = 12 + (rightMoves / rows) * 76;
                const jitter = (Math.random() - 0.5) * 1.1;
                return { ...b, row: r, left: targetLeft + jitter };
            }));

            if (r >= rows) {
                clearInterval(interval);
                const bin = Math.max(0, Math.min(rows, rightMoves));
                const multiplier = multipliers[bin];
                const payout = betAmount * multiplier;

                collectWinnings(payout);
                const result = { bin, multiplier, payout };
                setLastResult(result);
                setHistory(prev => [result, ...prev].slice(0, 8));

                if (multiplier >= 1) playWin();
                else playLoss();

                setBalls(prev => prev.filter(b => b.id !== ballId));
                setIsDropping(false);
            }
        }, 95);
    };

    return (
        <div className="game-shell game-layout-two game-theme-plinko">
            <div className="stake-card game-panel" style={{ padding: '16px', height: 'fit-content' }}>
                <div style={{ marginBottom: '12px' }}>
                    <div className="game-section-title">Bet Amount</div>
                    <div className="bet-input-row">
                        <input
                            type="number"
                            value={betAmount}
                            onChange={e => setBetAmount(Math.max(1, Number(e.target.value) || 0))}
                            disabled={isDropping}
                        />
                        <span style={{ color: '#b1bad3' }}>₹</span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {[10, 50, 100, 500].map(amount => (
                        <button
                            key={amount}
                            className="btn-quick"
                            onClick={() => setBetAmount(amount)}
                            disabled={isDropping}
                            style={{
                                background: betAmount === amount ? '#4f8cff' : undefined,
                                color: betAmount === amount ? '#fff' : undefined
                            }}
                        >
                            {amount}
                        </button>
                    ))}
                </div>

                <button className="btn-primary" onClick={dropBall} disabled={isDropping} style={{ width: '100%', padding: '16px' }}>
                    {isDropping ? 'Dropping...' : 'Drop Ball'}
                </button>

                {lastResult && (
                    <div className="game-stat-block" style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3', marginBottom: '6px' }}>
                            <span>Landing Bin</span>
                            <strong style={{ color: '#fff' }}>#{lastResult.bin + 1}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3', marginBottom: '6px' }}>
                            <span>Multiplier</span>
                            <strong style={{ color: lastResult.multiplier >= 1 ? '#00e701' : '#ea3e3e' }}>{lastResult.multiplier}x</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3' }}>
                            <span>Payout</span>
                            <strong style={{ color: '#fff' }}>₹{formatIndianNumber(lastResult.payout, true)}</strong>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '12px' }}>
                    <div className="game-section-title">Recent Drops</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {history.length === 0 && <span style={{ color: '#6d8094', fontSize: '0.8rem' }}>No rounds yet</span>}
                        {history.map((item, i) => (
                            <span
                                key={`${item.bin}_${i}`}
                                style={{
                                    background: item.multiplier >= 2 ? '#34d399' : item.multiplier >= 1 ? '#3b82f6' : '#ef4444',
                                    color: '#04131f',
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700
                                }}
                            >
                                {item.multiplier}x
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="game-container game-stage" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(92%, 560px)',
                    height: 'min(70vh, 520px)',
                    background: 'linear-gradient(180deg, rgba(161, 101, 255, 0.25), rgba(83, 50, 134, 0.08))',
                    clipPath: 'polygon(50% 0, 0 100%, 100% 100%)',
                    opacity: 0.5
                }} />

                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '120px',
                    background: 'radial-gradient(circle at 50% 0, rgba(255,255,255,0.14), transparent 66%)'
                }} />

                <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 2 }}>
                    {Array(rows).fill(0).map((_, r) => (
                        <div key={r} style={{ display: 'flex', gap: '24px' }}>
                            {Array(r + 1).fill(0).map((__, c) => (
                                <div
                                    key={c}
                                    style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: '#f6f7fb',
                                        boxShadow: '0 0 6px rgba(255,255,255,0.55)'
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                <div style={{
                    width: '100%',
                    maxWidth: '700px',
                    marginTop: '18px',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${rows + 1}, minmax(0, 1fr))`,
                    gap: '6px',
                    zIndex: 2
                }}>
                    {multipliers.map((m, i) => (
                        <div
                            key={i}
                            style={{
                                padding: '6px 2px',
                                borderRadius: '6px',
                                background: m >= 2 ? '#34d399' : m >= 1 ? '#3b82f6' : '#ef4444',
                                color: '#04131f',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                textAlign: 'center',
                                border: lastResult?.bin === i ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                                transform: lastResult?.bin === i ? 'translateY(-2px)' : 'none'
                            }}
                        >
                            {m}x
                        </div>
                    ))}
                </div>

                {balls.map(b => (
                    <div
                        key={b.id}
                        style={{
                            position: 'absolute',
                            top: `${(b.row * 30) + 52}px`,
                            left: `${b.left}%`,
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at 30% 25%, #ffd0f6, #ff4ec6 72%)',
                            boxShadow: '0 0 10px rgba(255, 78, 198, 0.85)',
                            transition: 'top 0.095s linear, left 0.095s linear'
                        }}
                    />
                ))}
            </div>
        </div>
    );
};
