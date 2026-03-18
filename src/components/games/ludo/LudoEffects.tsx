import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playPayoutTick } from '../../../utils/sound';
import './LudoEffects.css';

// ---- Device capability detection ----
const detectLowEnd = (): boolean => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 4) <= 2;
};
const IS_LOW_END = detectLowEnd();

// ---- Enhanced Confetti ----
// Full-screen confetti with mixed shapes, physics gravity + wind, 120+ particles

type ConfettiShape = 'circle' | 'square' | 'strip' | 'star';

export const EnhancedConfetti: React.FC<{ duration?: number }> = ({ duration = 4000 }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setVisible(false), duration);
        return () => clearTimeout(t);
    }, [duration]);

    const particles = useMemo(() => {
        const count = IS_LOW_END ? 40 : 120;
        return Array.from({ length: count }, (_, i) => {
            const shapes: ConfettiShape[] = ['circle', 'square', 'strip', 'star'];
            const colors = [
                '#FFD700', '#FF4500', '#00FF7F', '#00CED1', '#FF1493',
                '#7B68EE', '#FF6347', '#32CD32', '#FFB347', '#87CEEB',
                '#E040FB', '#00E676', '#FFAB40', '#448AFF',
            ];
            return {
                id: i,
                x: Math.random() * 100,
                delay: Math.random() * 0.8,
                duration: 2.0 + Math.random() * 2.0,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                size: 5 + Math.random() * 12,
                rotation: Math.random() * 1080 - 540,
                drift: (Math.random() - 0.5) * 160,
                // Wind effect -- some particles curve more
                windPhase: Math.random() * Math.PI * 2,
            };
        });
    }, []);

    if (!visible) return null;

    return (
        <div className="ludo-confetti-enhanced">
            {particles.map(p => (
                <div
                    key={p.id}
                    className={`confetti-piece confetti-${p.shape}`}
                    style={{
                        left: `${p.x}%`,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        background: p.color,
                        width: p.shape === 'strip' ? `${p.size * 0.3}px` : `${p.size}px`,
                        height: p.shape === 'strip' ? `${p.size * 2.5}px` : `${p.size}px`,
                        '--drift': `${p.drift}px`,
                        '--rotation': `${p.rotation}deg`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
};

// ---- Capture Explosion ----
// Multi-layer: flash ring, shockwave, particle shrapnel, smoke wisps

export const CaptureExplosion: React.FC<{
    color: string;
    x: number;
    y: number;
}> = ({ color, x, y }) => {
    const shardCount = IS_LOW_END ? 8 : 18;
    const shards = useMemo(() =>
        Array.from({ length: shardCount }, (_, i) => ({
            id: i,
            angle: (i / shardCount) * 360 + (Math.random() - 0.5) * 20,
            distance: 25 + Math.random() * 60,
            size: 3 + Math.random() * 7,
            delay: Math.random() * 0.08,
            // Some shards are elongated for variety
            isStrip: Math.random() > 0.6,
        }))
    , [shardCount]);

    // Smoke wisps -- slow-fading ghost particles
    const smokeCount = IS_LOW_END ? 0 : 6;
    const smokes = useMemo(() =>
        Array.from({ length: smokeCount }, (_, i) => ({
            id: i,
            angle: (i / smokeCount) * 360 + Math.random() * 60,
            distance: 15 + Math.random() * 30,
        }))
    , [smokeCount]);

    return (
        <div className="capture-explosion" style={{ left: x, top: y }}>
            {/* Central flash -- bright white burst */}
            <motion.div
                className="explosion-flash"
                style={{ background: '#fff' }}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 3.5, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
            />
            {/* Colored flash overlay */}
            <motion.div
                className="explosion-flash"
                style={{ background: color }}
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: 0.03 }}
            />
            {/* Shockwave ring expanding outward */}
            <motion.div
                className="explosion-ring"
                style={{ borderColor: color }}
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
            />
            {/* Second ring -- wider, slower */}
            {!IS_LOW_END && (
                <motion.div
                    className="explosion-ring"
                    style={{ borderColor: '#ffffff80' }}
                    initial={{ scale: 0, opacity: 0.5 }}
                    animate={{ scale: 6, opacity: 0 }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.08 }}
                />
            )}
            {/* Particle shards radiating outward */}
            {shards.map(s => (
                <motion.div
                    key={s.id}
                    className="explosion-shard"
                    style={{
                        width: s.isStrip ? s.size * 0.5 : s.size,
                        height: s.isStrip ? s.size * 2 : s.size,
                        background: color,
                        borderRadius: s.isStrip ? '1px' : '50%',
                    }}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    animate={{
                        x: Math.cos(s.angle * Math.PI / 180) * s.distance,
                        y: Math.sin(s.angle * Math.PI / 180) * s.distance + 15, // gravity pull
                        scale: 0,
                        opacity: 0,
                        rotate: s.isStrip ? s.angle : 0,
                    }}
                    transition={{
                        duration: 0.55,
                        delay: s.delay,
                        ease: 'easeOut',
                    }}
                />
            ))}
            {/* Smoke wisps -- slow ghostly fade */}
            {smokes.map(s => (
                <motion.div
                    key={`smoke-${s.id}`}
                    className="explosion-shard"
                    style={{
                        width: 12,
                        height: 12,
                        background: `${color}40`,
                        borderRadius: '50%',
                        filter: 'blur(4px)',
                    }}
                    initial={{ x: 0, y: 0, scale: 0.5, opacity: 0.6 }}
                    animate={{
                        x: Math.cos(s.angle * Math.PI / 180) * s.distance,
                        y: Math.sin(s.angle * Math.PI / 180) * s.distance - 20,
                        scale: 2,
                        opacity: 0,
                    }}
                    transition={{
                        duration: 0.9,
                        delay: 0.1,
                        ease: 'easeOut',
                    }}
                />
            ))}
        </div>
    );
};

// ---- Home Entry Celebration ----
// Golden burst + ascending sparkle rings + particle fountain

export const HomeEntryCelebration: React.FC<{
    x: number;
    y: number;
}> = ({ x, y }) => {
    const sparkleCount = IS_LOW_END ? 10 : 24;
    const sparkles = useMemo(() =>
        Array.from({ length: sparkleCount }, (_, i) => ({
            id: i,
            angle: (i / sparkleCount) * 360 + Math.random() * 15,
            distance: 20 + Math.random() * 50,
            size: 2 + Math.random() * 6,
            delay: Math.random() * 0.3,
            yDrift: -(30 + Math.random() * 100),
            // Some sparkles are golden, some white
            isGold: Math.random() > 0.3,
        }))
    , [sparkleCount]);

    // Ascending ring effects
    const rings = IS_LOW_END ? [] : [0, 1, 2];

    return (
        <div className="home-celebration" style={{ left: x, top: y }}>
            {/* Golden burst ring */}
            <motion.div
                className="home-burst"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            {/* Ascending sparkle rings */}
            {rings.map(i => (
                <motion.div
                    key={`ring-${i}`}
                    className="explosion-ring"
                    style={{ borderColor: '#FFD70080', borderWidth: 2 }}
                    initial={{ scale: 0, opacity: 0.6, y: 0 }}
                    animate={{ scale: 3 + i, opacity: 0, y: -(20 + i * 25) }}
                    transition={{ duration: 0.8, delay: i * 0.12, ease: 'easeOut' }}
                />
            ))}
            {/* Ascending sparkle particles -- fountain */}
            {sparkles.map(s => (
                <motion.div
                    key={s.id}
                    className="home-sparkle"
                    style={{
                        width: s.size,
                        height: s.size,
                        background: s.isGold ? '#FFD700' : '#fff',
                        boxShadow: s.isGold
                            ? '0 0 8px #FFD700, 0 0 16px rgba(255, 215, 0, 0.5)'
                            : '0 0 6px #fff, 0 0 12px rgba(255, 255, 255, 0.4)',
                    }}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    animate={{
                        x: Math.cos(s.angle * Math.PI / 180) * s.distance,
                        y: s.yDrift,
                        scale: 0,
                        opacity: 0,
                    }}
                    transition={{
                        duration: 0.9,
                        delay: s.delay,
                        ease: 'easeOut',
                    }}
                />
            ))}
            {/* Star icon that floats up with scale pop */}
            <motion.div
                className="home-star-icon"
                initial={{ y: 0, scale: 0, opacity: 0 }}
                animate={{
                    y: -70,
                    scale: [0, 1.6, 1.3, 0],
                    opacity: [0, 1, 1, 0],
                }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
            >
                &#9733;
            </motion.div>
        </div>
    );
};

// ---- Piece Entry Effect ----
// Pop-burst of colored particles when a piece first enters from base

export const PieceEntryBurst: React.FC<{
    color: string;
    x: number;
    y: number;
}> = ({ color, x, y }) => {
    const particles = useMemo(() =>
        Array.from({ length: IS_LOW_END ? 6 : 12 }, (_, i) => ({
            id: i,
            angle: (i / 12) * 360 + Math.random() * 30,
            distance: 15 + Math.random() * 30,
            size: 3 + Math.random() * 4,
        }))
    , []);

    return (
        <div className="capture-explosion" style={{ left: x, top: y }}>
            {/* Pop flash */}
            <motion.div
                className="explosion-flash"
                style={{ background: color }}
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
            />
            {/* Colored particles */}
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="explosion-shard"
                    style={{
                        width: p.size,
                        height: p.size,
                        background: color,
                        borderRadius: '50%',
                    }}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    animate={{
                        x: Math.cos(p.angle * Math.PI / 180) * p.distance,
                        y: Math.sin(p.angle * Math.PI / 180) * p.distance,
                        scale: 0,
                        opacity: 0,
                    }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                />
            ))}
        </div>
    );
};

// ---- Dice Six Burst ----
// Golden particle burst around the dice when rolling a 6

export const DiceSixBurst: React.FC<{
    x: number;
    y: number;
}> = ({ x, y }) => {
    const sparks = useMemo(() =>
        Array.from({ length: IS_LOW_END ? 6 : 14 }, (_, i) => ({
            id: i,
            angle: (i / 14) * 360 + Math.random() * 20,
            distance: 20 + Math.random() * 35,
            size: 2 + Math.random() * 4,
            delay: Math.random() * 0.05,
        }))
    , []);

    return (
        <div className="capture-explosion" style={{ left: x, top: y }}>
            {/* Golden flash */}
            <motion.div
                className="explosion-flash"
                style={{ background: '#FFD700' }}
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
            />
            {/* Golden sparks */}
            {sparks.map(s => (
                <motion.div
                    key={s.id}
                    className="explosion-shard"
                    style={{
                        width: s.size,
                        height: s.size,
                        background: '#FFD700',
                        borderRadius: '50%',
                        boxShadow: '0 0 4px #FFD700',
                    }}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    animate={{
                        x: Math.cos(s.angle * Math.PI / 180) * s.distance,
                        y: Math.sin(s.angle * Math.PI / 180) * s.distance,
                        scale: 0,
                        opacity: 0,
                    }}
                    transition={{
                        duration: 0.5,
                        delay: s.delay,
                        ease: 'easeOut',
                    }}
                />
            ))}
        </div>
    );
};

// ---- Screen Shake ----
// Applies CSS transform shake to a parent container

export const useScreenShake = () => {
    const [shaking, setShaking] = useState(false);

    const triggerShake = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
        setShaking(true);
        const durations = { light: 200, medium: 350, heavy: 500 };
        setTimeout(() => setShaking(false), durations[intensity]);
    }, []);

    const shakeClass = shaking ? 'screen-shaking' : '';

    return { shakeClass, triggerShake };
};

// ---- Streak Overlay ----
// Shows "DOUBLE KILL!", "TRIPLE KILL!" with fire effects for 3+

export const StreakOverlay: React.FC<{
    streak: number;
    type: 'capture' | 'six' | 'home';
}> = ({ streak, type }) => {
    if (streak < 2) return null;

    const messages: Record<string, Record<number, string>> = {
        capture: {
            2: 'DOUBLE KILL!',
            3: 'TRIPLE KILL!',
            4: 'UNSTOPPABLE!',
        },
        six: {
            2: 'DOUBLE SIX!',
            3: 'TRIPLE SIX!',
        },
        home: {
            2: 'DOUBLE HOME!',
            3: 'HAT TRICK!',
            4: 'CLEAN SWEEP!',
        },
    };

    const text = messages[type]?.[Math.min(streak, 4)] || `${streak}x COMBO!`;
    const isHot = streak >= 3;

    return (
        <motion.div
            className={`streak-overlay${isHot ? ' hot' : ''}`}
            initial={{ scale: 0, opacity: 0, x: '-50%', y: '-50%' }}
            animate={{
                scale: [0, 1.4, 1.1, 1],
                opacity: 1,
                x: '-50%',
                y: '-50%',
            }}
            exit={{ scale: 0.7, opacity: 0, x: '-50%', y: '-60%' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            <span className="streak-text">{text}</span>
            {isHot && (
                <motion.span
                    className="streak-fire"
                    animate={{ scale: [1, 1.2, 1], y: [0, -3, 0] }}
                    transition={{ duration: 0.4, repeat: Infinity, repeatType: 'mirror' }}
                >
                    {streak >= 4 ? '\u{1F525}\u{1F525}' : '\u{1F525}'}
                </motion.span>
            )}
            {/* Streak counter badge for high streaks */}
            {streak >= 3 && (
                <motion.span
                    className="streak-text"
                    style={{
                        fontSize: '0.8rem',
                        marginLeft: 4,
                        opacity: 0.7,
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
                >
                    x{streak}
                </motion.span>
            )}
        </motion.div>
    );
};

// ---- Turn Indicator Banner ----
// Slides in from side with player color accent

export const TurnBanner: React.FC<{
    isMyTurn: boolean;
    playerName: string;
    color: string;
}> = ({ isMyTurn, playerName, color }) => {
    return (
        <AnimatePresence>
            {isMyTurn && (
                <motion.div
                    className="turn-banner"
                    style={{ '--turn-color': color } as React.CSSProperties}
                    initial={{ opacity: 0, scale: 0.7, x: -80 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 60 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                >
                    <div className="turn-banner-glow" />
                    <span className="turn-banner-label">YOUR TURN</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ---- Emoji Reactions ----
// Quick tap reactions that float over the board with snappy pop

const REACTION_EMOJIS = ['\u{1F602}', '\u{1F624}', '\u{1F44F}', '\u{1F3AF}', '\u{1F480}', '\u{1F525}'];

export const EmojiReactions: React.FC<{
    onSend: (emoji: string) => void;
    incomingReactions: Array<{ id: string; emoji: string; fromTop: boolean }>;
}> = ({ onSend, incomingReactions }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [cooldown, setCooldown] = useState(false);

    const handleSend = (emoji: string) => {
        if (cooldown) return;
        onSend(emoji);
        setCooldown(true);
        setShowPicker(false);
        setTimeout(() => setCooldown(false), 2000);
    };

    return (
        <>
            {/* Floating reaction button */}
            <button
                className={`emoji-reaction-btn${cooldown ? ' cooldown' : ''}`}
                onClick={() => setShowPicker(!showPicker)}
                aria-label="Send reaction"
            >
                {'\u{1F604}'}
            </button>

            {/* Emoji picker */}
            <AnimatePresence>
                {showPicker && (
                    <motion.div
                        className="emoji-picker"
                        initial={{ opacity: 0, scale: 0.7, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.7, y: 15 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                        {REACTION_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                className="emoji-pick-btn"
                                onClick={() => handleSend(emoji)}
                            >
                                {emoji}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating reactions on board -- snappier pop animation */}
            <AnimatePresence>
                {incomingReactions.map(reaction => (
                    <motion.div
                        key={reaction.id}
                        className="floating-emoji"
                        style={{ top: reaction.fromTop ? '20%' : '70%' }}
                        initial={{ opacity: 0, scale: 0, x: '-50%' }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            scale: [0, 1.5, 1.2, 0.6],
                            y: -100,
                            x: '-50%',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    >
                        {reaction.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
        </>
    );
};

// ---- Payout Counter ----
// Animated counter that ticks up from 0 to final payout with coin sounds

export const PayoutCounter: React.FC<{
    amount: number;
    formatter: (n: number) => string;
    duration?: number;
}> = ({ amount, formatter, duration = 1500 }) => {
    const [display, setDisplay] = useState(0);
    const tickSoundRef = useRef(0);

    useEffect(() => {
        if (amount <= 0) return;
        const steps = 40;
        const stepTime = duration / steps;
        let current = 0;
        const increment = amount / steps;
        // Play coin tick every few steps
        const tickInterval = Math.max(1, Math.floor(steps / 12));

        const interval = setInterval(() => {
            current += increment;
            if (current >= amount) {
                current = amount;
                clearInterval(interval);
            }
            setDisplay(Math.floor(current));

            // Coin tick sound at intervals
            tickSoundRef.current++;
            if (tickSoundRef.current % tickInterval === 0 && current < amount) {
                playPayoutTick();
            }
        }, stepTime);

        return () => clearInterval(interval);
    }, [amount, duration]);

    return (
        <motion.span
            className="payout-counter"
            initial={{ scale: 1 }}
            animate={display === amount ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
        >
            +{formatter(display)}
        </motion.span>
    );
};

// ---- Trophy Animation ----
// Large animated trophy for win screen

export const TrophyAnimation: React.FC<{
    winnerName: string;
    winnerColor: string;
}> = ({ winnerName, winnerColor }) => {
    return (
        <motion.div
            className="trophy-container"
            initial={{ scale: 0, rotate: -15, y: 60 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.2 }}
        >
            <div className="trophy-glow" style={{ background: winnerColor }} />
            <motion.div
                className="trophy-icon"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
            >
                {'\u{1F3C6}'}
            </motion.div>
            <motion.div
                className="trophy-label"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
            >
                {winnerName}
            </motion.div>
            {/* Radiating light rays */}
            {!IS_LOW_END && (
                <div className="trophy-rays">
                    {Array.from({ length: 12 }, (_, i) => (
                        <div
                            key={i}
                            className="trophy-ray"
                            style={{ transform: `rotate(${i * 30}deg)` }}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
};

// ---- Timer Urgency Vignette ----
// Edge vignette that pulses red when time is critically low

export const UrgencyVignette: React.FC<{
    timeLeft: number;
    threshold?: number;
}> = ({ timeLeft, threshold = 5 }) => {
    if (timeLeft > threshold || timeLeft <= 0) return null;

    const intensity = 1 - (timeLeft / threshold);

    return (
        <div
            className="urgency-vignette"
            style={{
                '--urgency': intensity,
                animationDuration: `${0.3 + timeLeft * 0.08}s`,
            } as React.CSSProperties}
        />
    );
};

// ---- Near Miss Flash ----
// "Close call!" flash when opponent almost captures you

export const NearMissFlash: React.FC<{
    show: boolean;
}> = ({ show }) => {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="near-miss-flash"
                    initial={{ opacity: 0, scale: 0.6, x: '-50%' }}
                    animate={{ opacity: 1, scale: 1, x: '-50%' }}
                    exit={{ opacity: 0, scale: 0.8, y: -25, x: '-50%' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                    <span className="near-miss-text">CLOSE CALL!</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ---- Screen Edge Glow ----
// Subtle glow around screen edges in current player's color during their turn

export const ScreenEdgeGlow: React.FC<{
    color: string;
    active: boolean;
}> = ({ color, active }) => {
    if (!active) return null;

    return (
        <div
            className="urgency-vignette"
            style={{
                background: `radial-gradient(ellipse at center, transparent 60%, ${color}18 100%)`,
                animation: 'none',
                opacity: 0.8,
                zIndex: 5,
                pointerEvents: 'none' as const,
            }}
        />
    );
};

// ---- Board Flash ----
// Brief full-board flash for major events

export const BoardFlash: React.FC<{
    color: string;
    show: boolean;
}> = ({ color, show }) => {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: color,
                        borderRadius: 'inherit',
                        pointerEvents: 'none' as const,
                        zIndex: 99,
                    }}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                />
            )}
        </AnimatePresence>
    );
};

// ---- Move Preview Ghost ----
// Transparent ghost indicator at the landing position

export const MovePreviewGhost: React.FC<{
    color: string;
    gridRow: number;
    gridColumn: number;
    visible: boolean;
}> = ({ color, gridRow, gridColumn, visible }) => {
    if (!visible) return null;

    return (
        <motion.div
            style={{
                position: 'relative',
                gridRow,
                gridColumn,
                width: '70%',
                height: '70%',
                borderRadius: '50%',
                background: `${color}30`,
                border: `2px dashed ${color}60`,
                placeSelf: 'center',
                pointerEvents: 'none' as const,
                zIndex: 15,
            }}
            animate={{
                scale: [0.8, 1.05, 0.8],
                opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
        />
    );
};
