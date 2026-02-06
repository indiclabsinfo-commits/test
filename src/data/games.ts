export interface Game {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    status: 'ACTIVE' | 'MAINTENANCE' | 'COMING_SOON';
    playing: number;
}

export const GAMES: Game[] = [
    {
        id: 'mines',
        name: 'Mines',
        description: 'Uncover gems, avoid bombs.',
        color: '#007aff',
        icon: '💎',
        status: 'ACTIVE',
        playing: 2594
    },
    {
        id: 'dice',
        name: 'Dice',
        description: 'Roll for the win.',
        color: '#ff0055',
        icon: '🎲',
        status: 'ACTIVE',
        playing: 2192
    },
    {
        id: 'plinko',
        name: 'Plinko',
        description: 'Drop the ball.',
        color: '#ff0099',
        icon: '📍',
        status: 'ACTIVE',
        playing: 1325
    },
    {
        id: 'limbo',
        name: 'Limbo',
        description: 'How high can you go?',
        color: '#ff9900',
        icon: '🚀',
        status: 'ACTIVE',
        playing: 1945
    },
    {
        id: 'blackjack',
        name: 'Blackjack',
        description: 'Beat the dealer.',
        color: '#cc0000',
        icon: '♠️',
        status: 'ACTIVE',
        playing: 837
    },
    {
        id: 'crash',
        name: 'Crash',
        description: 'Bail before it crashes.',
        color: '#ffcc00',
        icon: '📈',
        status: 'ACTIVE',
        playing: 1295
    },
    {
        id: 'keno',
        name: 'Keno',
        description: 'Pick your lucky numbers.',
        color: '#33cc33',
        icon: '🔢',
        status: 'ACTIVE',
        playing: 1127
    },
    {
        id: 'wheel',
        name: 'Wheel',
        description: 'Spin to win.',
        color: '#00ccff',
        icon: '🎡',
        status: 'ACTIVE',
        playing: 249
    },
    {
        id: 'roulette',
        name: 'Roulette',
        description: 'Classic casino staple.',
        color: '#009900',
        icon: '🔴',
        status: 'ACTIVE',
        playing: 114
    },
    {
        id: 'diamonds',
        name: 'Diamonds',
        description: 'Match the gems.',
        color: '#9933ff',
        icon: '💠',
        status: 'ACTIVE',
        playing: 105
    },
    {
        id: 'dragon_tower',
        name: 'Dragon Tower',
        description: 'Climb for glory.',
        color: '#ff9933',
        icon: '🐲',
        status: 'ACTIVE',
        playing: 468
    },
    {
        id: 'hilo',
        name: 'HiLo',
        description: 'Higher or Lower?',
        color: '#ff3300',
        icon: '🃏',
        status: 'ACTIVE',
        playing: 521
    },
    {
        id: 'ludo',
        name: 'Ludo',
        description: 'Multiplayer Betting.',
        color: '#ffcc00',
        icon: '🎲',
        status: 'ACTIVE',
        playing: 450
    }
];
