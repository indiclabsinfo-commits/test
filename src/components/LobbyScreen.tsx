import React, { useState, useRef, useCallback } from 'react';
import { GAMES, type Game } from '../data/games';
import { GameGlyph } from './ui/GameGlyph';

interface LobbyScreenProps {
    onJoin: (gameId: string) => void;
}

/* ─── Per-game crazy emoji art compositions ────────────────── */
const GameCardArt: React.FC<{ gameId: string }> = ({ gameId }) => {
    const arts: Record<string, React.ReactNode> = {
        ludo: (
            <div className="card-art">
                <span className="art-main">🎲</span>
                <span className="art-float art-1">🏆</span>
                <span className="art-float art-2">⭐</span>
                <span className="art-float art-3">💰</span>
                <span className="art-float art-4">🔥</span>
            </div>
        ),
        crash: (
            <div className="card-art">
                <span className="art-main">🚀</span>
                <span className="art-float art-1">💥</span>
                <span className="art-float art-2">📈</span>
                <span className="art-float art-3">⚡</span>
                <span className="art-float art-4">🌟</span>
            </div>
        ),
        mines: (
            <div className="card-art">
                <span className="art-main">💎</span>
                <span className="art-float art-1">💣</span>
                <span className="art-float art-2">💰</span>
                <span className="art-float art-3">✨</span>
                <span className="art-float art-4">🔥</span>
            </div>
        ),
        dice: (
            <div className="card-art">
                <span className="art-main">🎯</span>
                <span className="art-float art-1">🎲</span>
                <span className="art-float art-2">🎲</span>
                <span className="art-float art-3">💫</span>
                <span className="art-float art-4">⚡</span>
            </div>
        ),
        plinko: (
            <div className="card-art">
                <span className="art-main">🔮</span>
                <span className="art-float art-1">⭕</span>
                <span className="art-float art-2">🟡</span>
                <span className="art-float art-3">💜</span>
                <span className="art-float art-4">🌈</span>
            </div>
        ),
        limbo: (
            <div className="card-art">
                <span className="art-main">🌙</span>
                <span className="art-float art-1">⚡</span>
                <span className="art-float art-2">🔥</span>
                <span className="art-float art-3">💫</span>
                <span className="art-float art-4">✨</span>
            </div>
        ),
        keno: (
            <div className="card-art">
                <span className="art-main">🎰</span>
                <span className="art-float art-1">7️⃣</span>
                <span className="art-float art-2">🍀</span>
                <span className="art-float art-3">💰</span>
                <span className="art-float art-4">⭐</span>
            </div>
        ),
        blackjack: (
            <div className="card-art">
                <span className="art-main">🃏</span>
                <span className="art-float art-1">♠️</span>
                <span className="art-float art-2">♥️</span>
                <span className="art-float art-3">👑</span>
                <span className="art-float art-4">💰</span>
            </div>
        ),
        roulette: (
            <div className="card-art">
                <span className="art-main">🎡</span>
                <span className="art-float art-1">🔴</span>
                <span className="art-float art-2">⚫</span>
                <span className="art-float art-3">💰</span>
                <span className="art-float art-4">✨</span>
            </div>
        ),
        wheel: (
            <div className="card-art">
                <span className="art-main">🎡</span>
                <span className="art-float art-1">💎</span>
                <span className="art-float art-2">🌟</span>
                <span className="art-float art-3">🎪</span>
                <span className="art-float art-4">💰</span>
            </div>
        ),
        diamonds: (
            <div className="card-art">
                <span className="art-main">💎</span>
                <span className="art-float art-1">💎</span>
                <span className="art-float art-2">💎</span>
                <span className="art-float art-3">✨</span>
                <span className="art-float art-4">🔥</span>
            </div>
        ),
        dragon_tower: (
            <div className="card-art">
                <span className="art-main">🐉</span>
                <span className="art-float art-1">🏰</span>
                <span className="art-float art-2">🔥</span>
                <span className="art-float art-3">⚔️</span>
                <span className="art-float art-4">👑</span>
            </div>
        ),
        hilo: (
            <div className="card-art">
                <span className="art-main">🃏</span>
                <span className="art-float art-1">⬆️</span>
                <span className="art-float art-2">⬇️</span>
                <span className="art-float art-3">💰</span>
                <span className="art-float art-4">🔥</span>
            </div>
        ),
    };
    return <>{arts[gameId] || <div className="card-art"><span className="art-main">🎮</span></div>}</>;
};

/* ─── Game card gradient backgrounds ───────────────────────── */
type GameVisual = {
    gradient: string;
    glow: string;
    accentColor: string;
};

const GAME_VISUALS: Record<string, GameVisual> = {
    ludo: {
        gradient: 'radial-gradient(circle at 30% 20%, #ffd700 0%, transparent 50%), radial-gradient(circle at 70% 80%, #ff6b00 0%, transparent 50%), linear-gradient(135deg, #f59e0b 0%, #d97706 30%, #b45309 60%, #92400e 100%)',
        glow: 'radial-gradient(ellipse at 30% 20%, rgba(251,191,36,0.5) 0%, transparent 60%)',
        accentColor: '#fbbf24',
    },
    crash: {
        gradient: 'radial-gradient(circle at 20% 30%, #ff4444 0%, transparent 40%), radial-gradient(circle at 80% 70%, #ff8800 0%, transparent 40%), linear-gradient(135deg, #ef4444 0%, #dc2626 30%, #b91c1c 60%, #7f1d1d 100%)',
        glow: 'radial-gradient(ellipse at 70% 25%, rgba(248,113,113,0.5) 0%, transparent 60%)',
        accentColor: '#f87171',
    },
    mines: {
        gradient: 'radial-gradient(circle at 40% 20%, #34d399 0%, transparent 45%), radial-gradient(circle at 70% 80%, #059669 0%, transparent 45%), linear-gradient(135deg, #10b981 0%, #059669 30%, #047857 60%, #065f46 100%)',
        glow: 'radial-gradient(ellipse at 30% 30%, rgba(52,211,153,0.5) 0%, transparent 60%)',
        accentColor: '#34d399',
    },
    dice: {
        gradient: 'radial-gradient(circle at 30% 30%, #818cf8 0%, transparent 45%), radial-gradient(circle at 75% 75%, #4f46e5 0%, transparent 45%), linear-gradient(135deg, #6366f1 0%, #4f46e5 30%, #4338ca 60%, #3730a3 100%)',
        glow: 'radial-gradient(ellipse at 70% 20%, rgba(129,140,248,0.5) 0%, transparent 60%)',
        accentColor: '#818cf8',
    },
    plinko: {
        gradient: 'radial-gradient(circle at 25% 25%, #f472b6 0%, transparent 40%), radial-gradient(circle at 75% 75%, #a855f7 0%, transparent 40%), linear-gradient(135deg, #ec4899 0%, #d946ef 30%, #a855f7 60%, #7c3aed 100%)',
        glow: 'radial-gradient(ellipse at 30% 25%, rgba(244,114,182,0.5) 0%, transparent 60%)',
        accentColor: '#f472b6',
    },
    limbo: {
        gradient: 'radial-gradient(circle at 30% 20%, #fbbf24 0%, transparent 40%), radial-gradient(circle at 70% 80%, #f59e0b 0%, transparent 40%), linear-gradient(135deg, #f59e0b 0%, #d97706 40%, #92400e 100%)',
        glow: 'radial-gradient(ellipse at 60% 20%, rgba(251,146,60,0.5) 0%, transparent 60%)',
        accentColor: '#fb923c',
    },
    blackjack: {
        gradient: 'radial-gradient(circle at 30% 25%, #22c55e 0%, transparent 40%), radial-gradient(circle at 70% 75%, #15803d 0%, transparent 40%), linear-gradient(135deg, #166534 0%, #15803d 30%, #14532d 60%, #052e16 100%)',
        glow: 'radial-gradient(ellipse at 50% 20%, rgba(74,222,128,0.3) 0%, transparent 60%)',
        accentColor: '#4ade80',
    },
    keno: {
        gradient: 'radial-gradient(circle at 25% 30%, #38bdf8 0%, transparent 45%), radial-gradient(circle at 75% 70%, #0284c7 0%, transparent 45%), linear-gradient(135deg, #0ea5e9 0%, #0284c7 30%, #0369a1 60%, #075985 100%)',
        glow: 'radial-gradient(ellipse at 40% 20%, rgba(103,232,249,0.45) 0%, transparent 60%)',
        accentColor: '#67e8f9',
    },
    wheel: {
        gradient: 'radial-gradient(circle at 30% 20%, #c084fc 0%, transparent 40%), radial-gradient(circle at 70% 80%, #7c3aed 0%, transparent 40%), linear-gradient(135deg, #a78bfa 0%, #7c3aed 30%, #6d28d9 60%, #4c1d95 100%)',
        glow: 'radial-gradient(ellipse at 60% 25%, rgba(96,165,250,0.45) 0%, transparent 60%)',
        accentColor: '#60a5fa',
    },
    roulette: {
        gradient: 'radial-gradient(circle at 30% 30%, #ef4444 0%, transparent 40%), radial-gradient(circle at 70% 70%, #1a1a1a 0%, transparent 40%), linear-gradient(135deg, #dc2626 0%, #991b1b 30%, #450a0a 60%, #1a1a1a 100%)',
        glow: 'radial-gradient(ellipse at 30% 30%, rgba(248,113,113,0.4) 0%, transparent 55%)',
        accentColor: '#f87171',
    },
    diamonds: {
        gradient: 'radial-gradient(circle at 35% 25%, #67e8f9 0%, transparent 40%), radial-gradient(circle at 70% 75%, #06b6d4 0%, transparent 40%), linear-gradient(135deg, #22d3ee 0%, #06b6d4 30%, #0891b2 60%, #155e75 100%)',
        glow: 'radial-gradient(ellipse at 50% 20%, rgba(167,139,250,0.5) 0%, transparent 60%)',
        accentColor: '#a78bfa',
    },
    dragon_tower: {
        gradient: 'radial-gradient(circle at 25% 30%, #fb923c 0%, transparent 40%), radial-gradient(circle at 75% 70%, #ea580c 0%, transparent 40%), linear-gradient(135deg, #f97316 0%, #ea580c 30%, #c2410c 60%, #7c2d12 100%)',
        glow: 'radial-gradient(ellipse at 40% 20%, rgba(251,191,36,0.45) 0%, transparent 60%)',
        accentColor: '#fbbf24',
    },
    hilo: {
        gradient: 'radial-gradient(circle at 30% 25%, #a78bfa 0%, transparent 40%), radial-gradient(circle at 70% 75%, #6d28d9 0%, transparent 40%), linear-gradient(135deg, #8b5cf6 0%, #7c3aed 30%, #6d28d9 60%, #4c1d95 100%)',
        glow: 'radial-gradient(ellipse at 60% 25%, rgba(252,165,165,0.4) 0%, transparent 55%)',
        accentColor: '#fca5a5',
    },
};

/* ─── Category definitions ────────────────────────────────── */
const CATEGORIES = [
    {
        key: 'featured',
        title: 'Featured Games',
        filter: (g: Game) => g.badge === 'hot' || g.badge === 'live' || g.badge === 'featured',
    },
    {
        key: 'board',
        title: 'Board Games',
        filter: (g: Game) => g.category === 'board',
    },
    {
        key: 'originals',
        title: 'Casino Originals',
        filter: (g: Game) => g.category === 'originals',
    },
    {
        key: 'casino',
        title: 'Classic Casino',
        filter: (g: Game) => g.category === 'casino',
    },
];

/* ─── Horizontal scroll row ──────────────────────────────── */
const ScrollRow: React.FC<{
    title: string;
    games: Game[];
    onJoin: (id: string) => void;
}> = ({ title, games, onJoin }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const updateArrows = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }, []);

    const scroll = (dir: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const amount = el.clientWidth * 0.7;
        el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
        setTimeout(updateArrows, 350);
    };

    if (games.length === 0) return null;

    return (
        <section className="lobby-section">
            <div className="lobby-section-header">
                <h2 className="lobby-section-title">{title}</h2>
                <div className="lobby-section-actions">
                    <button
                        className={`lobby-scroll-btn${!canScrollLeft ? ' disabled' : ''}`}
                        onClick={() => scroll('left')}
                        aria-label="Scroll left"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <button
                        className={`lobby-scroll-btn${!canScrollRight ? ' disabled' : ''}`}
                        onClick={() => scroll('right')}
                        aria-label="Scroll right"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                </div>
            </div>
            <div
                className="lobby-scroll-row"
                ref={scrollRef}
                onScroll={updateArrows}
            >
                {games.map((game, i) => (
                    <GameCard key={game.id} game={game} index={i} onClick={() => onJoin(game.id)} />
                ))}
            </div>
        </section>
    );
};

/* ─── Hero banner ────────────────────────────────────────── */
const HeroBanner: React.FC<{ onJoin: (id: string) => void }> = ({ onJoin }) => {
    const featured = GAMES.filter(g => g.badge === 'hot' || g.badge === 'live' || g.badge === 'featured').slice(0, 3);
    const hero = featured[0] || GAMES[0];
    const heroVisual = GAME_VISUALS[hero.id];

    return (
        <div className="lobby-hero-v2" onClick={() => onJoin(hero.id)}>
            <div className="lobby-hero-bg" style={{ background: heroVisual?.gradient }} />
            <div className="lobby-hero-glow" style={{ background: heroVisual?.glow }} />
            <div className="hero-particles">
                {[...Array(8)].map((_, i) => (
                    <span key={i} className={`hero-particle p-${i}`} />
                ))}
            </div>
            <div className="lobby-hero-content">
                <div className="lobby-hero-icon-wrap">
                    <GameGlyph gameId={hero.id} className="lobby-hero-icon" style={{ color: '#fff' }} />
                </div>
                <div className="lobby-hero-text">
                    <div className="lobby-hero-badge-row">
                        {hero.badge && (
                            <span className={`game-card-badge ${hero.badge}`} style={{ position: 'static' }}>
                                {hero.badge === 'hot' ? 'HOT' : hero.badge === 'live' ? 'LIVE' : hero.badge === 'featured' ? 'FEATURED' : 'NEW'}
                            </span>
                        )}
                        <span className="lobby-hero-players">
                            <span className="live-dot" style={{ width: 8, height: 8 }} />
                            {hero.playing.toLocaleString()} playing
                        </span>
                    </div>
                    <h1 className="lobby-hero-title">{hero.name}</h1>
                    <p className="lobby-hero-desc">{hero.description}</p>
                    <button className="btn-primary lobby-hero-cta" onClick={(e) => { e.stopPropagation(); onJoin(hero.id); }}>
                        Play Now
                    </button>
                </div>
            </div>
            {/* Secondary featured cards */}
            {featured.length > 1 && (
                <div className="lobby-hero-secondary">
                    {featured.slice(1, 3).map(g => {
                        const v = GAME_VISUALS[g.id];
                        return (
                            <div
                                key={g.id}
                                className="lobby-hero-mini"
                                onClick={(e) => { e.stopPropagation(); onJoin(g.id); }}
                                style={{ background: v?.gradient }}
                            >
                                <div className="lobby-hero-mini-glow" style={{ background: v?.glow }} />
                                <GameGlyph gameId={g.id} className="lobby-hero-mini-icon" style={{ color: 'rgba(255,255,255,0.9)' }} />
                                <div className="lobby-hero-mini-info">
                                    <span className="lobby-hero-mini-name">{g.name}</span>
                                    {g.badge && (
                                        <span className={`game-card-badge ${g.badge}`} style={{ position: 'static', fontSize: '0.55rem', padding: '1px 6px' }}>
                                            {g.badge === 'hot' ? 'HOT' : g.badge === 'live' ? 'LIVE' : g.badge === 'featured' ? 'FEATURED' : 'NEW'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ─── Main lobby ─────────────────────────────────────────── */
export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onJoin }) => {
    const [search, setSearch] = useState('');

    // If searching, show flat filtered grid
    const isSearching = search.trim().length > 0;
    const searchResults = isSearching
        ? GAMES.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
        : [];

    return (
        <div className="lobby-root">
            {/* Search bar */}
            <div className="lobby-search-bar">
                <svg className="lobby-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    className="lobby-search-input"
                    placeholder="Search games..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button className="lobby-search-clear" onClick={() => setSearch('')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {isSearching ? (
                /* Search results grid */
                <>
                    <h2 className="lobby-section-title" style={{ marginBottom: 16 }}>
                        Results for "{search}" ({searchResults.length})
                    </h2>
                    <div className="lobby-search-grid">
                        {searchResults.map((game, i) => (
                            <GameCard key={game.id} game={game} index={i} onClick={() => onJoin(game.id)} />
                        ))}
                    </div>
                    {searchResults.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                            No games found
                        </div>
                    )}
                </>
            ) : (
                /* Normal lobby with hero + scrolling sections */
                <>
                    <HeroBanner onJoin={onJoin} />
                    {CATEGORIES.map(cat => {
                        const games = GAMES.filter(cat.filter);
                        return (
                            <ScrollRow
                                key={cat.key}
                                title={cat.title}
                                games={games}
                                onJoin={onJoin}
                            />
                        );
                    })}
                </>
            )}
        </div>
    );
};

/* ─── Game card component ────────────────────────────────── */
const GameCard: React.FC<{ game: Game; index: number; onClick: () => void }> = ({ game, index, onClick }) => {
    const visual = GAME_VISUALS[game.id];
    const fallbackGradient = `linear-gradient(135deg, ${game.color}cc 0%, ${game.color}88 100%)`;

    return (
        <div
            className="game-card-v2"
            onClick={onClick}
            style={{ animationDelay: `${index * 0.04}s` }}
        >
            {/* Thumbnail area with gradient */}
            <div
                className="game-card-v2-thumb"
                style={{ background: visual?.gradient || fallbackGradient }}
            >
                {/* Ambient glow */}
                <div className="game-card-v2-glow" style={{ background: visual?.glow || 'none' }} />

                {/* Decorative pattern overlay */}
                <div className="game-card-v2-pattern" />

                {/* Centered game art */}
                <div className="game-card-v2-icon-wrap">
                    <GameCardArt gameId={game.id} />
                </div>

                {/* Badge */}
                {game.badge && (
                    <span className={`game-card-badge ${game.badge}`}>
                        {game.badge === 'hot' ? 'HOT' : game.badge === 'new' ? 'NEW' : game.badge === 'featured' ? 'FEATURED' : 'LIVE'}
                    </span>
                )}

                {/* Bottom gradient fade for title readability */}
                <div className="game-card-v2-fade" />

                {/* Game title overlaid on thumbnail */}
                <div className="game-card-v2-overlay-title">{game.name}</div>
            </div>

            {/* Info bar below */}
            <div className="game-card-v2-info">
                <span className="game-card-v2-desc">{game.description}</span>
                <span className="game-card-v2-players">
                    <span className="live-dot" style={{ width: 6, height: 6 }} />
                    {game.playing.toLocaleString()}
                </span>
            </div>
        </div>
    );
};
