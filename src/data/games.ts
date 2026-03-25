export interface Game {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    status: 'ACTIVE' | 'MAINTENANCE' | 'COMING_SOON';
    playing: number;
    category: 'originals' | 'casino' | 'board';
    badge?: 'hot' | 'new' | 'live' | 'featured';
}

export const GAMES: Game[] = [
    {
        id: 'ludo',
        name: 'Ludo',
        description: 'Multiplayer Betting.',
        color: '#ffcc00',
        icon: '🎲',
        status: 'ACTIVE',
        playing: 450,
        category: 'board',
        badge: 'hot'
    },
    {
        id: 'crash',
        name: 'Crash',
        description: 'Bail before it crashes.',
        color: '#ffcc00',
        icon: '📈',
        status: 'ACTIVE',
        playing: 1295,
        category: 'originals',
        badge: 'live'
    },
    {
        id: 'mines',
        name: 'Mines',
        description: 'Uncover gems, avoid bombs.',
        color: '#007aff',
        icon: '💎',
        status: 'ACTIVE',
        playing: 2594,
        category: 'originals',
        badge: 'hot'
    },
    {
        id: 'dice',
        name: 'Dice',
        description: 'Roll for the win.',
        color: '#ff0055',
        icon: '🎲',
        status: 'ACTIVE',
        playing: 2192,
        category: 'originals'
    },
    {
        id: 'plinko',
        name: 'Plinko',
        description: 'Drop the ball.',
        color: '#ff0099',
        icon: '📍',
        status: 'ACTIVE',
        playing: 1325,
        category: 'originals',
        badge: 'hot'
    },
    {
        id: 'limbo',
        name: 'Limbo',
        description: 'How high can you go?',
        color: '#ff9900',
        icon: '🚀',
        status: 'ACTIVE',
        playing: 1945,
        category: 'originals'
    },
    {
        id: 'blackjack',
        name: 'Blackjack',
        description: 'Beat the dealer.',
        color: '#cc0000',
        icon: '♠️',
        status: 'ACTIVE',
        playing: 837,
        category: 'casino',
        badge: 'live'
    },
    {
        id: 'keno',
        name: 'Keno',
        description: 'Pick your lucky numbers.',
        color: '#33cc33',
        icon: '🔢',
        status: 'ACTIVE',
        playing: 1127,
        category: 'originals',
        badge: 'new'
    },
    {
        id: 'wheel',
        name: 'Wheel',
        description: 'Spin to win.',
        color: '#00ccff',
        icon: '🎡',
        status: 'ACTIVE',
        playing: 249,
        category: 'casino'
    },
    {
        id: 'roulette',
        name: 'Roulette',
        description: 'Classic casino staple.',
        color: '#009900',
        icon: '🔴',
        status: 'ACTIVE',
        playing: 114,
        category: 'casino'
    },
    {
        id: 'diamonds',
        name: 'Diamonds',
        description: 'Match the gems.',
        color: '#9933ff',
        icon: '💠',
        status: 'ACTIVE',
        playing: 105,
        category: 'originals'
    },
    {
        id: 'dragon_tower',
        name: 'Dragon Tower',
        description: 'Climb for glory.',
        color: '#ff9933',
        icon: '🐲',
        status: 'ACTIVE',
        playing: 468,
        category: 'originals',
        badge: 'new'
    },
    {
        id: 'hilo',
        name: 'HiLo',
        description: 'Higher or Lower?',
        color: '#ff3300',
        icon: '🃏',
        status: 'ACTIVE',
        playing: 521,
        category: 'casino'
    }
];
