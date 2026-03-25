import { useEffect, useState, type ReactNode } from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import { AuthModal } from './components/auth/AuthModal';
import { WalletModal } from './components/wallet/WalletModal';
import { formatIndianNumber } from './utils/format';
import { LobbyScreen } from './components/LobbyScreen';
import { CrashGame } from './components/games/CrashGame';
import { DiceGame } from './components/games/DiceGame';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

import { MinesGame } from './components/games/MinesGame';
import { PlinkoGame } from './components/games/PlinkoGame';
import { LimboGame } from './components/games/LimboGame';
import { KenoGame } from './components/games/KenoGame';

import { DragonTowerGame } from './components/games/DragonTowerGame';
import { HiLoGame } from './components/games/HiLoGame';
import { BlackjackGame } from './components/games/BlackjackGame';
import { RouletteGame } from './components/games/RouletteGame';
import { DiamondsGame } from './components/games/DiamondsGame';
import { WheelGame } from './components/games/WheelGame';
import { LudoGame } from './components/games/LudoGame';
import { GenericGamePlaceholder } from './components/games/GenericGamePlaceholder';
import { GameGlyph } from './components/ui/GameGlyph';
import { GAMES } from './data/games';
import { AgentPortal } from './pages/AgentPortal';
import { AdminPortal } from './pages/AdminPortal';

const SIDEBAR_CATEGORIES = [
  {
    label: 'Board Games',
    key: 'board',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
  },
  {
    label: 'Originals',
    key: 'originals',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: 'Casino',
    key: 'casino',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M6 12h12" />
      </svg>
    ),
  },
];

const GameController = () => {
  const { isDemoMode, activeBalance, toggleDemoMode, activeGameId, joinGame, leaveGame, login, register, isAuthenticated, user } = useGame();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); // Auth disabled for testing
  // Override: never show auth modal
  const _setIsAuthModalOpen = (_v: boolean) => {}; // no-op
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [walletInitialDepositMethod, setWalletInitialDepositMethod] = useState<'select' | 'agent' | 'qr' | 'crypto'>('select');
  const [walletAutoQRAmountInr, setWalletAutoQRAmountInr] = useState<number | undefined>(undefined);
  const [notices, setNotices] = useState<Array<{ id: string; title: string; message: string }>>([]);

  const handleJoin = (gameId: string) => {
    // DEV: skip auth check for local testing
    // if (!isAuthenticated) {
    //   _setIsAuthModalOpen(true);
    //   return;
    // }
    joinGame(gameId);
  };

  const handleAuthSuccess = async (payload: { mode: 'login' | 'register'; username: string; password: string }) => {
    if (payload.mode === 'register') {
      await register(payload.username, payload.password);
      // Prompt immediate recharge after successful registration.
      setWalletInitialTab('deposit');
      setWalletInitialDepositMethod('qr');
      setWalletAutoQRAmountInr(100);
      setIsWalletOpen(true);
    } else {
      await login(payload.username, payload.password);
    }
    setIsAuthModalOpen(false);
  };

  const handleBackToLobby = () => {
    leaveGame();
  };

  useEffect(() => {
    let mounted = true;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/notices/active`)
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        setNotices(Array.isArray(data?.notices) ? data.notices.slice(0, 3) : []);
      })
      .catch(() => {
        if (mounted) setNotices([]);
      });
    return () => { mounted = false; };
  }, []);

  const gameMap: Record<string, ReactNode> = {
    dice: <DiceGame />,
    crash: <CrashGame />,
    mines: <MinesGame />,
    plinko: <PlinkoGame />,
    limbo: <LimboGame />,
    dragon_tower: <DragonTowerGame />,
    blackjack: <BlackjackGame />,
    hilo: <HiLoGame />,
    roulette: <RouletteGame />,
    diamonds: <DiamondsGame />,
    wheel: <WheelGame />,
    keno: <KenoGame />,
    ludo: <LudoGame />,
  };

  let content;
  if (activeGameId && gameMap[activeGameId]) {
    content = gameMap[activeGameId];
  } else if (activeGameId) {
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
  } else {
    content = <LobbyScreen onJoin={handleJoin} />;
  }

  const activeGameData = activeGameId ? GAMES.find(g => g.id === activeGameId) : null;
  const isLudoActive = activeGameId === 'ludo';

  return (
    <div className={`app-layout${activeGameId ? ' game-active' : ''}${isLudoActive ? ' ludo-focus' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar${sidebarExpanded ? ' expanded' : ''}`}>
        {/* Mobile hamburger */}
        <button
          className="sidebar-hamburger"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>

        {/* Logo */}
        <div className="sidebar-header" onClick={() => { handleBackToLobby(); setSidebarExpanded(false); }}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">G</div>
            <h2>GHOST<span className="text-green">CASINO</span></h2>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* Home button */}
          <button
            className={`sidebar-item sidebar-home${!activeGameId ? ' active' : ''}`}
            onClick={() => { handleBackToLobby(); setSidebarExpanded(false); }}
          >
            <span className="sidebar-item-icon" style={{ color: 'var(--accent-green)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span>Home</span>
          </button>

          {SIDEBAR_CATEGORIES.map(cat => {
            const catGames = GAMES.filter(g => g.category === cat.key);
            return (
              <div key={cat.key}>
                <div className="sidebar-section">
                  <div className="sidebar-section-title">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </div>
                </div>
                {catGames.map(game => (
                  <button
                    key={game.id}
                    className={`sidebar-item${activeGameId === game.id ? ' active' : ''}`}
                    onClick={() => { handleJoin(game.id); setSidebarExpanded(false); }}
                  >
                    <span className="sidebar-item-icon" style={{ color: game.color }}>
                      <GameGlyph gameId={game.id} />
                    </span>
                    <span>{game.name}</span>
                    <span className="sidebar-item-players">
                      <span className="live-dot" style={{ width: 6, height: 6, display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
                      {game.playing.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!isAuthenticated ? (
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => _setIsAuthModalOpen(true)}>
              Sign In
            </button>
          ) : (
            <div className="sidebar-user">
              <div className="sidebar-avatar">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.username}
                </div>
                <div className="wallet-balance" style={{ fontSize: '0.8rem' }}>
                  {formatIndianNumber(activeBalance)}
                  {isDemoMode && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 4 }}>DEMO</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className={`main-content${isLudoActive ? ' ludo-focus-main' : ''}`}>
        {/* Header */}
        <header className="app-header">
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {activeGameId && (
              <button className="header-back" onClick={handleBackToLobby}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span className="header-back-lobby" style={{ color: 'var(--text-muted)' }}>Lobby</span>
                {activeGameData && (
                  <>
                    <span className="header-back-divider" style={{ color: 'var(--text-muted)', margin: '0 2px' }}>/</span>
                    <span className="header-back-game" style={{ color: 'var(--text-primary)' }}>{activeGameData.name}</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {isAuthenticated && (
              <div
                className={`demo-toggle${!isDemoMode ? ' real-mode' : ''}`}
                onClick={toggleDemoMode}
                title={isDemoMode ? 'Switch to Real Money' : 'Switch to Demo Mode'}
              >
                <span>{isDemoMode ? 'DEMO' : 'REAL'}</span>
                <div className="demo-toggle-indicator" />
              </div>
            )}
            <div className="wallet-display">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span className="wallet-balance">${formatIndianNumber(activeBalance, true)}</span>
              {isAuthenticated ? (
                <button
                  className="wallet-btn"
                  onClick={() => {
                    setWalletInitialTab('deposit');
                    setWalletInitialDepositMethod('qr');
                    setWalletAutoQRAmountInr(undefined);
                    setIsWalletOpen(true);
                  }}
                >
                  Recharge
                </button>
              ) : (
                <button className="wallet-btn" onClick={() => _setIsAuthModalOpen(true)}>
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        {notices.length > 0 && (
          <div className="notice-strip">
            {notices.map(n => (
              <span key={n.id} className="notice-item">
                <strong>{n.title}:</strong> {n.message}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        {content}
      </main>

      {/* Auth modal disabled for local testing */}
      {/* <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      /> */}

      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        initialTab={walletInitialTab}
        initialDepositMethod={walletInitialDepositMethod}
        autoQRAmountInr={walletAutoQRAmountInr}
      />
    </div>
  );
};

function App() {
  // Agent portal on /agent path
  if (window.location.pathname === '/agent') {
    return (
      <ErrorBoundary>
        <AgentPortal />
      </ErrorBoundary>
    );
  }

  // Master admin portal on /admin path
  if (window.location.pathname === '/admin') {
    return (
      <ErrorBoundary>
        <AdminPortal />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GameProvider>
        <GameController />
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
