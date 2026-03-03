import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGame } from '../../contexts/GameContext';
import { wsService } from '../../services/websocket';
import {
    playDiceShake,
    playPieceMove,
    playCapture,
    playHomeEntry,
    playWinSound,
    playTurnStart,
    playUrgencyTick,
} from '../../utils/sound';
import { formatIndianNumber } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import './LudoBoard.css';

// ─── Constants & Types ─────────────────────────────────────────────────

type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';
type MatchState = 'MENU' | 'QUEUING' | 'WAITING_ROOM' | 'PLAYING' | 'FINISHED';

interface ServerPiece {
    id: number;
    position: number;
    travelled: number;
    finished: boolean;
}

interface ServerPlayer {
    id: string | null;
    username: string;
    color: PlayerColor;
    isBot: boolean;
    isConnected?: boolean;
    reconnectDeadline?: number | null;
    pieces: ServerPiece[];
    finishedCount: number;
}

interface ServerGameState {
    gameId: string;
    code: string | null;
    status: 'WAITING' | 'PLAYING' | 'FINISHED';
    players: ServerPlayer[];
    currentPlayerIndex: number;
    currentPlayerColor: PlayerColor;
    lastRoll: number;
    waitingForMove: boolean;
    movablePieces: number[];
    winner: string | null;
    finishOrder: string[];
    betAmount: number;
    maxPlayers: 2 | 3 | 4;
    quickMode?: boolean;
    targetFinishCount?: number;
    turnTimeLimitMs?: number;
    isPrivate: boolean;
}

const PATH_COORDS = [
    { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }, { r: 7, c: 6 },
    { r: 6, c: 7 }, { r: 5, c: 7 }, { r: 4, c: 7 }, { r: 3, c: 7 }, { r: 2, c: 7 }, { r: 1, c: 7 },
    { r: 1, c: 8 }, { r: 1, c: 9 },
    { r: 2, c: 9 }, { r: 3, c: 9 }, { r: 4, c: 9 }, { r: 5, c: 9 }, { r: 6, c: 9 },
    { r: 7, c: 10 }, { r: 7, c: 11 }, { r: 7, c: 12 }, { r: 7, c: 13 }, { r: 7, c: 14 }, { r: 7, c: 15 },
    { r: 8, c: 15 }, { r: 9, c: 15 },
    { r: 9, c: 14 }, { r: 9, c: 13 }, { r: 9, c: 12 }, { r: 9, c: 11 }, { r: 9, c: 10 },
    { r: 10, c: 9 }, { r: 11, c: 9 }, { r: 12, c: 9 }, { r: 13, c: 9 }, { r: 14, c: 9 }, { r: 15, c: 9 },
    { r: 15, c: 8 }, { r: 15, c: 7 },
    { r: 14, c: 7 }, { r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 },
    { r: 9, c: 6 }, { r: 9, c: 5 }, { r: 9, c: 4 }, { r: 9, c: 3 }, { r: 9, c: 2 }, { r: 9, c: 1 },
    { r: 8, c: 1 }, { r: 7, c: 1 }
];

const HOME_PATHS: Record<PlayerColor, { r: number; c: number }[]> = {
    GREEN: [{ r: 8, c: 2 }, { r: 8, c: 3 }, { r: 8, c: 4 }, { r: 8, c: 5 }, { r: 8, c: 6 }],
    YELLOW: [{ r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }, { r: 5, c: 8 }, { r: 6, c: 8 }],
    BLUE: [{ r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 }],
    RED: [{ r: 14, c: 8 }, { r: 13, c: 8 }, { r: 12, c: 8 }, { r: 11, c: 8 }, { r: 10, c: 8 }]
};

const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];
const START_OFFSETS: Record<PlayerColor, number> = { GREEN: 0, YELLOW: 13, BLUE: 26, RED: 39 };
const LOCAL_COLOR_SLOTS: Record<2 | 3 | 4, PlayerColor[]> = {
    2: ['GREEN', 'BLUE'],
    3: ['GREEN', 'YELLOW', 'RED'],
    4: ['GREEN', 'YELLOW', 'BLUE', 'RED'],
};

const COLOR_MAP: Record<PlayerColor, { main: string; gradient: string; glow: string }> = {
    GREEN: { main: '#2ecc40', gradient: 'linear-gradient(135deg, #2ecc40, #1a9c2a)', glow: 'rgba(46, 204, 64, 0.4)' },
    YELLOW: { main: '#f5d000', gradient: 'linear-gradient(135deg, #ffe066, #e6b800)', glow: 'rgba(230, 184, 0, 0.4)' },
    BLUE: { main: '#3498db', gradient: 'linear-gradient(135deg, #5dade2, #2471a3)', glow: 'rgba(52, 152, 219, 0.4)' },
    RED: { main: '#e74c3c', gradient: 'linear-gradient(135deg, #ff4d4d, #cc0000)', glow: 'rgba(231, 76, 60, 0.4)' },
};

const BET_PRESETS = [50, 100, 500, 1000];
const INTERNAL_MULTIPLIER = 100000;

// ─── Sub-Components ────────────────────────────────────────────────────

const TimerRing: React.FC<{ timeLeft: number; maxTime: number; color: string }> = ({ timeLeft, maxTime, color }) => {
    const radius = 11;
    const circumference = 2 * Math.PI * radius;
    const progress = (timeLeft / maxTime) * circumference;

    return (
        <svg className="ludo-timer-ring" viewBox="0 0 28 28">
            <circle className="timer-bg" cx="14" cy="14" r={radius} />
            <circle
                className="timer-progress"
                cx="14" cy="14" r={radius}
                stroke={timeLeft <= 10 ? '#ff4d4d' : color}
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                transform="rotate(-90 14 14)"
            />
            <text x="14" y="15" textAnchor="middle" dominantBaseline="middle"
                fill={timeLeft <= 10 ? '#ff4d4d' : '#fff'} fontSize="8" fontWeight="700">
                {timeLeft}
            </text>
        </svg>
    );
};

const DiceFace: React.FC<{ value: number }> = ({ value }) => {
    const dot = (key: number, red = false) => (
        <div key={key} className={`dice-dot${red ? ' red-dot' : ''}`} />
    );
    const empty = (key: number) => <div key={key} />;

    const layouts: Record<number, (number | 'e' | 'r')[]> = {
        1: ['e', 'e', 'e', 'e', 'r', 'e', 'e', 'e', 'e'],
        2: [1, 'e', 'e', 'e', 'e', 'e', 'e', 'e', 2],
        3: [1, 'e', 'e', 'e', 2, 'e', 'e', 'e', 3],
        4: [1, 'e', 2, 'e', 'e', 'e', 3, 'e', 4],
        5: [1, 'e', 2, 'e', 3, 'e', 4, 'e', 5],
        6: [1, 'e', 2, 3, 'e', 4, 5, 'e', 6],
    };

    const layout = layouts[value] || layouts[1];

    return (
        <div className="dice-face">
            {layout.map((cell, i) =>
                cell === 'e' ? empty(i) : cell === 'r' ? dot(i, true) : dot(i)
            )}
        </div>
    );
};

const Confetti: React.FC = () => {
    const particles = useMemo(() => (
        Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 0.3,
            duration: 1.5 + Math.random() * 1,
            color: ['#FFD700', '#FF4500', '#00FF00', '#00CED1', '#FF1493'][Math.floor(Math.random() * 5)],
        }))
    ), []);

    return (
        <div className="confetti-container">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="confetti-particle"
                    style={{
                        left: `${p.x}%`,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        background: p.color,
                    }}
                />
            ))}
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────

export const LudoGame: React.FC = () => {
    const { user, isAuthenticated, wsStatus } = useGame();

    const [matchState, setMatchState] = useState<MatchState>('MENU');
    const [serverState, setServerState] = useState<ServerGameState | null>(null);
    const [myColor, setMyColor] = useState<PlayerColor | null>(null);

    const [betAmount, setBetAmount] = useState(100);
    const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
    const [quickMode, setQuickMode] = useState(false);
    const [menuMode, setMenuMode] = useState<'quick' | 'private' | 'local'>('quick');
    const [localSetupStep, setLocalSetupStep] = useState<'players' | 'color'>('players');
    const [localPreferredColor, setLocalPreferredColor] = useState<PlayerColor>('GREEN');
    const [joinCode, setJoinCode] = useState('');
    const [queueTimer, setQueueTimer] = useState(0);
    const [menuError, setMenuError] = useState('');

    const [diceValue, setDiceValue] = useState<number | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const [showSixEffect, setShowSixEffect] = useState(false);
    const [turnTimeLeft, setTurnTimeLeft] = useState(30);
    const [log, setLog] = useState<{ text: string; type: 'normal' | 'kill' | 'finish' }[]>([]);

    const [finishData, setFinishData] = useState<any>(null);

    // Animation states
    const [showConfetti, setShowConfetti] = useState(false);
    const [capturingPiece, setCapturingPiece] = useState<{color: PlayerColor, pieceId: number} | null>(null);
    const [sparklingPiece, setSparklingPiece] = useState<{color: PlayerColor, pieceId: number} | null>(null);
    const [movingPieceTrail, setMovingPieceTrail] = useState<{color: PlayerColor, pieceId: number} | null>(null);
    const [isLocalMatch, setIsLocalMatch] = useState(false);
    const [localHumanPlayerId, setLocalHumanPlayerId] = useState<string | null>(null);
    const [showRollHint, setShowRollHint] = useState(false);
    const [rollHintCount, setRollHintCount] = useState(0);

    const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const diceAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const localConsecutiveSixesRef = useRef(0);
    const isLocalMatchRef = useRef(false);

    useEffect(() => {
        isLocalMatchRef.current = isLocalMatch;
    }, [isLocalMatch]);

    useEffect(() => {
        if (isAuthenticated && wsStatus === 'DISCONNECTED') {
            wsService.connect();
        }
    }, [isAuthenticated, wsStatus]);

    useEffect(() => {
        if (menuMode === 'local') {
            setLocalSetupStep('players');
            setQuickMode(false);
        }
    }, [menuMode]);

    const addToLog = useCallback((text: string, type: 'normal' | 'kill' | 'finish') => {
        setLog(prev => [{ text, type }, ...prev].slice(0, 10));
    }, []);

    const flashMovedPiece = useCallback((color?: PlayerColor, pieceId?: number) => {
        if (!color || typeof pieceId !== 'number') return;
        setMovingPieceTrail({ color, pieceId });
        setTimeout(() => setMovingPieceTrail(null), 420);
    }, []);

    // Haptic feedback helper
    const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
        if ('vibrate' in navigator) {
            const patterns = { light: 10, medium: 20, heavy: 30 };
            navigator.vibrate(patterns[type]);
        }
    }, []);

    // ─── WebSocket Message Handler ─────────────────────────────────────

    useEffect(() => {
        const unsub = wsService.onMessage((msg: any) => {
            if (isLocalMatchRef.current) return;
            if (msg.game !== 'ludo') return;

            switch (msg.type) {
                case 'game_state':
                    handleGameState(msg.data);
                    break;
                case 'queue_joined':
                    setMatchState('QUEUING');
                    startQueueTimer();
                    break;
                case 'queue_left':
                    setMatchState('MENU');
                    stopQueueTimer();
                    break;
                case 'match_found':
                    setMatchState('PLAYING');
                    stopQueueTimer();
                    addToLog('Match found!', 'finish');
                    break;
                case 'dice_result':
                    handleDiceResult(msg.data);
                    break;
                case 'piece_moved':
                    handlePieceMoved(msg.data);
                    break;
                case 'piece_captured':
                    handlePieceCaptured(msg.data);
                    break;
                case 'piece_home':
                    handlePieceHome(msg.data);
                    break;
                case 'turn_start':
                    handleTurnStart(msg.data);
                    break;
                case 'player_connection':
                    if (msg.data?.connected === false && msg.data?.username) {
                        addToLog(`${msg.data.username} disconnected`, 'normal');
                    } else if (msg.data?.connected === true && msg.data?.username) {
                        addToLog(`${msg.data.username} reconnected`, 'finish');
                    }
                    break;
                case 'game_finished':
                    handleGameFinished(msg.data);
                    break;
                case 'error':
                    console.error('Ludo error:', msg.data?.message);
                    setMenuError(msg.data?.message || 'Something went wrong');
                    setTimeout(() => setMenuError(''), 5000);
                    break;
            }
        });

        return () => {
            unsub();
            stopQueueTimer();
            stopTurnTimer();
            if (diceAnimRef.current) {
                clearInterval(diceAnimRef.current);
                diceAnimRef.current = null;
            }
        };
    }, []);

    const handleGameState = useCallback((data: ServerGameState) => {
        setServerState(data);
        if (user) {
            const myPlayer = data.players.find(p => p.id === user.id);
            if (myPlayer) setMyColor(myPlayer.color);
        }
        if (data.status === 'WAITING') setMatchState('WAITING_ROOM');
        else if (data.status === 'PLAYING') setMatchState('PLAYING');
        else if (data.status === 'FINISHED') setMatchState('FINISHED');
    }, [user]);

    const handleDiceResult = useCallback((data: any) => {
        const { roll, playerColor, canMove, skipped, reason } = data;
        setIsRolling(true);
        playDiceShake();

        if (diceAnimRef.current) {
            clearInterval(diceAnimRef.current);
            diceAnimRef.current = null;
        }

        let i = 0;
        const maxTicks = 12;
        diceAnimRef.current = setInterval(() => {
            setDiceValue(Math.floor(Math.random() * 6) + 1);
            i++;
            if (i >= maxTicks) {
                if (diceAnimRef.current) {
                    clearInterval(diceAnimRef.current);
                    diceAnimRef.current = null;
                }
                setDiceValue(roll);
                setIsRolling(false);
                if (roll === 6) {
                    setShowSixEffect(true);
                    setTimeout(() => setShowSixEffect(false), 1200);
                }
                if (skipped && reason === 'three_sixes') {
                    addToLog(`${playerColor} rolled 3 sixes! Turn skipped.`, 'normal');
                } else if (!canMove) {
                    addToLog(`${playerColor} rolled ${roll}. No moves.`, 'normal');
                } else {
                    addToLog(`${playerColor} rolled ${roll}`, 'normal');
                }
            }
        }, 65);
    }, [addToLog]);

    const handlePieceMoved = useCallback((data: any) => {
        playPieceMove();
        triggerHaptic('light');
        flashMovedPiece(data.playerColor, data.pieceId);
        if (data.captured) addToLog(`${data.playerColor} captured a piece!`, 'kill');
    }, [addToLog, triggerHaptic, flashMovedPiece]);

    const handlePieceCaptured = useCallback((data: any) => {
        playCapture();
        triggerHaptic('heavy');
        addToLog(`${data.capturedBy} captured ${data.capturedPlayer}'s piece!`, 'kill');

        // Trigger capture animation
        setCapturingPiece({ color: data.capturedPlayer, pieceId: data.capturedPieceId });
        setTimeout(() => setCapturingPiece(null), 600);
    }, [addToLog, triggerHaptic]);

    const handlePieceHome = useCallback((data: any) => {
        playHomeEntry();
        triggerHaptic('medium');
        const finishTarget = serverState?.targetFinishCount || 4;
        addToLog(`${data.playerColor} got a piece home! (${data.finishedCount}/${finishTarget})`, 'finish');

        // Trigger sparkle animation
        setSparklingPiece({ color: data.playerColor, pieceId: data.pieceId });
        setTimeout(() => setSparklingPiece(null), 1200);
    }, [addToLog, triggerHaptic, serverState?.targetFinishCount]);

    const handleTurnStart = useCallback((data: any) => {
        const turnSecs = Math.max(8, Math.floor((data?.turnTimeLimitMs || serverState?.turnTimeLimitMs || 30000) / 1000));
        setTurnTimeLeft(turnSecs);
        startTurnTimer(turnSecs);
        if (data?.playerId && data.playerId === user?.id) {
            playTurnStart();
            triggerHaptic('light');
        }
    }, [triggerHaptic, user?.id, serverState?.turnTimeLimitMs]);

    const handleGameFinished = useCallback((data: any) => {
        setFinishData(data);
        setMatchState('FINISHED');
        stopTurnTimer();
        addToLog('Game Over!', 'finish');

        // Trigger celebration
        playWinSound();
        triggerHaptic('heavy');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
    }, [addToLog, triggerHaptic]);

    // ─── Timers ────────────────────────────────────────────────────────

    const startQueueTimer = () => {
        setQueueTimer(0);
        queueTimerRef.current = setInterval(() => setQueueTimer(prev => prev + 1), 1000);
    };

    const stopQueueTimer = () => {
        if (queueTimerRef.current) { clearInterval(queueTimerRef.current); queueTimerRef.current = null; }
        setQueueTimer(0);
    };

    const startTurnTimer = (durationSeconds = 30) => {
        stopTurnTimer();
        setTurnTimeLeft(durationSeconds);
        turnTimerRef.current = setInterval(() => {
            setTurnTimeLeft(prev => prev <= 1 ? 0 : prev - 1);
        }, 1000);
    };

    const stopTurnTimer = () => {
        if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
    };

    // ─── Actions ───────────────────────────────────────────────────────

    const cloneGameState = (state: ServerGameState): ServerGameState => ({
        ...state,
        players: state.players.map(p => ({
            ...p,
            pieces: p.pieces.map(pc => ({ ...pc })),
        })),
        finishOrder: [...state.finishOrder],
        movablePieces: [...state.movablePieces],
    });

    const getLocalMovablePieces = (player: ServerPlayer, roll: number): number[] => {
        const movable: number[] = [];
        for (const piece of player.pieces) {
            if (piece.finished) continue;
            if (piece.position === -1 && roll === 6) {
                movable.push(piece.id);
                continue;
            }
            if (piece.position === -2) {
                if (piece.travelled + roll <= 56) movable.push(piece.id);
                continue;
            }
            if (piece.position >= 0) {
                if (piece.travelled + roll <= 56) movable.push(piece.id);
            }
        }
        return movable;
    };

    const ensureOnlineReady = (): boolean => {
        if (!isAuthenticated) {
            setMenuError('Sign in required for online play');
            return false;
        }
        if (wsStatus !== 'CONNECTED') {
            wsService.connect();
            setMenuError('Connecting to game server. Try again in a moment.');
            return false;
        }
        return true;
    };

    const startLocalMatch = () => {
        const colors = LOCAL_COLOR_SLOTS[maxPlayers];
        const chosenColor = colors.includes(localPreferredColor) ? localPreferredColor : colors[0];
        const orderedColors = [chosenColor, ...colors.filter(c => c !== chosenColor)];
        const players: ServerPlayer[] = orderedColors.map((color, i) => ({
            id: `local_${i + 1}`,
            username: i === 0 ? (user?.username || 'Player 1') : `Player ${i + 1}`,
            color,
            isBot: false,
            pieces: Array.from({ length: 4 }, (_, pid) => ({
                id: pid,
                position: -1,
                travelled: 0,
                finished: false,
            })),
            finishedCount: 0,
        }));

        setIsLocalMatch(true);
        localConsecutiveSixesRef.current = 0;
        setLocalHumanPlayerId(players[0].id);
        setMyColor(players[0].color);
        setServerState({
            gameId: `local_${Date.now()}`,
            code: null,
            status: 'PLAYING',
            players,
            currentPlayerIndex: 0,
            currentPlayerColor: players[0].color,
            lastRoll: 0,
            waitingForMove: false,
            movablePieces: [],
            winner: null,
            finishOrder: [],
            betAmount: 0,
            maxPlayers,
            quickMode,
            targetFinishCount: quickMode ? 2 : 4,
            turnTimeLimitMs: quickMode ? 18000 : 30000,
            isPrivate: false,
        });
        setLog([{ text: 'Local game started', type: 'finish' }]);
        setMatchState('PLAYING');
        setMenuError('');
        setDiceValue(null);
        setFinishData(null);
        setRollHintCount(0);
        setShowRollHint(false);
        startTurnTimer(quickMode ? 18 : 30);
    };

    const finishLocalIfNeeded = (state: ServerGameState): boolean => {
        const finishTarget = state.targetFinishCount || 4;
        const unfinished = state.players.filter(p => p.finishedCount < finishTarget);
        if (unfinished.length > 1) return false;

        unfinished.forEach(p => {
            if (!state.finishOrder.includes(p.id || p.username)) {
                state.finishOrder.push(p.id || p.username);
            }
        });
        state.status = 'FINISHED';
        const winnerId = state.finishOrder[0];
        state.winner = winnerId;

        const finishPayload = {
            winner: winnerId,
            finishOrder: state.finishOrder.map(id => {
                const p = state.players.find(pp => (pp.id || pp.username) === id);
                return { id: p?.id, username: p?.username, color: p?.color, isBot: p?.isBot };
            }),
            payouts: {},
        };
        handleGameFinished(finishPayload);
        return true;
    };

    const nextLocalTurn = (state: ServerGameState, bonusTurn: boolean) => {
        if (!bonusTurn) {
            state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
            localConsecutiveSixesRef.current = 0;
        }
        state.currentPlayerColor = state.players[state.currentPlayerIndex].color;
        state.lastRoll = 0;
        state.waitingForMove = false;
        state.movablePieces = [];
        setTurnTimeLeft(Math.max(8, Math.floor((state.turnTimeLimitMs || 30000) / 1000)));
    };

    const executeLocalMove = (pieceId: number, explicitRoll?: number) => {
        if (!serverState || serverState.status !== 'PLAYING') return;

        const state = cloneGameState(serverState);
        const roll = explicitRoll ?? state.lastRoll;
        if (!roll) return;

        const player = state.players[state.currentPlayerIndex];
        const piece = player.pieces.find(p => p.id === pieceId);
        if (!piece) return;

        const startOffset = START_OFFSETS[player.color];
        let captured = false;

        if (piece.position === -1) {
            if (roll !== 6) return;
            piece.position = startOffset;
            piece.travelled = 0;
        } else {
            const newTravelled = piece.travelled + roll;
            if (newTravelled > 56) return;

            if (newTravelled >= 51) {
                piece.position = newTravelled === 56 ? -3 : -2;
                piece.travelled = newTravelled;
                if (newTravelled === 56 && !piece.finished) {
                    piece.finished = true;
                    player.finishedCount += 1;
                    addToLog(`${player.color} got a piece home! (${player.finishedCount}/${state.targetFinishCount || 4})`, 'finish');
                    playHomeEntry();
                }
            } else {
                const newAbsPos = (startOffset + newTravelled) % 52;
                piece.position = newAbsPos;
                piece.travelled = newTravelled;

                if (!SAFE_SPOTS.includes(newAbsPos)) {
                    for (const other of state.players) {
                        if (other.color === player.color) continue;
                        for (const otherPiece of other.pieces) {
                            if (otherPiece.position === newAbsPos && otherPiece.position >= 0) {
                                otherPiece.position = -1;
                                otherPiece.travelled = 0;
                                captured = true;
                                addToLog(`${player.color} captured ${other.color}!`, 'kill');
                                playCapture();
                            }
                        }
                    }
                }
            }
        }

        playPieceMove();
        flashMovedPiece(player.color, piece.id);
        state.waitingForMove = false;
        state.movablePieces = [];
        setServerState(state);

        if (finishLocalIfNeeded(state)) return;

        const bonusTurn = roll === 6 || captured;
        setTimeout(() => {
            setServerState(prev => {
                if (!prev || prev.status !== 'PLAYING') return prev;
                const next = cloneGameState(prev);
                nextLocalTurn(next, bonusTurn);
                return next;
            });
            if (!bonusTurn) addToLog(`${player.color} turn ended`, 'normal');
        }, 350);
    };

    const pickLocalBotMove = (state: ServerGameState, player: ServerPlayer, movable: number[], roll: number): number => {
        if (movable.length === 1) return movable[0];
        const startOffset = START_OFFSETS[player.color];
        let bestPiece = movable[0];
        let bestScore = -Infinity;

        for (const pieceId of movable) {
            const piece = player.pieces.find(p => p.id === pieceId);
            if (!piece) continue;
            let score = 0;

            if (piece.position === -1 && roll === 6) {
                score += 35;
            } else {
                const newTravelled = piece.travelled + roll;
                if (newTravelled === 56) score += 100;
                score += newTravelled;

                if (newTravelled < 51) {
                    const newAbsPos = (startOffset + newTravelled) % 52;
                    if (SAFE_SPOTS.includes(newAbsPos)) score += 8;
                    for (const other of state.players) {
                        if (other.color === player.color) continue;
                        if (other.pieces.some(op => op.position === newAbsPos && op.position >= 0)) {
                            score += 55;
                        }
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestPiece = pieceId;
            }
        }

        return bestPiece;
    };

    const findMatch = () => {
        if (!ensureOnlineReady()) return;
        setIsLocalMatch(false);
        setMenuError('');
        wsService.send({
            game: 'ludo',
            type: 'find_match',
            data: { betAmount: Math.floor(betAmount * INTERNAL_MULTIPLIER), maxPlayers, quickMode },
        });
    };

    const cancelMatch = () => {
        wsService.send({ game: 'ludo', type: 'cancel_match', data: {} });
        setMatchState('MENU');
        stopQueueTimer();
    };

    const createPrivateRoom = () => {
        if (!ensureOnlineReady()) return;
        setIsLocalMatch(false);
        setMenuError('');
        wsService.send({
            game: 'ludo',
            type: 'create_private',
            data: { betAmount: Math.floor(betAmount * INTERNAL_MULTIPLIER), maxPlayers, quickMode },
        });
    };

    const joinPrivateRoom = () => {
        if (!ensureOnlineReady() || !joinCode.trim()) return;
        setIsLocalMatch(false);
        setMenuError('');
        wsService.send({ game: 'ludo', type: 'join_private', data: { code: joinCode.trim().toUpperCase() } });
    };

    const startGame = () => {
        if (!ensureOnlineReady()) return;
        wsService.send({ game: 'ludo', type: 'start_game', data: {} });
    };

    const rollDice = () => {
        if (isRolling || !serverState || serverState.status !== 'PLAYING') return;
        triggerHaptic('medium');
        if (showRollHint) {
            setShowRollHint(false);
            setRollHintCount(prev => prev + 1);
        }

        if (!isLocalMatch) {
            wsService.send({ game: 'ludo', type: 'roll_dice', data: {} });
            return;
        }

        const state = cloneGameState(serverState);
        const player = state.players[state.currentPlayerIndex];
        const isLocalBotTurn = !!(isLocalMatch && localHumanPlayerId && player.id !== localHumanPlayerId);
        const roll = Math.floor(Math.random() * 6) + 1;
        state.lastRoll = roll;

        if (roll === 6) {
            localConsecutiveSixesRef.current += 1;
        } else {
            localConsecutiveSixesRef.current = 0;
        }

        const skipped = localConsecutiveSixesRef.current >= 3;
        if (skipped) localConsecutiveSixesRef.current = 0;

        const movable = skipped ? [] : getLocalMovablePieces(player, roll);
        state.movablePieces = movable;
        state.waitingForMove = !isLocalBotTurn && movable.length > 1;
        setServerState(state);

        handleDiceResult({
            roll,
            playerColor: player.color,
            canMove: movable.length > 0 && !skipped,
            skipped,
            reason: skipped ? 'three_sixes' : undefined,
        });

        if (movable.length === 1 && !skipped) {
            setTimeout(() => executeLocalMove(movable[0], roll), 500);
            return;
        }

        if (movable.length > 1 && !skipped && isLocalBotTurn) {
            const bestPiece = pickLocalBotMove(state, player, movable, roll);
            setTimeout(() => executeLocalMove(bestPiece, roll), 650);
            return;
        }

        if (skipped || movable.length === 0) {
            setTimeout(() => {
                setServerState(prev => {
                    if (!prev || prev.status !== 'PLAYING') return prev;
                    const next = cloneGameState(prev);
                    nextLocalTurn(next, false);
                    return next;
                });
            }, 600);
        }
    };

    const movePiece = (pieceId: number) => {
        if (isLocalMatch) {
            executeLocalMove(pieceId);
            return;
        }
        wsService.send({ game: 'ludo', type: 'move', data: { pieceId } });
    };

    const leaveGame = () => {
        if (!isLocalMatch) {
            wsService.send({ game: 'ludo', type: 'leave_game', data: {} });
        }
        setIsLocalMatch(false);
        setLocalHumanPlayerId(null);
        setMatchState('MENU');
        setServerState(null);
        setMyColor(null);
        setDiceValue(null);
        setLog([]);
        setFinishData(null);
        setMovingPieceTrail(null);
        setShowRollHint(false);
        stopTurnTimer();
    };

    const playAgain = () => {
        setIsLocalMatch(false);
        setLocalHumanPlayerId(null);
        setFinishData(null);
        setServerState(null);
        setMyColor(null);
        setDiceValue(null);
        setLog([]);
        setMovingPieceTrail(null);
        setShowRollHint(false);
        setMatchState('MENU');
    };

    // ─── Piece Rendering ──────────────────────────────────────────────

    const getPieceStyle = (color: PlayerColor, pos: number, traveled: number, pieceId: number) => {
        // Validate bounds
        if (traveled < 0 || traveled > 56) {
            return { gridRow: 1, gridColumn: 1, display: 'none' as const };
        }

        // In base (-1)
        if (pos === -1) {
            const baseMap: Record<PlayerColor, { r: number; c: number }> = {
                GREEN: { r: 1, c: 1 }, YELLOW: { r: 1, c: 10 }, RED: { r: 10, c: 1 }, BLUE: { r: 10, c: 10 }
            };
            const b = baseMap[color];
            const offsets = [[1, 1], [1, 4], [4, 1], [4, 4]];
            return { gridRow: b.r + offsets[pieceId][0], gridColumn: b.c + offsets[pieceId][1] };
        }

        // Finished (-3) or at home center
        if (pos === -3 || (pos === -2 && traveled >= 56)) {
            return { gridRow: 8, gridColumn: 8, opacity: 0.5 };
        }

        // In home stretch (pos === -2 OR travelled >= 51)
        if (pos === -2 || traveled >= 51) {
            // Home stretch: travelled 51-56 maps to HOME_PATHS[0-5]
            const homeIdx = traveled - 51;
            if (homeIdx >= 0 && homeIdx <= 5) {
                const coord = HOME_PATHS[color][Math.min(homeIdx, 4)];
                return { gridRow: coord.r, gridColumn: coord.c };
            }
            // Fallback for out-of-bounds
            return { gridRow: 8, gridColumn: 8, opacity: 0.5 };
        }

        // On main path
        const coord = PATH_COORDS[pos];
        if (coord) return { gridRow: coord.r, gridColumn: coord.c };

        // Fallback
        return { gridRow: 1, gridColumn: 1, display: 'none' as const };
    };

    // ─── Derived State ─────────────────────────────────────────────────

    const isMyTurn = !!(serverState?.status === 'PLAYING' && (
        (isLocalMatch ? (!!localHumanPlayerId && serverState.players[serverState.currentPlayerIndex]?.id === localHumanPlayerId) :
        false) ||
        (user && serverState.players[serverState.currentPlayerIndex]?.id === user.id)
    ));
    const canRollDice = !!(isMyTurn && !serverState?.waitingForMove && !isRolling);
    const currentPlayer = serverState?.players[serverState.currentPlayerIndex];

    useEffect(() => {
        if (matchState !== 'PLAYING' || !isMyTurn) return;
        if (turnTimeLeft > 0 && turnTimeLeft <= 5) {
            playUrgencyTick();
            triggerHaptic('light');
        }
    }, [matchState, isMyTurn, turnTimeLeft, triggerHaptic]);

    useEffect(() => {
        if (
            matchState === 'PLAYING' &&
            !isLocalMatch &&
            isMyTurn &&
            canRollDice &&
            !serverState?.waitingForMove &&
            rollHintCount < 3
        ) {
            setShowRollHint(true);
            return;
        }
        setShowRollHint(false);
    }, [matchState, isLocalMatch, isMyTurn, canRollDice, serverState?.waitingForMove, rollHintCount]);

    useEffect(() => {
        if (!isLocalMatch || !serverState || serverState.status !== 'PLAYING' || isRolling) return;
        if (!localHumanPlayerId) return;
        const current = serverState.players[serverState.currentPlayerIndex];
        if (!current || current.id === localHumanPlayerId) return;
        if (serverState.waitingForMove) return;

        const t = setTimeout(() => rollDice(), 900);
        return () => clearTimeout(t);
    }, [
        isLocalMatch,
        serverState,
        localHumanPlayerId,
        isRolling,
    ]);

    // ─── Render: MENU ──────────────────────────────────────────────────

    if (matchState === 'MENU') {
        return (
            <div className="ludo-mobile-screen">
                <div className="ludo-mobile-card">
                    <h2 className="ludo-title">Ludo Arena</h2>
                    <p className="ludo-subtitle">Multiplayer board game with real-time betting</p>

                    {!isAuthenticated && menuMode !== 'local' && (
                        <div className="ludo-auth-warn">Sign in to play multiplayer</div>
                    )}

                    {/* Mode Tabs */}
                    <div className="ludo-tab-bar">
                        <button className={`ludo-tab${menuMode === 'quick' ? ' active' : ''}`} onClick={() => setMenuMode('quick')}>
                            Quick Match
                        </button>
                        <button className={`ludo-tab${menuMode === 'private' ? ' active' : ''}`} onClick={() => setMenuMode('private')}>
                            Private Room
                        </button>
                        <button className={`ludo-tab${menuMode === 'local' ? ' active' : ''}`} onClick={() => setMenuMode('local')}>
                            Local
                        </button>
                    </div>

                    {menuMode !== 'local' ? (
                        <>
                            <div className="ludo-field">
                                <label>Entry Fee</label>
                                <div className="bet-input-row">
                                    <input type="number" value={betAmount} onChange={e => setBetAmount(Math.max(0, Number(e.target.value)))} min={0} />
                                    <div className="bet-actions">
                                        <button className="btn-quick" onClick={() => setBetAmount(p => Math.max(0, Math.floor(p / 2)))}>1/2</button>
                                        <button className="btn-quick" onClick={() => setBetAmount(p => p * 2)}>2x</button>
                                    </div>
                                </div>
                                <div className="ludo-bet-quick">
                                    {BET_PRESETS.map(amt => (
                                        <button key={amt} onClick={() => setBetAmount(amt)}
                                            className={betAmount === amt ? 'selected' : ''}>
                                            {amt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="ludo-field">
                                <label>Players</label>
                                <div className="ludo-player-select">
                                    {([2, 3, 4] as const).map(n => (
                                        <button key={n} className={maxPlayers === n ? 'selected' : ''} onClick={() => setMaxPlayers(n)}>
                                            {n}P
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="ludo-field">
                                <label>Game Pace</label>
                                <div className="ludo-player-select">
                                    <button className={!quickMode ? 'selected' : ''} onClick={() => setQuickMode(false)}>
                                        Classic
                                    </button>
                                    <button className={quickMode ? 'selected' : ''} onClick={() => setQuickMode(true)}>
                                        Quick
                                    </button>
                                </div>
                                <div className="pot-row sub" style={{ marginTop: 8 }}>
                                    <span>{quickMode ? '2 pieces to finish · 18s turn timer' : '4 pieces to finish · 30s turn timer'}</span>
                                </div>
                            </div>

                            <div className="ludo-pot-info">
                                <div className="pot-row">
                                    <span>Total Pot</span>
                                    <span className="pot-value">{formatIndianNumber(betAmount * maxPlayers)}</span>
                                </div>
                                <div className="pot-row sub">
                                    <span>Winner Takes</span>
                                    <span className="pot-win">{formatIndianNumber(Math.floor(betAmount * maxPlayers * 0.95))}</span>
                                </div>
                                <div className="pot-row sub">
                                    <span>Mode</span>
                                    <span className="pot-win">{quickMode ? 'Quick' : 'Classic'}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="ludo-setup-panel">
                            {localSetupStep === 'players' ? (
                                <>
                                    <h3 className="ludo-setup-title">Select Players</h3>
                                    <div className="ludo-player-select ludo-player-select-large">
                                        {([2, 3, 4] as const).map(n => (
                                            <button key={n} className={maxPlayers === n ? 'selected' : ''} onClick={() => setMaxPlayers(n)}>
                                                {n} Players
                                            </button>
                                        ))}
                                    </div>
                                    <button className="ludo-action-btn primary" onClick={() => setLocalSetupStep('color')}>
                                        Next
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h3 className="ludo-setup-title">Select Your Color</h3>
                                    <div className="ludo-color-picker">
                                        {LOCAL_COLOR_SLOTS[maxPlayers].map((color) => (
                                            <button
                                                key={color}
                                                className={`ludo-color-dot ${color.toLowerCase()} ${localPreferredColor === color ? 'selected' : ''}`}
                                                onClick={() => setLocalPreferredColor(color)}
                                                aria-label={color}
                                            >
                                                {localPreferredColor === color ? '✓' : ''}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="ludo-action-row">
                                        <button className="ludo-action-btn secondary" onClick={() => setLocalSetupStep('players')}>Back</button>
                                        <button className="ludo-action-btn primary" onClick={startLocalMatch}>Play</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {menuError && <div className="ludo-error-banner">{menuError}</div>}

                    {/* Actions */}
                    {menuMode === 'quick' ? (
                        <button className="ludo-action-btn primary" onClick={findMatch} disabled={!isAuthenticated}>
                            Find Match
                        </button>
                    ) : menuMode === 'private' ? (
                        <div className="ludo-private-actions">
                            <button className="ludo-action-btn primary" onClick={createPrivateRoom} disabled={!isAuthenticated}>
                                Create Room
                            </button>
                            <div className="ludo-divider"><span>or join</span></div>
                            <div className="ludo-join-row">
                                <input
                                    type="text"
                                    className="ludo-code-input"
                                    placeholder="ROOM CODE"
                                    value={joinCode}
                                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                />
                                <button className="ludo-action-btn secondary" onClick={joinPrivateRoom}
                                    disabled={!isAuthenticated || joinCode.length < 6}>
                                    Join
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    // ─── Render: QUEUING ──────────────────────────────────────────────

    if (matchState === 'QUEUING') {
        const mins = Math.floor(queueTimer / 60);
        const secs = queueTimer % 60;

        return (
            <div className="ludo-mobile-screen">
                    <div className="ludo-mobile-card" style={{ textAlign: 'center' }}>
                    <div className="ludo-queue-spinner" />
                    <h2 className="ludo-title" style={{ marginTop: '20px' }}>Finding Match...</h2>
                    <p className="ludo-subtitle">
                        {maxPlayers} players, {formatIndianNumber(betAmount)} entry · {quickMode ? 'Quick' : 'Classic'}
                    </p>
                    <div className="ludo-queue-timer">{mins}:{secs.toString().padStart(2, '0')}</div>
                    <button className="ludo-action-btn secondary" onClick={cancelMatch}>Cancel</button>
                </div>
            </div>
        );
    }

    // ─── Render: WAITING ROOM ─────────────────────────────────────────

    if (matchState === 'WAITING_ROOM' && serverState) {
        const isCreator = user && serverState.players[0]?.id === user.id;
        const displayBet = serverState.betAmount / INTERNAL_MULTIPLIER;

        return (
            <div className="ludo-mobile-screen">
                <div className="ludo-mobile-card">
                    <h2 className="ludo-title">Waiting Room</h2>

                    {serverState.code && (
                        <div
                            className="ludo-room-code-box"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(serverState.code!);
                                    addToLog('Room code copied', 'normal');
                                } catch {
                                    setMenuError('Copy failed. Please copy manually.');
                                }
                            }}
                        >
                            <div className="code-label">Room Code</div>
                            <div className="code-value">{serverState.code}</div>
                            <div className="code-hint">Tap to copy</div>
                        </div>
                    )}

                    <div className="ludo-player-slots">
                        {Array.from({ length: serverState.maxPlayers }).map((_, i) => {
                            const player = serverState.players[i];
                            const color = player?.color;
                            const colors = color ? COLOR_MAP[color] : null;

                            return (
                                <div key={i} className={`ludo-slot${player ? ' filled' : ''}`}
                                    style={player ? { borderColor: colors?.main + '60' } as React.CSSProperties : {}}>
                                    <div className="slot-avatar" style={{ background: colors?.gradient || 'rgba(255,255,255,0.1)' }}>
                                        {player ? player.username[0].toUpperCase() : '?'}
                                    </div>
                                    <div className="slot-info">
                                        <div className="slot-name">{player ? player.username : 'Waiting...'}</div>
                                        {player && (
                                            <div className="slot-color" style={{ color: colors?.main }}>
                                                {color} {player.id === user?.id ? '(You)' : ''}
                                            </div>
                                        )}
                                    </div>
                                    {player ? (
                                        <div className="slot-ready">Ready</div>
                                    ) : (
                                        <div className="ludo-waiting-dots"><span /><span /><span /></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="ludo-pot-info" style={{ marginBottom: '12px' }}>
                        <div className="pot-row sub" style={{ justifyContent: 'center' }}>
                            <span>
                                {serverState.players.length}/{serverState.maxPlayers} players &middot; Entry: {formatIndianNumber(displayBet)} &middot; {serverState.quickMode ? 'Quick' : 'Classic'}
                            </span>
                        </div>
                    </div>

                    <div className="ludo-action-row">
                        <button className="ludo-action-btn secondary" onClick={leaveGame}>Leave</button>
                        {isCreator && (
                            <button className="ludo-action-btn primary" onClick={startGame} style={{ flex: 2 }}>
                                Start {serverState.players.length < serverState.maxPlayers ? '(+ bots)' : 'Game'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Render: PLAYING + FINISHED ───────────────────────────────────

    if ((matchState === 'PLAYING' || matchState === 'FINISHED') && serverState) {
        const players = serverState.players;
        const displayBet = serverState.betAmount / INTERNAL_MULTIPLIER;
        const totalPot = displayBet * players.length;
        const finishTarget = serverState.targetFinishCount || 4;
        const turnSeconds = Math.max(8, Math.floor((serverState.turnTimeLimitMs || 30000) / 1000));
        const myHudPlayer = isLocalMatch
            ? players[0]
            : players.find(p => p.id === user?.id) || null;
        const opponentHudPlayer = isLocalMatch
            ? players.find(p => p.id !== myHudPlayer?.id) || currentPlayer || null
            : null;

        return (
            <div className="ludo-game-screen">
                {/* Confetti Effect */}
                {showConfetti && <Confetti />}

                {/* Player Strip */}
                <div className="ludo-player-strip">
                    {players.map((player, idx) => {
                        const isActive = idx === serverState.currentPlayerIndex;
                        const colors = COLOR_MAP[player.color];
                        const isMe = player.id === user?.id;

                        return (
                            <div key={player.color}
                                className={`ludo-strip-player${isActive ? ' active' : ''}${isMe ? ' me' : ''}`}
                                style={{ '--strip-color': colors.main, '--strip-glow': colors.glow } as React.CSSProperties}>
                                <div className="strip-avatar" style={{ background: colors.gradient }}>
                                    {player.username[0].toUpperCase()}
                                </div>
                                <div className="strip-name">
                                    {isMe ? 'You' : player.username.slice(0, 6)}
                                    {player.isBot && <span className="strip-bot">BOT</span>}
                                    {!player.isBot && player.isConnected === false && <span className="strip-bot">OFF</span>}
                                </div>
                                <div className="strip-score">{player.finishedCount}/{finishTarget}</div>
                                {isActive && player.finishedCount < finishTarget && (
                                    <TimerRing timeLeft={turnTimeLeft} maxTime={turnSeconds} color={colors.main} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="ludo-play-area">
                    {/* Board */}
                    <div className="ludo-board-container">
                        <div className="ludo-board">
                        <div className="base green"><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="base yellow" style={{ gridColumn: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="base red" style={{ gridRow: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="base blue" style={{ gridRow: '10 / span 6', gridColumn: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="home-center" />
                        {PATH_COORDS.map((coord, i) => (
                            <div key={`path-${i}`} className={`cell ${SAFE_SPOTS.includes(i) ? 'safe' : ''}`} style={{ gridRow: coord.r, gridColumn: coord.c }} />
                        ))}
                        {Object.entries(HOME_PATHS).map(([color, paths]) =>
                            paths.map((coord, i) => (
                                <div key={`home-${color}-${i}`} className={`cell path-${color.toLowerCase()}`} style={{ gridRow: coord.r, gridColumn: coord.c }} />
                            ))
                        )}
                        {players.flatMap(p =>
                            p.pieces.map(piece => {
                                const style = getPieceStyle(p.color, piece.position, piece.travelled, piece.id);
                                const activeColor = currentPlayer?.color;
                                const isMovable = serverState.waitingForMove &&
                                    serverState.movablePieces.includes(piece.id) &&
                                    !piece.finished &&
                                    (isLocalMatch ? p.color === activeColor : (isMyTurn && p.color === myColor));

                                // Check for animation states
                                const isCaptured = capturingPiece?.color === p.color && capturingPiece?.pieceId === piece.id;
                                const isSparkling = sparklingPiece?.color === p.color && sparklingPiece?.pieceId === piece.id;
                                const isMovingTrail = movingPieceTrail?.color === p.color && movingPieceTrail?.pieceId === piece.id;

                                const classNames = [
                                    'piece',
                                    p.color.toLowerCase(),
                                    isMovable && 'glow',
                                    isMovingTrail && 'trail',
                                    isCaptured && 'captured',
                                    isSparkling && 'sparkling',
                                ].filter(Boolean).join(' ');

                                return (
                                    <motion.div
                                        key={`${p.color}-${piece.id}`}
                                        className={classNames}
                                        style={{ ...style, cursor: isMovable ? 'pointer' : 'default' }}
                                        onClick={() => {
                                            if (isMovable) {
                                                triggerHaptic('light');
                                                movePiece(piece.id);
                                            }
                                        }}
                                        layout
                                        transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
                                    />
                                );
                            })
                        )}
                        </div>

                        {matchState === 'PLAYING' && isLocalMatch && myHudPlayer && (
                            <>
                                <div className="ludo-board-hud top">
                                    <div className="hud-token" style={{ background: COLOR_MAP[(opponentHudPlayer?.color || currentPlayer?.color || 'GREEN') as PlayerColor].gradient }} />
                                    <motion.div
                                        className={`ludo-dice hud-dice ${!isMyTurn && !isRolling ? 'can-roll' : 'disabled'} ${isRolling ? 'rolling' : ''}`}
                                    >
                                        {diceValue ? <DiceFace value={diceValue} /> : <span className="hud-dice-wait">...</span>}
                                    </motion.div>
                                </div>

                                <div className="ludo-board-hud bottom">
                                    <div className="hud-token" style={{ background: COLOR_MAP[myHudPlayer.color].gradient }} />
                                    <motion.div
                                        className={`ludo-dice hud-dice ${canRollDice ? 'can-roll' : 'disabled'} ${isRolling ? 'rolling' : ''} ${showSixEffect ? 'dice-six-glow' : ''}`}
                                        onClick={() => canRollDice && rollDice()}
                                        whileTap={canRollDice ? { scale: 0.9 } : {}}
                                    >
                                        {diceValue ? <DiceFace value={diceValue} /> : (
                                            <span className="hud-dice-wait">{canRollDice ? 'TAP' : 'WAIT'}</span>
                                        )}
                                    </motion.div>
                                    <div className="hud-turn-arrow">◀</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bottom Controls */}
                    <div className="ludo-bottom-panel">
                    {matchState === 'FINISHED' && finishData ? (
                        <div className="ludo-finish-panel">
                            <h3 className="finish-title">Game Over!</h3>
                            {finishData.finishOrder?.[0] && (
                                <div className="ludo-winner-spotlight">
                                    <span>Winner</span>
                                    <strong>{finishData.finishOrder[0].username}</strong>
                                </div>
                            )}
                            <div className="finish-results">
                                {finishData.finishOrder?.map((p: any, i: number) => {
                                    const colors = COLOR_MAP[p.color as PlayerColor];
                                    const payout = finishData.payouts?.[p.id] || 0;
                                    const displayPayout = payout / INTERNAL_MULTIPLIER;
                                    const isMe = p.id === user?.id;
                                    const medals = ['1st', '2nd', '3rd', '4th'];

                                    return (
                                        <motion.div
                                            key={i}
                                            className={`finish-row${isMe ? ' me' : ''}`}
                                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.24, delay: i * 0.06 }}
                                        >
                                            <span className={`finish-medal${i === 0 ? ' gold' : ''}`}>{medals[i]}</span>
                                            <div className="finish-avatar" style={{ background: colors?.gradient }}>
                                                {p.username?.[0]?.toUpperCase()}
                                            </div>
                                            <span className="finish-name">
                                                {p.username} {isMe ? '(You)' : ''} {p.isBot ? 'BOT' : ''}
                                            </span>
                                            {displayPayout > 0 && (
                                                <span className="finish-payout">+{formatIndianNumber(displayPayout)}</span>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                            <button className="ludo-action-btn primary" onClick={playAgain}>Play Again</button>
                        </div>
                    ) : (
                        <>
                            {!isLocalMatch ? (
                                <div className={`ludo-dice-dock${isMyTurn ? ' active-turn' : ''}`}>
                                    <div className="dice-side-chip">
                                        {currentPlayer && (
                                            <span style={{ color: COLOR_MAP[currentPlayer.color].main }}>
                                                {currentPlayer.id === user?.id ? 'Your turn' : `${currentPlayer.username}'s turn`}
                                            </span>
                                        )}
                                        {isMyTurn && serverState?.waitingForMove && (
                                            <span className="dice-hint-move">Pick a piece</span>
                                        )}
                                    </div>

                                    <div className="ludo-dice-center-wrap">
                                        <motion.div
                                            className={`ludo-dice ludo-dice-center ${canRollDice ? 'can-roll' : 'disabled'} ${isRolling ? 'rolling' : ''} ${showSixEffect ? 'dice-six-glow' : ''}`}
                                            onClick={() => canRollDice && rollDice()}
                                            whileTap={canRollDice ? { scale: 0.9 } : {}}
                                        >
                                            {diceValue ? <DiceFace value={diceValue} /> : (
                                                <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 700 }}>
                                                    {canRollDice ? 'TAP' : 'WAIT'}
                                                </span>
                                            )}
                                        </motion.div>

                                        <AnimatePresence>
                                            {showSixEffect && (
                                                <motion.div
                                                    className="dice-bonus-label"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: -6 }}
                                                    exit={{ opacity: 0, y: -20 }}
                                                >
                                                    BONUS!
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <AnimatePresence>
                                            {showRollHint && (
                                                <motion.div
                                                    className="ludo-roll-hint"
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                >
                                                    <span className="hint-hand">👆</span> Tap here to roll
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="dice-pot-info">
                                        <span>Pot</span>
                                        <strong>{formatIndianNumber(totalPot * 0.95)}</strong>
                                    </div>
                                </div>
                            ) : (
                                <div className="ludo-local-status">
                                    <span>
                                        {currentPlayer
                                            ? `${currentPlayer.username}'s turn`
                                            : 'Turn in progress'}
                                    </span>
                                    <strong>Pot {formatIndianNumber(totalPot * 0.95)}</strong>
                                </div>
                            )}

                            {/* Activity Log (compact) */}
                            <div className="ludo-log-compact">
                                {log.slice(0, 3).map((entry, i) => (
                                    <div key={i} className={`log-line ${entry.type}`}>{entry.text}</div>
                                ))}
                            </div>

                            <button className="ludo-leave-btn" onClick={leaveGame}>Leave</button>
                        </>
                    )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ludo-mobile-screen">
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
        </div>
    );
};
