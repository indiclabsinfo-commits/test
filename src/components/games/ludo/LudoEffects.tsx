import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LudoEffects.css';

// ─── Enhanced Confetti ───────────────────────────────────────────────
// Full-screen confetti with mixed shapes, rotations, and physics

type ConfettiShape = 'circle' | 'square' | 'strip' | 'star';

export const EnhancedConfetti: React.FC<{ duration?: number }> = ({ duration = 4000 }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setVisible(false), duration);
        return () => clearTimeout(t);
    }, [duration]);

    const particles = useMemo(() =>
        Array.from({ length: 80 }, (_, i) => {
            const shapes: ConfettiShape[] = ['circle', 'square', 'strip', 'star'];
            const colors = [
                '#FFD700', '#FF4500', '#00FF7F', '#00CED1', '#FF1493',
                '#7B68EE', '#FF6347', '#32CD32', '#FFB347', '#87CEEB'
            ];
            return {
                id: i,
                x: Math.random() * 100,
                delay: Math.random() * 0.6,
                duration: 2.2 + Math.random() * 1.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                size: 6 + Math.random() * 10,
                rotation: Math.random() * 720 - 360,
                drift: (Math.random() - 0.5) * 120,
            };
        })
    , []);

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
                        width: p.shape === 'strip' ? `${p.size * 0.35}px` : `${p.size}px`,
                        height: p.shape === 'strip' ? `${p.size * 2}px` : `${p.size}px`,
                        '--drift': `${p.drift}px`,
                        '--rotation': `${p.rotation}deg`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
};

// ─── Capture Explosion ───────────────────────────────────────────────
// Particle burst when a piece gets captured

export const CaptureExplosion: React.FC<{
    color: string;
    x: number;
    y: number;
}> = ({ color, x, y }) => {
    const shards = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => ({
            id: i,
            angle: (i / 12) * 360,
            distance: 30 + Math.random() * 50,
            size: 4 + Math.random() * 6,
            delay: Math.random() * 0.1,
        }))
    , []);

    return (
        <div className="capture-explosion" style={{ left: x, top: y }}>
            {/* Central flash */}
            <motion.div
                className="explosion-flash"
                style={{ background: color }}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
            />
            {/* Shockwave ring */}
            <motion.div
                className="explosion-ring"
                style={{ borderColor: color }}
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            {/* Particle shards */}
            {shards.map(s => (
                <motion.div
                    key={s.id}
                    className="explosion-shard"
                    style={{
                        width: s.size,
                        height: s.size,
                        background: color,
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

// ─── Home Entry Celebration ──────────────────────────────────────────
// Golden burst + ascending sparkles when a piece reaches home

export const HomeEntryCelebration: React.FC<{
    x: number;
    y: number;
}> = ({ x, y }) => {
    const sparkles = useMemo(() =>
        Array.from({ length: 16 }, (_, i) => ({
            id: i,
            angle: (i / 16) * 360 + Math.random() * 20,
            distance: 20 + Math.random() * 40,
            size: 3 + Math.random() * 5,
            delay: Math.random() * 0.3,
            yDrift: -(40 + Math.random() * 80),
        }))
    , []);

    return (
        <div className="home-celebration" style={{ left: x, top: y }}>
            {/* Golden burst ring */}
            <motion.div
                className="home-burst"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 3.5, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            {/* Ascending sparkle particles */}
            {sparkles.map(s => (
                <motion.div
                    key={s.id}
                    className="home-sparkle"
                    style={{ width: s.size, height: s.size }}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    animate={{
                        x: Math.cos(s.angle * Math.PI / 180) * s.distance,
                        y: s.yDrift,
                        scale: 0,
                        opacity: 0,
                    }}
                    transition={{
                        duration: 0.8,
                        delay: s.delay,
                        ease: 'easeOut',
                    }}
                />
            ))}
            {/* Star icon that floats up */}
            <motion.div
                className="home-star-icon"
                initial={{ y: 0, scale: 0, opacity: 0 }}
                animate={{ y: -60, scale: 1.3, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
            >
                ★
            </motion.div>
        </div>
    );
};

// ─── Screen Shake ────────────────────────────────────────────────────
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

// ─── Streak Overlay ─────────────────────────────────────────────────
// Shows "Double Kill!", "Hat Trick!" etc.

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
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: [0, 1.3, 1], opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -30 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            <span className="streak-text">{text}</span>
            {isHot && <span className="streak-fire">🔥</span>}
        </motion.div>
    );
};

// ─── Turn Indicator Banner ──────────────────────────────────────────
// "YOUR TURN" with energy animation

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
                    initial={{ opacity: 0, scale: 0.8, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                    <div className="turn-banner-glow" />
                    <span className="turn-banner-label">YOUR TURN</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ─── Emoji Reactions ────────────────────────────────────────────────
// Quick tap reactions that float over the board

const REACTION_EMOJIS = ['😂', '😤', '👏', '🎯', '💀', '🔥'];

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
                😄
            </button>

            {/* Emoji picker */}
            <AnimatePresence>
                {showPicker && (
                    <motion.div
                        className="emoji-picker"
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
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

            {/* Floating reactions on board */}
            <AnimatePresence>
                {incomingReactions.map(reaction => (
                    <motion.div
                        key={reaction.id}
                        className="floating-emoji"
                        style={{ top: reaction.fromTop ? '20%' : '70%' }}
                        initial={{ opacity: 0, scale: 0, x: '-50%' }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            scale: [0, 1.4, 1.2, 0.8],
                            y: -80,
                            x: '-50%',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                    >
                        {reaction.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
        </>
    );
};

// ─── Payout Counter ─────────────────────────────────────────────────
// Animated counter that ticks up from 0 to final payout

export const PayoutCounter: React.FC<{
    amount: number;
    formatter: (n: number) => string;
    duration?: number;
}> = ({ amount, formatter, duration = 1500 }) => {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (amount <= 0) return;
        const steps = 30;
        const stepTime = duration / steps;
        let current = 0;
        const increment = amount / steps;

        const interval = setInterval(() => {
            current += increment;
            if (current >= amount) {
                current = amount;
                clearInterval(interval);
            }
            setDisplay(Math.floor(current));
        }, stepTime);

        return () => clearInterval(interval);
    }, [amount, duration]);

    return (
        <motion.span
            className="payout-counter"
            initial={{ scale: 1 }}
            animate={display === amount ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.3 }}
        >
            +{formatter(display)}
        </motion.span>
    );
};

// ─── Trophy Animation ───────────────────────────────────────────────
// Large animated trophy for win screen

export const TrophyAnimation: React.FC<{
    winnerName: string;
    winnerColor: string;
}> = ({ winnerName, winnerColor }) => {
    return (
        <motion.div
            className="trophy-container"
            initial={{ scale: 0, rotate: -10, y: 50 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        >
            <div className="trophy-glow" style={{ background: winnerColor }} />
            <div className="trophy-icon">🏆</div>
            <motion.div
                className="trophy-label"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
            >
                {winnerName}
            </motion.div>
            {/* Radiating light rays */}
            <div className="trophy-rays">
                {Array.from({ length: 8 }, (_, i) => (
                    <div
                        key={i}
                        className="trophy-ray"
                        style={{ transform: `rotate(${i * 45}deg)` }}
                    />
                ))}
            </div>
        </motion.div>
    );
};

// ─── Timer Urgency Vignette ─────────────────────────────────────────
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
                animationDuration: `${0.4 + timeLeft * 0.1}s`,
            } as React.CSSProperties}
        />
    );
};

// ─── Near Miss Flash ────────────────────────────────────────────────
// "Close call!" flash when opponent almost captures you

export const NearMissFlash: React.FC<{
    show: boolean;
}> = ({ show }) => {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="near-miss-flash"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, y: -20 }}
                    transition={{ duration: 0.4 }}
                >
                    <span className="near-miss-text">CLOSE CALL!</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
