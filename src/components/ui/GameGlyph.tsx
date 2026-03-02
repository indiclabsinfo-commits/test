import React from 'react';

interface GameGlyphProps {
  gameId: string;
  className?: string;
  style?: React.CSSProperties;
}

export const GameGlyph: React.FC<GameGlyphProps> = ({ gameId, className, style }) => {
  const common = {
    viewBox: '0 0 64 64',
    className,
    style,
    xmlns: 'http://www.w3.org/2000/svg',
    fill: 'none',
  } as const;

  switch (gameId) {
    case 'ludo':
    case 'dice':
      return (
        <svg {...common}>
          <rect x="10" y="10" width="44" height="44" rx="10" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" />
          <circle cx="23" cy="23" r="3.2" fill="currentColor" />
          <circle cx="41" cy="23" r="3.2" fill="currentColor" />
          <circle cx="32" cy="32" r="3.2" fill="currentColor" />
          <circle cx="23" cy="41" r="3.2" fill="currentColor" />
          <circle cx="41" cy="41" r="3.2" fill="currentColor" />
        </svg>
      );
    case 'crash':
      return (
        <svg {...common}>
          <path d="M10 48H54" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
          <path d="M14 44L25 35L33 38L48 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M48 19V28M48 19H39" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case 'mines':
    case 'diamonds':
      return (
        <svg {...common}>
          <path d="M32 9L52 32L32 55L12 32L32 9Z" fill="rgba(255,255,255,0.18)" stroke="currentColor" strokeWidth="2.5" />
          <path d="M32 9V55M12 32H52M20 20L44 44M44 20L20 44" stroke="currentColor" strokeWidth="2" opacity="0.75" />
        </svg>
      );
    case 'plinko':
      return (
        <svg {...common}>
          <path d="M12 16H52L32 52L12 16Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
          {[
            [20, 22], [32, 22], [44, 22],
            [26, 30], [38, 30],
            [20, 38], [32, 38], [44, 38],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.4" fill="currentColor" />
          ))}
          <circle cx="32" cy="13.5" r="4.5" fill="currentColor" />
        </svg>
      );
    case 'limbo':
      return (
        <svg {...common}>
          <path d="M12 45C20 36 26 30 32 26C38 22 45 16 52 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M45 10H52V17" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="20" cy="45" r="4" fill="rgba(255,255,255,0.35)" />
        </svg>
      );
    case 'blackjack':
    case 'hilo':
      return (
        <svg {...common}>
          <rect x="14" y="10" width="36" height="44" rx="6" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" />
          <path d="M32 22C28 16 18 20 21 27C24 33 32 37 32 37C32 37 40 33 43 27C46 20 36 16 32 22Z" fill="currentColor" />
          <text x="22" y="19" fontSize="7" fill="currentColor" fontWeight="700">A</text>
          <text x="39" y="48" fontSize="7" fill="currentColor" fontWeight="700">K</text>
        </svg>
      );
    case 'keno':
      return (
        <svg {...common}>
          <rect x="12" y="14" width="40" height="36" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" />
          <text x="20" y="31" fontSize="12" fill="currentColor" fontWeight="700">12</text>
          <text x="20" y="44" fontSize="12" fill="currentColor" fontWeight="700">34</text>
        </svg>
      );
    case 'wheel':
    case 'roulette':
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="20" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="4" fill="currentColor" />
          <path d="M32 12V52M12 32H52M18 18L46 46M46 18L18 46" stroke="currentColor" strokeWidth="2.2" opacity="0.85" />
        </svg>
      );
    case 'dragon_tower':
      return (
        <svg {...common}>
          <path d="M16 50L24 20L36 34L46 14L48 50H16Z" fill="rgba(255,255,255,0.14)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="37" cy="28" r="2" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="18" fill="rgba(255,255,255,0.14)" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      );
  }
};

export default GameGlyph;
