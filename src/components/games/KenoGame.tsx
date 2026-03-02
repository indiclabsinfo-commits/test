import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { formatIndianNumber } from '../../utils/format';

export const KenoGame: React.FC = () => {
  const { placeBet, balance } = useGame();
  
  const [betAmount, setBetAmount] = useState(10);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [clientSeed, setClientSeed] = useState(() => {
    return Math.random().toString(36).substring(2, 15);
  });

  const toggleNumber = (num: number) => {
    if (isPlaying) return;
    
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
    } else if (selectedNumbers.length < 10) {
      setSelectedNumbers(prev => [...prev, num]);
    }
  };

  const quickPick = () => {
    if (isPlaying) return;
    const numbers: number[] = [];
    while (numbers.length < 5) {
      const n = Math.floor(Math.random() * 80) + 1;
      if (!numbers.includes(n)) numbers.push(n);
    }
    setSelectedNumbers(numbers);
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
        setLastResult(result);
        setClientSeed(Math.random().toString(36).substring(2, 15));
      }
    } catch (err) {
      console.error('Keno bet error:', err);
    } finally {
      setIsPlaying(false);
    }
  };

  const numbers = Array.from({ length: 80 }, (_, i) => i + 1);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Keno</h2>

      {/* Bet Amount */}
      <div style={{ 
        background: '#1a2c38', 
        padding: '16px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        <span>Bet Amount:</span>
        <input
          type="number"
          value={betAmount}
          min={1}
          max={balance}
          onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 0))}
          style={{
            background: '#0f212e',
            border: '1px solid #2f4553',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '100px'
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={quickPick}
          disabled={isPlaying}
          style={{
            background: '#2f4553',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: isPlaying ? 'not-allowed' : 'pointer'
          }}
        >
          Quick Pick
        </button>
        <button 
          onClick={clearNumbers}
          disabled={isPlaying}
          style={{
            background: '#ff4444',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: isPlaying ? 'not-allowed' : 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {/* Numbers Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(10, 1fr)', 
        gap: '4px',
        marginBottom: '20px'
      }}>
        {numbers.map((num) => {
          const isSelected = selectedNumbers.includes(num);
          const isMatch = lastResult?.matches?.includes(num);
          
          return (
            <button
              key={num}
              onClick={() => toggleNumber(num)}
              disabled={isPlaying}
              style={{
                background: isMatch ? '#00ff00' : isSelected ? '#1475e1' : '#0f212e',
                color: isMatch ? '#000' : isSelected ? '#fff' : '#b1bad3',
                border: isMatch ? '2px solid #00ff00' : '1px solid #2f4553',
                padding: '10px 5px',
                borderRadius: '4px',
                cursor: isPlaying ? 'not-allowed' : 'pointer',
                fontWeight: isSelected || isMatch ? 'bold' : 'normal'
              }}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Selected Count & Play Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: '#1a2c38',
        padding: '16px',
        borderRadius: '8px'
      }}>
        <div>
          <div>Selected: {selectedNumbers.length}/10</div>
          <div style={{ color: '#b1bad3', fontSize: '0.9rem' }}>
            Client Seed: {clientSeed}
          </div>
        </div>
        
        <button
          onClick={handleBet}
          disabled={isPlaying || selectedNumbers.length === 0 || balance < betAmount}
          style={{
            background: isPlaying ? '#2f4553' : '#00e701',
            color: isPlaying ? '#b1bad3' : '#000',
            border: 'none',
            padding: '12px 40px',
            borderRadius: '4px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: isPlaying || selectedNumbers.length === 0 || balance < betAmount ? 'not-allowed' : 'pointer'
          }}
        >
          {isPlaying ? 'Drawing...' : `Bet $${formatIndianNumber(betAmount)}`}
        </button>
      </div>

      {/* Result Display */}
      {lastResult && (
        <div style={{ 
          marginTop: '20px', 
          background: '#1a2c38', 
          padding: '16px', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>
            {lastResult.won ? (
              <span style={{ color: '#00e701' }}>🎉 You Won ${formatIndianNumber(lastResult.payout)}!</span>
            ) : (
              <span style={{ color: '#ff4444' }}>😔 No Match</span>
            )}
          </div>
          <div style={{ color: '#b1bad3' }}>
            Matches: {lastResult.matchCount} | Multiplier: {lastResult.multiplier}x
          </div>
          {lastResult.drawnNumbers && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span>Drawn:</span>
              {lastResult.drawnNumbers.slice(0, 10).map((n: number) => (
                <span key={n} style={{ 
                  background: selectedNumbers.includes(n) ? '#00ff00' : '#2f4553',
                  color: selectedNumbers.includes(n) ? '#000' : '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '0.8rem'
                }}>{n}</span>
              ))}
              <span>... +{lastResult.drawnNumbers.length - 10} more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KenoGame;
