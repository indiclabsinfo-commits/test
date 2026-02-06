import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';

// Simple placeholder for card/slot games to ensure "all games work"
export const GenericGamePlaceholder: React.FC<{ name: string, icon: string }> = ({ name, icon }) => {
    const { placeBet, collectWinnings } = useGame();
    const [betAmount, setBetAmount] = useState(10);
    const [status, setStatus] = useState('IDLE');
    const [result, setResult] = useState('');

    const play = () => {
        if (!placeBet(betAmount)) return alert("Insufficient funds");
        setStatus('PLAYING');
        setResult('');

        setTimeout(() => {
            // 48% win chance for placeholder
            const win = Math.random() > 0.52;
            if (win) {
                collectWinnings(betAmount * 2);
                setResult('WIN');
            } else {
                setResult('LOSS');
            }
            setStatus('IDLE');
        }, 1000);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', width: '100%', height: '100%' }}>
            <div className="stake-card" style={{ padding: '16px', height: 'fit-content' }}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#b1bad3' }}>Bet Amount</label>
                    <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                        style={{ width: '100%', background: '#0f212e', border: 'none', color: 'white', padding: '8px', borderRadius: '4px' }} />
                </div>
                <button className="btn-primary" onClick={play} disabled={status === 'PLAYING'} style={{ width: '100%', padding: '16px' }}>
                    {status === 'PLAYING' ? 'Playing...' : 'Bet'}
                </button>
            </div>

            <div className="game-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div style={{ fontSize: '6rem', marginBottom: '24px' }}>{icon}</div>
                <h2>{name}</h2>
                {status === 'PLAYING' && <div className="spinner">🎲</div>}
                {result === 'WIN' && <div style={{ color: '#00e701', fontSize: '2rem' }}>YOU WON!</div>}
                {result === 'LOSS' && <div style={{ color: '#ea3e3e', fontSize: '2rem' }}>YOU LOST</div>}
            </div>
        </div>
    );
};
