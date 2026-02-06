import React from 'react';

interface HomeScreenProps {
    onSelectMode: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectMode }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px' }}>
            <div className="stake-card" style={{ textAlign: 'center', padding: '64px 24px', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                    TACTICASH <span style={{ color: '#00e701' }}>ARENA</span>
                </h1>
                <p style={{ fontSize: '1.2rem', color: '#b1bad3', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px auto' }}>
                    The ultimate strategic betting experience. Compete against the house with verified fair odds.
                </p>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    <button
                        className="btn-primary"
                        style={{ padding: '16px 48px', fontSize: '1.2rem' }}
                        onClick={onSelectMode}
                    >
                        Play Now
                    </button>
                    <button
                        className="btn-secondary"
                        style={{ padding: '16px 48px', fontSize: '1.2rem' }}
                        disabled
                    >
                        Team Raid (Coming Soon)
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', width: '100%' }}>
                {['Fairness Verified', 'Instant Payouts', '24/7 Support'].map(feature => (
                    <div key={feature} className="stake-card" style={{ padding: '24px', textAlign: 'center' }}>
                        <h3 style={{ color: '#fff', marginBottom: '8px' }}>{feature}</h3>
                        <p style={{ fontSize: '0.9rem', margin: 0 }}>Industry leading standard.</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
