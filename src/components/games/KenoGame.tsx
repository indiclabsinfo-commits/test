import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { formatIndianNumber } from '../../utils/format';

interface KenoResult {
  won?: boolean;
  payout?: number;
  matchCount?: number;
  multiplier?: number;
  matches?: number[];
  drawnNumbers?: number[];
}

export const KenoGame: React.FC = () => {
  const { placeBet, balance } = useGame();

  const [betAmount, setBetAmount] = useState(10);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<KenoResult | null>(null);
  const [clientSeed, setClientSeed] = useState(() => Math.random().toString(36).substring(2, 15));
  const [drawPreview, setDrawPreview] = useState<number[]>([]);

  useEffect(() => {
    if (!isPlaying) {
      setDrawPreview([]);
      return;
    }

    const timer = setInterval(() => {
      const nums: number[] = [];
      while (nums.length < 12) {
        const n = Math.floor(Math.random() * 80) + 1;
        if (!nums.includes(n)) nums.push(n);
      }
      setDrawPreview(nums);
    }, 120);

    return () => clearInterval(timer);
  }, [isPlaying]);

  const toggleNumber = (num: number) => {
    if (isPlaying) return;

    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
    } else if (selectedNumbers.length < 10) {
      setSelectedNumbers(prev => [...prev, num]);
    }
  };

  const quickPick = (count: number) => {
    if (isPlaying) return;
    const picked: number[] = [];
    while (picked.length < count) {
      const n = Math.floor(Math.random() * 80) + 1;
      if (!picked.includes(n)) picked.push(n);
    }
    setSelectedNumbers(picked);
  };

  const clearNumbers = () => {
    if (isPlaying) return;
    setSelectedNumbers([]);
    setLastResult(null);
  };

  const handleBet = async () => {
    if (selectedNumbers.length === 0 || selectedNumbers.length > 10) return;
    if (balance < betAmount) return;

    setIsPlaying(true);
    try {
      const result = await placeBet(betAmount, {
        game: 'keno',
        clientSeed,
        selectedNumbers,
        betId: `keno_${Date.now()}`
      });

      if (result) {
        setLastResult(result as KenoResult);
        setClientSeed(Math.random().toString(36).substring(2, 15));
      }
    } catch (err) {
      console.error('Keno bet error:', err);
    } finally {
      setIsPlaying(false);
    }
  };

  const numbers = useMemo(() => Array.from({ length: 80 }, (_, i) => i + 1), []);

  return (
    <div className="game-shell game-layout-two game-theme-keno">
      <div className="stake-card game-panel">
        <div style={{ marginBottom: '16px' }}>
          <div className="game-section-title">Bet Amount</div>
          <div className="bet-input-row">
            <input
              type="number"
              value={betAmount}
              min={1}
              max={balance}
              disabled={isPlaying}
              onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
            />
            <span style={{ color: '#b1bad3' }}>₹</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          <button className="btn-secondary" onClick={() => quickPick(5)} disabled={isPlaying}>Quick 5</button>
          <button className="btn-secondary" onClick={() => quickPick(10)} disabled={isPlaying}>Quick 10</button>
          <button className="btn-secondary" onClick={clearNumbers} disabled={isPlaying}>Clear</button>
        </div>

        <div className="game-stat-block" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b1bad3', marginBottom: '6px' }}>
            <span>Selected</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>{selectedNumbers.length}/10</span>
          </div>
          <div style={{ color: '#7f93a8', fontSize: '0.8rem', wordBreak: 'break-all' }}>
            Seed: {clientSeed}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleBet}
          disabled={isPlaying || selectedNumbers.length === 0 || balance < betAmount}
          style={{ width: '100%' }}
        >
          {isPlaying ? 'Drawing...' : `Bet ₹${formatIndianNumber(betAmount)}`}
        </button>

        {lastResult && (
          <div className="game-stat-block" style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '1rem', marginBottom: '8px', color: lastResult.won ? '#00e701' : '#ea3e3e', fontWeight: 800 }}>
              {lastResult.won ? `Won ₹${formatIndianNumber(lastResult.payout || 0)}` : 'No Match'}
            </div>
            <div style={{ color: '#b1bad3', marginBottom: '8px', fontSize: '0.9rem' }}>
              Matches: {lastResult.matchCount || 0} | Multiplier: {lastResult.multiplier || 0}x
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(lastResult.drawnNumbers || []).slice(0, 10).map((n) => (
                <span
                  key={n}
                  style={{
                    background: (lastResult.matches || []).includes(n) ? '#00e701' : '#2f4553',
                    color: (lastResult.matches || []).includes(n) ? '#001900' : '#fff',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="game-container game-stage" style={{ justifyContent: 'flex-start', gap: '14px' }}>
        <h2 style={{ marginBottom: '4px' }}>Keno</h2>
        <div style={{ color: '#b1bad3', fontSize: '0.9rem', marginBottom: '6px' }}>
          Pick up to 10 numbers. More matches means higher payout.
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div style={{
            minWidth: '520px',
            width: '100%',
            maxWidth: '760px',
            display: 'grid',
            gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
            gap: '7px'
          }}>
            {numbers.map((num) => {
              const isSelected = selectedNumbers.includes(num);
              const isMatch = (lastResult?.matches || []).includes(num);
              const isPreview = isPlaying && drawPreview.includes(num);

              return (
                <button
                  key={num}
                  onClick={() => toggleNumber(num)}
                  disabled={isPlaying}
                  style={{
                    background: isMatch ? '#00e701' : isSelected ? '#1475e1' : isPreview ? '#27435f' : '#0f212e',
                    color: isMatch ? '#001900' : '#fff',
                    border: isMatch ? '1px solid #63ff63' : '1px solid #2f4553',
                    borderRadius: '7px',
                    minHeight: '34px',
                    padding: '8px 4px',
                    fontWeight: isSelected || isMatch ? 700 : 500,
                    fontSize: '0.8rem',
                    boxShadow: isPreview ? '0 0 8px rgba(120, 168, 220, 0.35)' : 'none',
                    transition: 'all 0.12s ease'
                  }}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KenoGame;
