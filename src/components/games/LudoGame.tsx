import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { playDiceShake, playClick } from '../../utils/sound';
import { formatIndianNumber } from '../../utils/format';
import { motion } from 'framer-motion';
import './LudoBoard.css';

// --- Constants & Types ---
type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';

interface Piece {
    id: number;
    color: PlayerColor;
    position: number; // -1 = Home, 0-51 = Main Path
    travelled: number; // Total steps taken (to track home stretch entry)
}

interface Player {
    color: PlayerColor;
    isBot: boolean;
    name: string;
    pieces: Piece[];
    hasFinished: boolean; // Reached center
}

// 1-indexed for CSS Grid.
const PATH_COORDS = [
    // 0: Green Start Point (safe) is usually (7, 2) in grid terms (row, col)
    { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }, { r: 7, c: 6 },
    { r: 6, c: 7 }, { r: 5, c: 7 }, { r: 4, c: 7 }, { r: 3, c: 7 }, { r: 2, c: 7 }, { r: 1, c: 7 }, // 5-10
    { r: 1, c: 8 }, { r: 1, c: 9 }, // 11, 12 top middle
    { r: 2, c: 9 }, { r: 3, c: 9 }, { r: 4, c: 9 }, { r: 5, c: 9 }, { r: 6, c: 9 }, // 13-17 down
    { r: 7, c: 10 }, { r: 7, c: 11 }, { r: 7, c: 12 }, { r: 7, c: 13 }, { r: 7, c: 14 }, { r: 7, c: 15 }, // 18-23 right
    { r: 8, c: 15 }, { r: 9, c: 15 }, // 24, 25 right middle
    { r: 9, c: 14 }, { r: 9, c: 13 }, { r: 9, c: 12 }, { r: 9, c: 11 }, { r: 9, c: 10 }, // 26-30 left
    { r: 10, c: 9 }, { r: 11, c: 9 }, { r: 12, c: 9 }, { r: 13, c: 9 }, { r: 14, c: 9 }, { r: 15, c: 9 }, // 31-36 down
    { r: 15, c: 8 }, { r: 15, c: 7 }, // 37, 38 bottom middle
    { r: 14, c: 7 }, { r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, // 39-43 up
    { r: 9, c: 6 }, { r: 9, c: 5 }, { r: 9, c: 4 }, { r: 9, c: 3 }, { r: 9, c: 2 }, { r: 9, c: 1 }, // 44-49 left
    { r: 8, c: 1 }, { r: 7, c: 1 } // 50, 51 left middle
];
// Total 52 elements exactly.

const START_OFFSETS = {
    GREEN: 0,
    YELLOW: 13,
    BLUE: 26,
    RED: 39
};

const HOME_PATHS = {
    GREEN: [{ r: 8, c: 2 }, { r: 8, c: 3 }, { r: 8, c: 4 }, { r: 8, c: 5 }, { r: 8, c: 6 }],
    YELLOW: [{ r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }, { r: 5, c: 8 }, { r: 6, c: 8 }],
    BLUE: [{ r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 }],
    RED: [{ r: 14, c: 8 }, { r: 13, c: 8 }, { r: 12, c: 8 }, { r: 11, c: 8 }, { r: 10, c: 8 }]
};

const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

export const LudoGame: React.FC = () => {
    const { placeBet } = useGame();

    // --- State ---
    const [players, setPlayers] = useState<Player[]>([
        { color: 'GREEN', isBot: false, name: 'Green', hasFinished: false, pieces: [0, 1, 2, 3].map(id => ({ id, color: 'GREEN', position: -1, travelled: 0 })) },
        { color: 'YELLOW', isBot: false, name: 'Yellow', hasFinished: false, pieces: [0, 1, 2, 3].map(id => ({ id, color: 'YELLOW', position: -1, travelled: 0 })) },
        { color: 'BLUE', isBot: false, name: 'Blue', hasFinished: false, pieces: [0, 1, 2, 3].map(id => ({ id, color: 'BLUE', position: -1, travelled: 0 })) },
        { color: 'RED', isBot: false, name: 'Red', hasFinished: false, pieces: [0, 1, 2, 3].map(id => ({ id, color: 'RED', position: -1, travelled: 0 })) },
    ]);
    const [turnIndex, setTurnIndex] = useState(0); // 0=Green, 1=Yellow...
    const [diceValue, setDiceValue] = useState<number | null>(null);
    const [canRoll, setCanRoll] = useState(true);
    const [gameState, setGameState] = useState<'BETTING' | 'PLAYING' | 'FINISHED'>('BETTING');
    const [consecutive6s, setConsecutive6s] = useState(0); // Track consecutive 6s
    const [turnTimeLeft, setTurnTimeLeft] = useState(30); // 30-second timer

    const [betAmount, setBetAmount] = useState(100);
    const [log, setLog] = useState<string[]>([]);

    const currentPlayer = players[turnIndex];

    // --- Economics ---
    const getPayouts = () => {
        const totalPot = betAmount * 4;
        const houseFee = totalPot * 0.10;
        const prizePool = totalPot - houseFee;

        return {
            totalPot,
            prizePool,
            split: {
                first: prizePool * 0.55,
                second: prizePool * 0.30,
                third: prizePool * 0.15,
                fourth: 0
            }
        };
    };

    // --- Timer Effect ---
    const timerExpiredRef = React.useRef(false);

    React.useEffect(() => {
        if (gameState !== 'PLAYING' || !canRoll) return;

        const timer = setInterval(() => {
            setTurnTimeLeft(prev => {
                if (prev <= 1) {
                    // Mark that timer expired
                    timerExpiredRef.current = true;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState, canRoll, turnIndex]);

    // Handle timer expiration
    React.useEffect(() => {
        if (timerExpiredRef.current && turnTimeLeft === 0 && gameState === 'PLAYING') {
            timerExpiredRef.current = false;
            addToLog(`${currentPlayer.name}'s time expired!`);
            setTurnTimeLeft(30);
            setTimeout(() => {
                setTurnIndex(prev => {
                    let next = (prev + 1) % 4;
                    let loops = 0;
                    while (players[next].hasFinished && loops < 4) {
                        next = (next + 1) % 4;
                        loops++;
                    }
                    return next;
                });
                setDiceValue(null);
                setCanRoll(true);
                setConsecutive6s(0);
            }, 500);
        }
    }, [turnTimeLeft, gameState, currentPlayer, players]);


    // --- Actions ---
    const handleStart = () => {
        if (!placeBet(betAmount)) return alert("Insufficient Funds");
        setGameState('PLAYING');
        setTurnTimeLeft(30);
        addToLog("Game Started! Pot: ₹" + (betAmount * 4));
    };

    const rollDice = () => {
        if (!canRoll) return;
        playDiceShake();
        setCanRoll(false);

        const roll = Math.floor(Math.random() * 6) + 1;

        // Rolling animation simulation
        let i = 0;
        const interval = setInterval(() => {
            setDiceValue(Math.floor(Math.random() * 6) + 1);
            i++;
            if (i > 10) {
                clearInterval(interval);
                setDiceValue(roll);

                // Check for 3 consecutive 6s limit
                if (roll === 6) {
                    if (consecutive6s >= 2) {
                        // 3rd consecutive 6 - auto-pass turn
                        addToLog(`${currentPlayer.name} rolled 3 sixes! Turn passed.`);
                        setConsecutive6s(0);
                        setTimeout(nextTurn, 1500);
                        return;
                    }
                    setConsecutive6s(prev => prev + 1);
                } else {
                    setConsecutive6s(0);
                }

                handleRollResult(roll);
            }
        }, 50);
    };

    const renderDiceFace = (value: number): React.ReactNode => {
        const dotStyle = {
            width: '18px',
            height: '18px',
            background: 'radial-gradient(circle at 30% 30%, #333, #000)',
            borderRadius: '50%',
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.5)',
        };

        // Helper to render empty spacer
        const Empty = () => <div />;

        // Dice Face Container with inset effect for realism
        const Face = ({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) => (
            <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                borderRadius: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(3, 1fr)',
                padding: '12px',
                boxSizing: 'border-box',
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.1)',
                gap: '2px', // minimal gap to align grid
                ...style
            }}>
                {children}
            </div>
        );

        // Map values to 3x3 grid positions
        switch (value) {
            case 1:
                return (
                    <Face style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ ...dotStyle, width: '24px', height: '24px', background: 'radial-gradient(circle at 30% 30%, #ff3333, #cc0000)' }} />
                    </Face>
                );
            case 2:
                return (
                    <Face>
                        <div style={dotStyle} /> <Empty /> <Empty />
                        <Empty /> <Empty /> <Empty />
                        <Empty /> <Empty /> <div style={dotStyle} />
                    </Face>
                );
            case 3:
                return (
                    <Face>
                        <div style={dotStyle} /> <Empty /> <Empty />
                        <Empty /> <div style={dotStyle} /> <Empty />
                        <Empty /> <Empty /> <div style={dotStyle} />
                    </Face>
                );
            case 4:
                return (
                    <Face>
                        <div style={dotStyle} /> <Empty /> <div style={dotStyle} />
                        <Empty /> <Empty /> <Empty />
                        <div style={dotStyle} /> <Empty /> <div style={dotStyle} />
                    </Face>
                );
            case 5:
                return (
                    <Face>
                        <div style={dotStyle} /> <Empty /> <div style={dotStyle} />
                        <Empty /> <div style={dotStyle} /> <Empty />
                        <div style={dotStyle} /> <Empty /> <div style={dotStyle} />
                    </Face>
                );
            case 6:
                return (
                    <Face>
                        <div style={dotStyle} /> <Empty /> <div style={dotStyle} />
                        <div style={dotStyle} /> <Empty /> <div style={dotStyle} />
                        <div style={dotStyle} /> <Empty /> <div style={dotStyle} />
                    </Face>
                );
            default:
                return null;
        }
    };


    const handleRollResult = (roll: number) => {
        // Check moves
        const p = players[turnIndex];
        const movablePieces = p.pieces.filter(piece => canMove(piece, roll));

        if (movablePieces.length === 0) {
            // No valid moves - auto-pass
            if (roll === 6) {
                addToLog(`${p.name} rolled 6 but no valid moves!`);
            } else {
                addToLog(`${p.name} rolled ${roll}. No moves available.`);
            }
            setConsecutive6s(0); // Reset counter
            setTimeout(nextTurn, 1500);
            return;
        }
        // User must click on pieces to move them
    };

    const canMove = (piece: Piece, roll: number): boolean => {
        if (piece.position === 99) return false; // Already finished
        if (piece.position === -1) return roll === 6; // Need 6 to start
        if (piece.travelled + roll > 56) return false; // Overshoot home
        // Strict home logic: 56 is the end (6th spot in home stretch).
        return true;
    };


    const movePiece = (piece: Piece, roll: number) => {
        // 1. Calculate the outcome PURELY for the game loop decision (next turn / roll again)
        // This avoids relying on side-effects inside setPlayers which might be async.
        const simulateOutcome = () => {
            const p = players.find(pl => pl.color === piece.color)!;
            const target = p.pieces.find(pc => pc.id === piece.id)!;

            if (target.position === -1) {
                return { killed: false }; // Deploy never kills
            }

            // Predict new attributes
            const newTravelled = target.travelled + roll;
            const newPos = (target.position + roll) % 52;

            if (newTravelled > 56) return { killed: false };

            let kill = false;
            if (!SAFE_SPOTS.includes(newPos) && newTravelled <= 50) {
                // Check if any opponent is here
                kill = players.some(opp =>
                    opp.color !== piece.color &&
                    opp.pieces.some(enemy => enemy.position === newPos && enemy.travelled <= 50)
                );
            }
            return { killed: kill };
        };

        const outcome = simulateOutcome();
        const isSix = roll === 6;

        // 2. Perform the actual State Update
        setPlayers(prev => {
            const newPlayers = prev.map(p => ({
                ...p,
                pieces: p.pieces.map(pc => ({ ...pc }))
            }));

            const pIndex = newPlayers.findIndex(pl => pl.color === piece.color);
            const p = newPlayers[pIndex];
            const targetPiece = p.pieces.find(pc => pc.id === piece.id)!;
            const pName = p.name;

            if (targetPiece.position === -1) {
                // Deploy
                if (roll === 6) {
                    targetPiece.position = START_OFFSETS[piece.color];
                    targetPiece.travelled = 0;
                    addToLog(`${pName} deployed a piece!`);
                }
            } else {
                targetPiece.travelled += roll;
                const newPos = (targetPiece.position + roll) % 52;

                // Safety/Home Logic
                if (targetPiece.travelled > 50) {
                    targetPiece.position = newPos;
                } else {
                    targetPiece.position = newPos;
                    // KILL LOGIC
                    if (!SAFE_SPOTS.includes(newPos)) {
                        newPlayers.forEach(opponent => {
                            if (opponent.color !== p.color) {
                                opponent.pieces.forEach(enemyPiece => {
                                    if (enemyPiece.position === newPos && enemyPiece.travelled <= 50) {
                                        enemyPiece.position = -1;
                                        enemyPiece.travelled = 0;
                                        addToLog(`${pName} KILLED ${opponent.name}'s piece!`);
                                    }
                                });
                            }
                        });
                    }
                }
                addToLog(`${pName} moved piece ${roll} steps.`);
            }

            // Win
            if (targetPiece.travelled === 56) targetPiece.position = 99;
            if (p.pieces.every(pc => pc.position === 99)) {
                p.hasFinished = true;
                addToLog(`${pName} HAS FINISHED!`);
            }

            return newPlayers;
        });

        playClick();


        // 3. Decide Next Turn
        setTimeout(() => {
            if (isSix || outcome.killed) {
                setCanRoll(true);
                // User must roll again manually
            } else {
                nextTurn();
            }
        }, 800);
    };

    const nextTurn = () => {
        // Find next player who hasn't finished
        let next = (turnIndex + 1) % 4;
        let loops = 0;
        while (players[next].hasFinished && loops < 4) {
            next = (next + 1) % 4;
            loops++;
        }

        if (loops === 4) {
            setGameState('FINISHED');
            return;
        }

        setTurnIndex(next);
        setDiceValue(null);
        setCanRoll(true);
        setTurnTimeLeft(30); // Reset timer for next player
        setConsecutive6s(0); // Reset consecutive 6s counter
    };

    const addToLog = (msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 5));
    };

    // --- Coordinate Helper ---
    const getPieceStyle = (color: PlayerColor, pos: number, traveled: number, pieceId: number) => {
        // Base Positions
        if (pos === -1) {
            const baseMap = {
                GREEN: { r: 1, c: 1 },
                YELLOW: { r: 1, c: 10 },
                RED: { r: 10, c: 1 },
                BLUE: { r: 10, c: 10 }
            };
            // Exact offsets to hit corners of 6x6 base: (2,2), (2,5), (5,2), (5,5) relative to base start (1,1)
            // If base starts at 1, then +1 = 2, +4 = 5.
            const b = baseMap[color];
            const offsets = [[1, 1], [1, 4], [4, 1], [4, 4]];

            return {
                gridRow: b.r + offsets[pieceId][0],
                gridColumn: b.c + offsets[pieceId][1]
            };
        }

        // Main Path & Home Stretch
        if (traveled > 50) {
            // 51 -> Index 0 of Home Path
            const homeIdx = traveled - 51;
            if (homeIdx >= 0 && homeIdx < 5) {
                const coord = HOME_PATHS[color][homeIdx];
                return { gridRow: coord.r, gridColumn: coord.c };
            }
            if (homeIdx >= 5) {
                // Winner Center
                return { gridRow: 8, gridColumn: 8, opacity: 0.5 }; // Inside center
            }
        }

        const coord = PATH_COORDS[pos];
        if (coord) {
            return { gridRow: coord.r, gridColumn: coord.c };
        }

        return { gridRow: 1, gridColumn: 1, display: 'none' };
    };

    const payouts = getPayouts();

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 600px) 300px', gap: '16px', height: '100%', justifyContent: 'center' }}>

            {/* Board Area */}
            <div className="game-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2f4553', padding: '16px' }}>
                <div className="ludo-board">
                    {/* Bases */}
                    <div className="base green"><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                    <div className="base yellow" style={{ gridColumn: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                    <div className="base red" style={{ gridRow: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                    <div className="base blue" style={{ gridRow: '10 / span 6', gridColumn: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>

                    {/* Center */}
                    <div className="home-center"></div>


                    {/* Main Path Cells */}
                    {PATH_COORDS.map((coord, i) => (
                        <div
                            key={`path-${i}`}
                            className={`cell ${SAFE_SPOTS.includes(i) ? 'safe' : ''}`}
                            style={{ gridRow: coord.r, gridColumn: coord.c }}
                        >
                            {/* Star icon for safe spots is handled via CSS background-image */}
                        </div>
                    ))}

                    {/* Home Stretch Cells */}
                    {Object.entries(HOME_PATHS).map(([color, paths]) =>
                        paths.map((coord, i) => (
                            <div
                                key={`home-${color}-${i}`}
                                className={`cell path-${color.toLowerCase()}`}
                                style={{ gridRow: coord.r, gridColumn: coord.c }}
                            />
                        ))
                    )}

                    {/* Rendering Pieces */}
                    {players.flatMap(p => p.pieces.map(piece => {
                        const style = getPieceStyle(piece.color, piece.position, piece.travelled, piece.id);
                        return (
                            <motion.div
                                key={`${p.color}-${piece.id}`}
                                className={`piece ${p.color.toLowerCase()} ${canMove(piece, diceValue || 0) && turnIndex === players.findIndex(pl => pl === p) && !p.isBot ? 'glow' : ''}`}
                                style={style}
                                onClick={() => {
                                    if (!p.isBot && canRoll === false && canMove(piece, diceValue || 0)) {
                                        movePiece(piece, diceValue!);
                                    }
                                }}
                                layout
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                    mass: 0.8
                                }}
                                animate={{
                                    scale: canMove(piece, diceValue || 0) && turnIndex === players.findIndex(pl => pl === p) ? [1, 1.05, 1] : 1
                                }}
                            />
                        );
                    }))}

                    {/* Player Info Panels */}
                    {players.map((player, idx) => {
                        const isActive = idx === turnIndex && gameState === 'PLAYING';
                        const colorMap = { GREEN: '#00cc00', YELLOW: '#ffdd00', BLUE: '#3399ff', RED: '#ff3333' };
                        const positions = [
                            { top: '-80px', left: '10px' }, // Green - Top Left
                            { top: '-80px', right: '10px' }, // Yellow - Top Right
                            { bottom: '-80px', right: '10px' }, // Blue - Bottom Right
                            { bottom: '-80px', left: '10px' } // Red - Bottom Left
                        ];

                        return (
                            <div key={player.color} style={{
                                position: 'absolute',
                                ...positions[idx],
                                background: isActive ? `linear-gradient(135deg, ${colorMap[player.color]}22, ${colorMap[player.color]}44)` : 'rgba(0,0,0,0.3)',
                                border: `3px solid ${isActive ? colorMap[player.color] : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '12px',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                boxShadow: isActive ? `0 0 20px ${colorMap[player.color]}88` : '0 2px 8px rgba(0,0,0,0.3)',
                                transition: 'all 0.3s ease',
                                zIndex: 100
                            }}>
                                {/* Avatar */}
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${colorMap[player.color]}, ${colorMap[player.color]}cc)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: '#fff',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                                }}>
                                    {player.name[0]}
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 'bold',
                                        color: isActive ? colorMap[player.color] : '#fff',
                                        marginBottom: '2px'
                                    }}>
                                        {player.name}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>
                                        {player.hasFinished ? '🏆 Finished' : isActive ? '⏳ Playing...' : 'Waiting'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar */}
            <div className="stake-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Prize Pool Info - Always Visible */}
                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                        <span>Prize Pool</span>
                        <span style={{ color: '#00e701' }}>₹{formatIndianNumber(payouts.prizePool)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ background: 'rgba(255, 215, 0, 0.1)', color: '#FFD700', padding: '4px 8px', borderRadius: '4px' }}>1st: ₹{formatIndianNumber(payouts.split.first)}</div>
                        <div style={{ background: 'rgba(192, 192, 192, 0.1)', color: '#C0C0C0', padding: '4px 8px', borderRadius: '4px' }}>2nd: ₹{formatIndianNumber(payouts.split.second)}</div>
                        <div style={{ background: 'rgba(205, 127, 50, 0.1)', color: '#CD7F32', padding: '4px 8px', borderRadius: '4px' }}>3rd: ₹{formatIndianNumber(payouts.split.third)}</div>
                    </div>
                </div>

                {/* Stats / Controls */}
                {gameState === 'BETTING' ? (
                    <div style={{ textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                        <h2>Ludo Arena</h2>
                        <div className="input-group" style={{ margin: '16px 0' }}>
                            <label>Entry Fee</label>
                            <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} style={{ background: 'transparent', color: '#fff', border: 'none' }} />
                        </div>
                        <div style={{ padding: '16px', background: '#0f212e', borderRadius: '8px', marginBottom: '16px' }}>
                            <div style={{ color: '#b1bad3', marginBottom: '4px' }}>Total Pot: <span style={{ color: '#fff' }}>₹{formatIndianNumber(betAmount * 4)}</span></div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>House Edge: 10%</div>
                        </div>
                        <button className="btn-primary" onClick={handleStart} style={{ width: '100%', padding: '16px' }}>Join Game</button>
                    </div>
                ) : (
                    <>
                        {/* Turn Indicator */}
                        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: '#b1bad3' }}>Current Turn</div>
                            <h2 style={{ color: currentPlayer.color === 'GREEN' ? '#00cc00' : currentPlayer.color === 'RED' ? '#ff3333' : currentPlayer.color === 'BLUE' ? '#3399ff' : '#ffdd00', margin: '8px 0' }}>
                                {currentPlayer.name}
                            </h2>
                            {/* Timer Display */}
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: turnTimeLeft <= 10 ? '#ff3333' : '#00cc00',
                                marginTop: '8px'
                            }}>
                                ⏱️ {turnTimeLeft}s
                            </div>
                        </div>

                        {/* Dice */}
                        <motion.div
                            className={`dice-container ${canRoll && !currentPlayer.isBot ? 'active' : ''}`}
                            onClick={() => !currentPlayer.isBot && rollDice()}
                            style={{
                                width: '100px', height: '100px',
                                background: '#fff',
                                borderRadius: '16px',
                                margin: '0 auto 24px auto',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '3.5rem', color: '#000', fontWeight: 'bold',
                                boxShadow: canRoll && !currentPlayer.isBot ? '0 8px 16px rgba(0,0,0,0.3), 0 0 0 4px rgba(255,215,0,0.5)' : '0 4px 8px rgba(0,0,0,0.2)',
                                border: '2px solid #ddd',
                                cursor: canRoll && !currentPlayer.isBot ? 'pointer' : 'default',
                                opacity: canRoll && !currentPlayer.isBot ? 1 : 0.5,
                                transition: 'all 0.3s ease',
                            }}
                            animate={{
                                scale: canRoll && !currentPlayer.isBot ? 1.05 : 1,
                                rotate: canRoll && !currentPlayer.isBot ? [0, -5, 5, -5, 0] : 0,
                            }}
                            whileHover={canRoll && !currentPlayer.isBot ? { scale: 1.1, rotate: 10 } : {}}
                            whileTap={canRoll && !currentPlayer.isBot ? {
                                scale: 0.95,
                                rotateX: [0, 360, 720],
                                rotateY: [0, 360, 720],
                                transition: { duration: 0.6 }
                            } : {}}
                        >
                            {diceValue ? (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {renderDiceFace(diceValue)}
                                </div>
                            ) : (
                                <span style={{ fontSize: '1.2rem', color: '#999', fontWeight: 'normal' }}>ROLL</span>
                            )}
                        </motion.div>

                        {/* Log */}
                        <div style={{ flex: 1, background: '#0f212e', borderRadius: '8px', padding: '12px', overflowY: 'auto' }}>
                            {log.map((l, i) => (
                                <div key={i} style={{ marginBottom: '4px', fontSize: '0.8rem', borderBottom: '1px solid #2f4553', paddingBottom: '4px' }}>{l}</div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
