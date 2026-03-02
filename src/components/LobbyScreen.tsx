import React, { useState } from 'react';
import { GAMES, type Game } from '../data/games';
import { GameGlyph } from './ui/GameGlyph';

interface LobbyScreenProps {
    onJoin: (gameId: string) => void;
}

const TABS = [
    { key: 'all', label: 'All Games' },
    { key: 'originals', label: 'Originals' },
    { key: 'casino', label: 'Casino' },
    { key: 'board', label: 'Board Games' },
];

type GameVisual = {
    image: string;
    pattern: string;
    shell: string;
    shellBorder: string;
    shellRadius: string;
    iconColor: string;
};

const GAME_VISUALS: Record<string, GameVisual> = {
    ludo: {
        image: 'linear-gradient(145deg, #4f5538 0%, #7d742b 100%)',
        pattern: 'radial-gradient(circle at 20% 15%, rgba(255, 226, 117, 0.35), transparent 55%)',
        shell: 'linear-gradient(160deg, rgba(255, 226, 117, 0.24), rgba(255, 255, 255, 0.05))',
        shellBorder: 'rgba(255, 226, 117, 0.55)',
        shellRadius: '24px',
        iconColor: '#ffd95a',
    },
    crash: {
        image: 'linear-gradient(145deg, #435248 0%, #61663a 100%)',
        pattern: 'linear-gradient(120deg, rgba(255,255,255,0.14), transparent 32%, rgba(255,230,132,0.14) 68%, transparent)',
        shell: 'linear-gradient(160deg, rgba(255, 211, 102, 0.2), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(255, 214, 102, 0.45)',
        shellRadius: '20px',
        iconColor: '#ffd24a',
    },
    mines: {
        image: 'linear-gradient(145deg, #244069 0%, #2b5286 100%)',
        pattern: 'radial-gradient(circle at 78% 18%, rgba(128, 198, 255, 0.33), transparent 52%)',
        shell: 'linear-gradient(160deg, rgba(69, 129, 255, 0.28), rgba(255, 255, 255, 0.04))',
        shellBorder: 'rgba(130, 181, 255, 0.5)',
        shellRadius: '24px',
        iconColor: '#4a8cff',
    },
    dice: {
        image: 'linear-gradient(145deg, #5c2d43 0%, #6f1e3a 100%)',
        pattern: 'radial-gradient(circle at 82% 20%, rgba(255, 115, 176, 0.32), transparent 55%)',
        shell: 'linear-gradient(160deg, rgba(255, 89, 153, 0.26), rgba(255, 255, 255, 0.04))',
        shellBorder: 'rgba(255, 120, 175, 0.5)',
        shellRadius: '16px',
        iconColor: '#ff4f8f',
    },
    plinko: {
        image: 'linear-gradient(145deg, #63376b 0%, #792b63 100%)',
        pattern: 'radial-gradient(circle at 76% 18%, rgba(255, 124, 227, 0.33), transparent 52%)',
        shell: 'linear-gradient(160deg, rgba(255, 71, 187, 0.24), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(255, 119, 206, 0.52)',
        shellRadius: '26px',
        iconColor: '#ff4ab7',
    },
    limbo: {
        image: 'linear-gradient(145deg, #78644a 0%, #9a6f2a 100%)',
        pattern: 'linear-gradient(125deg, rgba(255, 170, 73, 0.25), transparent 40%, rgba(255,255,255,0.08))',
        shell: 'linear-gradient(160deg, rgba(255, 170, 73, 0.25), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(255, 173, 79, 0.56)',
        shellRadius: '28px',
        iconColor: '#ffa54a',
    },
    blackjack: {
        image: 'linear-gradient(145deg, #5e3447 0%, #61222d 100%)',
        pattern: 'radial-gradient(circle at 22% 18%, rgba(255, 107, 107, 0.25), transparent 48%)',
        shell: 'linear-gradient(160deg, rgba(255, 99, 99, 0.24), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(255, 128, 128, 0.52)',
        shellRadius: '20px',
        iconColor: '#ff5959',
    },
    keno: {
        image: 'linear-gradient(145deg, #254e3f 0%, #2c6a38 100%)',
        pattern: 'radial-gradient(circle at 80% 20%, rgba(126, 255, 138, 0.28), transparent 50%)',
        shell: 'linear-gradient(160deg, rgba(113, 221, 89, 0.22), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(147, 228, 110, 0.5)',
        shellRadius: '24px',
        iconColor: '#78db5f',
    },
    wheel: {
        image: 'linear-gradient(145deg, #2f596f 0%, #316784 100%)',
        pattern: 'radial-gradient(circle at 24% 16%, rgba(142, 222, 255, 0.28), transparent 52%)',
        shell: 'linear-gradient(160deg, rgba(94, 186, 229, 0.25), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(126, 204, 240, 0.5)',
        shellRadius: '22px',
        iconColor: '#66c8f4',
    },
    roulette: {
        image: 'linear-gradient(145deg, #1e553a 0%, #2d7040 100%)',
        pattern: 'radial-gradient(circle at 76% 20%, rgba(140, 255, 149, 0.24), transparent 52%)',
        shell: 'linear-gradient(160deg, rgba(84, 193, 98, 0.24), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(109, 206, 122, 0.52)',
        shellRadius: '50%',
        iconColor: '#63c874',
    },
    diamonds: {
        image: 'linear-gradient(145deg, #3f3a79 0%, #533094 100%)',
        pattern: 'radial-gradient(circle at 72% 20%, rgba(173, 137, 255, 0.3), transparent 52%)',
        shell: 'linear-gradient(160deg, rgba(156, 113, 255, 0.26), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(177, 141, 255, 0.55)',
        shellRadius: '18px',
        iconColor: '#9f6eff',
    },
    dragon_tower: {
        image: 'linear-gradient(145deg, #56524a 0%, #735437 100%)',
        pattern: 'radial-gradient(circle at 28% 20%, rgba(255, 181, 93, 0.26), transparent 52%)',
        shell: 'linear-gradient(160deg, rgba(255, 161, 73, 0.24), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(255, 177, 112, 0.52)',
        shellRadius: '20px',
        iconColor: '#ffad5f',
    },
    hilo: {
        image: 'linear-gradient(145deg, #654245 0%, #6f2a24 100%)',
        pattern: 'radial-gradient(circle at 24% 20%, rgba(255, 120, 120, 0.25), transparent 52%)',
        shell: 'linear-gradient(160deg, rgba(255, 112, 112, 0.24), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(255, 138, 138, 0.54)',
        shellRadius: '18px',
        iconColor: '#ff6969',
    },
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onJoin }) => {
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    const filteredGames = GAMES.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase());
        const matchesTab = activeTab === 'all' || g.category === activeTab;
        return matchesSearch && matchesTab;
    });

    return (
        <div style={{ width: '100%', maxWidth: '1200px' }}>
            {/* Hero Banner */}
            <div className="lobby-hero">
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.03em' }}>
                        Play. Bet. <span className="text-green">Win.</span>
                    </h1>
                    <p style={{ fontSize: '0.95rem', maxWidth: '500px' }}>
                        Premium casino games with provably fair outcomes. No real money — just pure fun.
                    </p>
                </div>
            </div>

            {/* Search + Tabs Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {/* Tabs */}
                <div className="lobby-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`lobby-tab${activeTab === tab.key ? ' active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="input-group" style={{ width: '260px', flexShrink: 0 }}>
                    <span style={{ padding: '0 10px', color: 'var(--text-muted)', display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search games..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            padding: '10px 0',
                            outline: 'none',
                            width: '100%',
                            fontSize: '0.85rem'
                        }}
                    />
                </div>
            </div>

            {/* Featured Game - Ludo */}
            {activeTab === 'all' && !search && (
                <div
                    className="glass-card"
                    onClick={() => onJoin('ludo')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-8)',
                        padding: 'var(--space-6)',
                        marginBottom: 'var(--space-8)',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(255, 204, 0, 0.08) 0%, rgba(255, 153, 0, 0.05) 100%)',
                        borderColor: 'rgba(255, 204, 0, 0.15)'
                    }}
                >
                    <div className="featured-game-glyph">
                        <GameGlyph gameId="ludo" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: '4px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Ludo King</h3>
                            <span className="game-card-badge hot" style={{ position: 'static' }}>Featured</span>
                        </div>
                        <p style={{ fontSize: '0.85rem' }}>
                            Multiplayer board game with real-time betting. Roll the dice, capture opponents, and race to finish!
                        </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>
                            <span className="live-dot" style={{ width: 6, height: 6 }} />
                            450 playing
                        </div>
                        <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); onJoin('ludo'); }}>
                            Play Now
                        </button>
                    </div>
                </div>
            )}

            {/* Games Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-12)'
            }}>
                {filteredGames.map((game, i) => (
                    <GameCard key={game.id} game={game} index={i} onClick={() => onJoin(game.id)} />
                ))}
            </div>

            {filteredGames.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1rem' }}>No games found</p>
                </div>
            )}
        </div>
    );
};

const GameCard: React.FC<{ game: Game; index: number; onClick: () => void }> = ({ game, index, onClick }) => {
    const visual = GAME_VISUALS[game.id] || {
        image: `linear-gradient(135deg, ${game.color}20 0%, ${game.color}88 100%)`,
        pattern: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2), transparent 55%)',
        shell: 'linear-gradient(160deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.03))',
        shellBorder: 'rgba(255, 255, 255, 0.5)',
        shellRadius: '20px',
        iconColor: game.color,
    };

    return (
        <div
            className="game-card"
            onClick={onClick}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {/* Card Image */}
            <div
                className="game-card-image"
                style={{ background: visual.image }}
            >
                <div className="game-card-pattern" style={{ background: visual.pattern }} />
                <div
                    className="game-card-icon-shell"
                    style={{
                        background: visual.shell,
                        borderColor: visual.shellBorder,
                        borderRadius: visual.shellRadius,
                    }}
                >
                    <GameGlyph gameId={game.id} className="game-card-icon-svg" style={{ color: visual.iconColor }} />
                </div>
                {game.badge && (
                    <span className={`game-card-badge ${game.badge}`}>
                        {game.badge === 'hot' ? 'HOT' : game.badge === 'new' ? 'NEW' : 'LIVE'}
                    </span>
                )}
            </div>

            {/* Card Info */}
            <div className="game-card-info">
                <div className="game-card-name">{game.name}</div>
                <div className="game-card-meta">
                    <span>{game.description}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="live-dot" style={{ width: 6, height: 6 }} />
                        {game.playing.toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
};
