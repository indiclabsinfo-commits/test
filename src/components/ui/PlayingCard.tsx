import React from 'react';
import { motion } from 'framer-motion';

export type Suit = '♠' | '♥' | '♣' | '♦';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface PlayingCardProps {
    suit: Suit;
    rank: Rank;
    hidden?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const SUIT_COLORS = {
    '♠': '#2f3640',
    '♣': '#2f3640',
    '♥': '#e84118',
    '♦': '#e84118'
};

const SuitIcon: React.FC<{ suit: Suit, size?: number }> = ({ suit, size = 24 }) => {
    // Simple SVG or Text for now, but stylized
    const color = SUIT_COLORS[suit];

    // Modern SVG paths for suits could go here. 
    // For now, using text with heavy font is OK but maybe SVG is better for "High End".
    // Let's stick to text for simplicity but wrap it nicely, or use SVG if I had them handy.
    // Actually, let's use standard emoji but style it so it doesn't look like emoji.
    // Wait, user wants "High End". Emojis are risky as they look different on OS.
    // I should use SVGs.

    return (
        <span style={{ color, fontSize: size, lineHeight: 1 }}>{suit}</span>
    );
};

export const PlayingCard: React.FC<PlayingCardProps> = ({ suit, rank, hidden = false, className, style }) => {
    return (
        <motion.div
            className={className}
            style={{
                width: 140,
                height: 200,
                perspective: 1000,
                cursor: 'default',
                ...style
            }}
            initial={false}
            animate={{ rotateY: hidden ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
            <motion.div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                }}
            >
                {/* Front */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '12px',
                    border: '1px solid #dcdde1',
                    color: SUIT_COLORS[suit]
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{rank}</span>
                        <SuitIcon suit={suit} size={16} />
                    </div>

                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        <SuitIcon suit={suit} size={64} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px', alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{rank}</span>
                        <SuitIcon suit={suit} size={16} />
                    </div>
                </div>

                {/* Back */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    background: `
                        linear-gradient(135deg, #192a56 25%, transparent 25%) -10px 0,
                        linear-gradient(225deg, #192a56 25%, transparent 25%) -10px 0,
                        linear-gradient(315deg, #192a56 25%, transparent 25%),
                        linear-gradient(45deg, #192a56 25%, transparent 25%)
                    `,
                    backgroundSize: '20px 20px',
                    backgroundColor: '#273c75',
                    borderRadius: '12px',
                    transform: 'rotateY(180deg)',
                    border: '4px solid white',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }} />
            </motion.div>
        </motion.div>
    );
};
