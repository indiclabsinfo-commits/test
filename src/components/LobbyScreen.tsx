import React, { useState } from 'react';
import { GAMES } from '../data/games';
import { formatIndianNumber } from '../utils/format';

interface LobbyScreenProps {
    onJoin: (gameId: string) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onJoin }) => {
    const [search, setSearch] = useState('');

    const filteredGames = GAMES.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ width: '100%', maxWidth: '1200px' }}>
            {/* Lobby Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#00e701' }}>🎲</span> Lobby
                    </h2>
                </div>

                <div className="input-group" style={{ width: '300px' }}>
                    <span style={{ padding: '0 12px', color: '#55657e' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search game..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            padding: '12px 0',
                            outline: 'none',
                            width: '100%'
                        }}
                    />
                </div>
            </div>

            {/* Games Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '48px'
            }}>
                {filteredGames.map(game => (
                    <div
                        key={game.id}
                        className="stake-card"
                        onClick={() => onJoin(game.id)}
                        style={{
                            cursor: 'pointer',
                            padding: 0,
                            overflow: 'hidden',
                            position: 'relative',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            border: 'none',
                            background: '#213743'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = `0 10px 20px -5px ${game.color}40`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        {/* Card Image Area */}
                        <div style={{
                            height: '140px',
                            background: `linear-gradient(135deg, ${game.color}20 0%, ${game.color} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}>
                            <span style={{ fontSize: '4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                                {game.icon}
                            </span>

                            {/* Stake Original Label */}

                        </div>

                        {/* Card Info */}
                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <h3 style={{ fontSize: '1rem', margin: 0 }}>{game.name}</h3>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e701', boxShadow: '0 0 5px #00e701' }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#b1bad3' }}>
                                <span>{formatIndianNumber(game.playing)} playing</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
