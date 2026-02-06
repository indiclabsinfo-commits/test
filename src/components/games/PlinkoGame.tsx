import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { playBet, playWin, playLoss } from '../../utils/sound';

export const PlinkoGame: React.FC = () => {
    const { placeBet, collectWinnings } = useGame();
    const [betAmount, setBetAmount] = useState(10);
    const [balls, setBalls] = useState<{ id: number, left: number, row: number }[]>([]);


    const rows = 16;
    const multipliers = [100, 25, 5, 2, 0.5, 0.2, 0.2, 0.2, 0.2, 0.2, 0.5, 2, 5, 25, 100]; // Simplified generic row

    const dropBall = () => {
        if (!placeBet(betAmount)) return alert("Insufficient funds");

        playBet();
        const ballId = Date.now();
        // Start ball logic
        const path: number[] = []; // -1 left, 1 right


        // Pre-calculate path
        for (let i = 0; i < rows; i++) {
            path.push(Math.random() > 0.5 ? 1 : -1);
        }

        // Calculate result index

        // Map rightMoves (0 to 16) to multiplier index. 
        // 16 rows implies 17 bins.
        // Let's use simplified logic for visual only
        // Actually, let's map roughly to the middle-heavy distribution

        setBalls(prev => [...prev, { id: ballId, left: 50, row: 0 }]);

        // Animate
        let r = 0;
        const interval = setInterval(() => {
            r++;
            setBalls(prev => prev.map(b => {
                if (b.id === ballId) {
                    const deviation = (Math.random() - 0.5) * 5; // Jitter
                    return { ...b, row: r, left: b.left + deviation };
                }
                return b;
            }));

            if (r >= rows) {
                clearInterval(interval);
                // Finish
                // Randomized win
                const randomMult = multipliers[Math.floor(Math.random() * multipliers.length)];
                collectWinnings(betAmount * randomMult);
                if (randomMult >= 1) playWin(); else playLoss();

                setBalls(prev => prev.filter(b => b.id !== ballId));
            }
        }, 100);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', width: '100%', height: '100%' }}>
            <div className="stake-card" style={{ padding: '16px', height: 'fit-content' }}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#b1bad3' }}>Bet Amount</label>
                    <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                        style={{ width: '100%', background: '#0f212e', border: 'none', color: 'white', padding: '8px', borderRadius: '4px' }} />
                </div>
                <button className="btn-primary" onClick={dropBall} style={{ width: '100%', padding: '16px' }}>Drop Ball</button>
            </div>

            <div className="game-container" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', width: '0', height: '0', borderLeft: '300px solid transparent', borderRight: '300px solid transparent', borderBottom: '600px solid #2f4553', opacity: 0.1 }}></div>

                {/* Pins - Visualization simplified */}
                <div style={{ marginTop: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    {Array(rows).fill(0).map((_, r) => (
                        <div key={r} style={{ display: 'flex', gap: '30px' }}>
                            {Array(r + 3).fill(0).map((__, c) => (
                                <div key={c} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }}></div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Multipliers */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
                    {multipliers.slice(4, 11).map((m, i) => (
                        <div key={i} style={{ padding: '4px 8px', borderRadius: '4px', background: m > 1 ? '#00e701' : '#ea3e3e', color: '#011e01', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {m}x
                        </div>
                    ))}
                </div>

                {/* Balls */}
                {balls.map(b => (
                    <div key={b.id} style={{
                        position: 'absolute',
                        top: `${(b.row * 30) + 50}px`,
                        left: `${b.left}%`,
                        width: '12px', height: '12px', borderRadius: '50%', background: '#ff0055',
                        boxShadow: '0 0 10px #ff0055',
                        transition: 'top 0.1s linear, left 0.1s linear'
                    }}></div>
                ))}
            </div>
        </div>
    );
};
