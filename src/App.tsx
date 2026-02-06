
import { useState } from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import { AuthModal } from './components/auth/AuthModal';
import { formatIndianNumber } from './utils/format';
import { LobbyScreen } from './components/LobbyScreen';
import { CrashGame } from './components/games/CrashGame';
import { DiceGame } from './components/games/DiceGame';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

import { MinesGame } from './components/games/MinesGame';
import { PlinkoGame } from './components/games/PlinkoGame';
import { LimboGame } from './components/games/LimboGame';

import { DragonTowerGame } from './components/games/DragonTowerGame';
import { HiLoGame } from './components/games/HiLoGame';
import { BlackjackGame } from './components/games/BlackjackGame';
import { RouletteGame } from './components/games/RouletteGame';
import { DiamondsGame } from './components/games/DiamondsGame';
import { WheelGame } from './components/games/WheelGame';
import { LudoGame } from './components/games/LudoGame';
import { GenericGamePlaceholder } from './components/games/GenericGamePlaceholder';
import { GAMES } from './data/games';

const GameController = () => {
  const { balance, activeGameId, joinGame, leaveGame, login } = useGame();
  const [view, setView] = useState<'HOME' | 'LOBBY'>('LOBBY');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);



  const handleJoin = (gameId: string) => {
    // Auth is now optional for playing
    joinGame(gameId);
  };

  const handleAuthSuccess = (method: 'phone' | 'email', value: string) => {
    login(method, value);
    setIsAuthModalOpen(false);
  };

  const handleBackToLobby = () => {
    leaveGame();
    setView('LOBBY');
  };

  let content;
  if (activeGameId === 'dice') {
    content = <DiceGame />;
  } else if (activeGameId === 'crash') {
    content = <CrashGame />;
  } else if (activeGameId === 'mines') {
    content = <MinesGame />;
  } else if (activeGameId === 'plinko') {
    content = <PlinkoGame />;
  } else if (activeGameId === 'limbo') {
    content = <LimboGame />;
  } else if (activeGameId === 'dragon_tower') {
    content = <DragonTowerGame />;
  } else if (activeGameId === 'blackjack') {
    content = <BlackjackGame />;
  } else if (activeGameId === 'hilo') {
    content = <HiLoGame />;
  } else if (activeGameId === 'roulette') {
    content = <RouletteGame />;
  } else if (activeGameId === 'diamonds') {
    content = <DiamondsGame />;
  } else if (activeGameId === 'wheel') {
    content = <WheelGame />;
  } else if (activeGameId === 'ludo') {
    content = <LudoGame />;
  } else if (activeGameId) {
    // Check if it's a known game from data
    const gameData = GAMES.find(g => g.id === activeGameId);
    if (gameData) {
      content = <GenericGamePlaceholder name={gameData.name} icon={gameData.icon} />;
    } else {
      content = (
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          <h2>Something went wrong</h2>
          <button className="btn-secondary" onClick={handleBackToLobby}>Back to Lobby</button>
        </div>
      );
    }
  } else if (view === 'LOBBY') {
    content = <LobbyScreen onJoin={handleJoin} />;
  } else {
    // Fallback to Lobby
    content = <LobbyScreen onJoin={handleJoin} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar - Stake Style */}
      <aside className="sidebar">
        <div style={{ padding: '0 0 24px 0', borderBottom: '1px solid #2f4553', cursor: 'pointer' }} onClick={() => setView('LOBBY')}>
          <h2 style={{ fontSize: '1.5rem', letterSpacing: '-0.05em' }}>TACTICASH</h2>
        </div>

        <nav style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-secondary" style={{ justifyContent: 'flex-start', background: '#2f4553', color: '#fff' }} onClick={() => setView('LOBBY')}>
            🎰 Casino
          </button>

        </nav>
      </aside>

      <main className="main-content">
        {/* Top Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: '32px',
          padding: '0 16px'
        }}>
          {/* Breadcrumb / Back Navigation */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {activeGameId && (
              <button
                onClick={handleBackToLobby}
                style={{ background: 'transparent', border: 'none', color: '#b1bad3', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                ← Back to Lobby
              </button>
            )}
          </div>

          <div style={{
            background: '#0f212e',
            padding: '8px 16px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid #2f4553'
          }}>
            <span style={{ color: '#b1bad3', fontSize: '0.9rem' }}>Wallet</span>
            <span style={{ color: '#00e701', fontWeight: 'bold' }}>₹{formatIndianNumber(balance, true)}</span>
            <button style={{
              background: '#1475e1',
              color: 'white',
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: '4px'
            }}>Wallet</button>
          </div>
        </header>

        {/* Dynamic Content */}
        {content}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <GameController />
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
