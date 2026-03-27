// LudoGame v2 - Casino-grade Ludo King experience
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGame } from '../../contexts/GameContext';
import { wsService } from '../../services/websocket';
import {
    playDiceShakeEnhanced,
    playPieceMove,
    playCaptureEnhanced,
    playHomeEntry,
    playHomeEntryEnhanced,
    playWinSoundEnhanced,
    playTurnStart,
    playUrgencyTick,
    playSixRolled,
    playStreakSound,
    playEmojiPop,
    playHopSound,
    playLandingSound,
    playCaptureReturn,
    playDiceLandThud,
    playPieceEntryPop,
    playThreeSixesForfeit,
    playTurnChangeSwoosh,
    playCoinShower,
} from '../../utils/sound';
import soundManager from '../../utils/soundManager';
import { formatIndianNumber } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import {
    EnhancedConfetti,
    CaptureExplosion,
    HomeEntryCelebration,
    useScreenShake,
    StreakOverlay,
    TurnBanner,
    EmojiReactions,
    PayoutCounter,
    TrophyAnimation,
    UrgencyVignette,
    NearMissFlash,
    PieceEntryBurst,
    CoinShower,
    CaptureStreakBonus,
    DiceSixBurst,
    ScreenEdgeGlow,
    BoardFlash,
    MovePreviewGhost,
} from './ludo/LudoEffects';
import './LudoBoard.css';

// ---- Constants & Types ----

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
    GREEN: { main: '#00C853', gradient: 'linear-gradient(135deg, #39FF6E, #00C853)', glow: 'rgba(0, 200, 83, 0.45)' },
    YELLOW: { main: '#FFD600', gradient: 'linear-gradient(135deg, #FFEA40, #FFD600)', glow: 'rgba(255, 214, 0, 0.45)' },
    BLUE: { main: '#2979FF', gradient: 'linear-gradient(135deg, #5C9AFF, #2979FF)', glow: 'rgba(41, 121, 255, 0.45)' },
    RED: { main: '#FF1744', gradient: 'linear-gradient(135deg, #FF5C6E, #FF1744)', glow: 'rgba(255, 23, 68, 0.45)' },
};

const BET_PRESETS = [50, 100, 500, 1000];
const INTERNAL_MULTIPLIER = 100000;

// ---- Sub-Components ----

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

/** Render pips for a single dice face using CSS grid positioning */
const DiceFacePips: React.FC<{ value: number }> = ({ value }) => {
    // Each face uses a 3x3 grid. Pips are placed at specific grid positions.
    // Grid positions: TL=1/1, TC=1/2, TR=1/3, ML=2/1, MC=2/2, MR=2/3, BL=3/1, BC=3/2, BR=3/3
    const pipPositions: Record<number, { row: number; col: number; red?: boolean }[]> = {
        1: [{ row: 2, col: 2, red: true }],
        2: [{ row: 1, col: 3 }, { row: 3, col: 1 }],
        3: [{ row: 1, col: 3 }, { row: 2, col: 2 }, { row: 3, col: 1 }],
        4: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 3 }],
        5: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 2 }, { row: 3, col: 1 }, { row: 3, col: 3 }],
        6: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 1 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 3 }],
    };
    const pips = pipPositions[value] || pipPositions[1];
    return (
        <>
            {pips.map((p, i) => (
                <div
                    key={i}
                    className={`dice-pip${p.red ? ' pip-red' : ''}`}
                    style={{ gridRow: p.row, gridColumn: p.col }}
                />
            ))}
        </>
    );
};

/** 3D Dice Cube -- renders a proper 3D cube with pip faces, like Ludo King */
const Dice3D: React.FC<{ value: number | null; isRolling: boolean; showSix: boolean }> = ({ value, isRolling, showSix }) => {
    const displayValue = value || 1;
    // Face mapping -- must align with .show-N rotation rules:
    // show-1: rotateX(0) rotateY(0)      -> front face visible  -> value 1
    // show-2: rotateX(-90deg)             -> top face visible    -> value 2
    // show-3: rotateY(90deg)              -> left face visible   -> value 3
    // show-4: rotateY(-90deg)             -> right face visible  -> value 4
    // show-5: rotateX(90deg)              -> bottom face visible -> value 5
    // show-6: rotateX(180deg)             -> back face visible   -> value 6
    // Opposite faces sum to 7: front/back=1/6, top/bottom=2/5, left/right=3/4
    return (
        <div className={`dice-3d-scene${isRolling ? ' scene-rolling' : ''}`}>
            <div className={`dice-3d-cube ${isRolling ? 'cube-rolling' : ''} show-${displayValue}${showSix && displayValue === 6 ? ' six-glow' : ''}`}>
                <div className="dice-3d-face face-front">
                    <DiceFacePips value={1} />
                </div>
                <div className="dice-3d-face face-back">
                    <DiceFacePips value={6} />
                </div>
                <div className="dice-3d-face face-right">
                    <DiceFacePips value={4} />
                </div>
                <div className="dice-3d-face face-left">
                    <DiceFacePips value={3} />
                </div>
                <div className="dice-3d-face face-top">
                    <DiceFacePips value={2} />
                </div>
                <div className="dice-3d-face face-bottom">
                    <DiceFacePips value={5} />
                </div>
            </div>
        </div>
    );
};

// ---- Main Component ----

export const LudoGame: React.FC = () => {
    const { user, isAuthenticated, wsStatus, activeBalance, isDemoMode } = useGame();

    const [matchState, setMatchState] = useState<MatchState>('MENU');
    const [serverState, setServerState] = useState<ServerGameState | null>(null);
    const [myColor, setMyColor] = useState<PlayerColor | null>(null);

    const [betAmount, setBetAmount] = useState(100);
    const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
    const [quickMode, setQuickMode] = useState(false);
    const [menuMode, setMenuMode] = useState<'quick' | 'private' | 'local'>('quick');
    const [localSetupStep, setLocalSetupStep] = useState<'players' | 'color'>('players');
    const [localPreferredColor, setLocalPreferredColor] = useState<PlayerColor>('GREEN');
    const [localHumanCount, setLocalHumanCount] = useState(1);
    const [joinCode, setJoinCode] = useState('');
    const [queueTimer, setQueueTimer] = useState(0);
    const [menuError, setMenuError] = useState('');

    const [diceByColor, setDiceByColor] = useState<Partial<Record<PlayerColor, number>>>({});
    const [rollingColor, setRollingColor] = useState<PlayerColor | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const [showSixEffect, setShowSixEffect] = useState(false);
    const [turnTimeLeft, setTurnTimeLeft] = useState(30);
    const [log, setLog] = useState<{ text: string; type: 'normal' | 'kill' | 'finish' }[]>([]);

    const [finishData, setFinishData] = useState<any>(null);

    // Animation states
    const [showConfetti, setShowConfetti] = useState(false);
    const [_capturingPiece, setCapturingPiece] = useState<{color: PlayerColor, pieceId: number} | null>(null);
    const [captureFlyback, setCaptureFlyback] = useState<{color: PlayerColor, pieceId: number, fromPos: {r: number, c: number}, toPos: {r: number, c: number}} | null>(null);
    const [attackerPiece, setAttackerPiece] = useState<{color: PlayerColor, pieceId: number} | null>(null);
    const [sparklingPiece, setSparklingPiece] = useState<{color: PlayerColor, pieceId: number} | null>(null);
    const [movingPieceTrail, setMovingPieceTrail] = useState<{color: PlayerColor, pieceId: number} | null>(null);
    // Cell-by-cell hopping animation
    const [hoppingPiece, setHoppingPiece] = useState<{
        color: PlayerColor;
        pieceId: number;
        currentStep: { r: number; c: number };
        isHopping: boolean;
    } | null>(null);
    const hoppingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isLocalMatch, setIsLocalMatch] = useState(false);
    const [localControlledPlayerIds, setLocalControlledPlayerIds] = useState<string[]>([]);
    const [showRollHint, setShowRollHint] = useState(false);
    const [rollHintCount, setRollHintCount] = useState(0);
    const [soundEnabled, setSoundEnabled] = useState(() => soundManager.getSettings().enabled);

    // Enhanced effect states
    const [captureStreak, setCaptureStreak] = useState(0);
    const [showStreakOverlay, setShowStreakOverlay] = useState(false);
    const [streakType, setStreakType] = useState<'capture' | 'six' | 'home'>('capture');
    const [captureExplosionPos, setCaptureExplosionPos] = useState<{x: number, y: number, color: string} | null>(null);
    const [captureCallout, setCaptureCallout] = useState<{attacker: string, victim: string, attackerColor: string} | null>(null);
    const [coinShowerPos, setCoinShowerPos] = useState<{x: number, y: number} | null>(null);
    const [homeCelebrationPos, setHomeCelebrationPos] = useState<{x: number, y: number} | null>(null);
    const [showNearMiss, setShowNearMiss] = useState(false);
    const [diceAnnouncement, setDiceAnnouncement] = useState<string | null>(null);
    const [showTurnBanner, setShowTurnBanner] = useState(false);
    const [emojiReactions, setEmojiReactions] = useState<Array<{id: string, emoji: string, fromTop: boolean}>>([]);
    const [_diceRevealed, setDiceRevealed] = useState(false);
    const [consecutiveSixes, setConsecutiveSixes] = useState(0);
    // Trail cells for hop path highlight
    const [trailCells, setTrailCells] = useState<{ r: number; c: number; color: PlayerColor }[]>([]);
    const trailTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    // New effect states
    const [pieceEntryEffect, setPieceEntryEffect] = useState<{x: number, y: number, color: string} | null>(null);
    const [diceSixBurstPos, setDiceSixBurstPos] = useState<{x: number, y: number} | null>(null);
    const [boardFlashColor, setBoardFlashColor] = useState<string | null>(null);
    const [showBoardFlash, setShowBoardFlash] = useState(false);
    const [_movePreview, setMovePreview] = useState<{row: number, col: number, color: string} | null>(null);
    const [dicePressed, setDicePressed] = useState(false);
    const [diceDragDelta, setDiceDragDelta] = useState(0);
    const [isDiceDragging, setIsDiceDragging] = useState(false);
    const diceDragStartY = useRef<number | null>(null);
    const diceDragTriggered = useRef(false);

    const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const diceAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const localConsecutiveSixesRef = useRef(0);
    const isLocalMatchRef = useRef(false);
    const boardRef = useRef<HTMLDivElement | null>(null);
    const captureStreakRef = useRef(0);
    const serverStateRef = useRef<ServerGameState | null>(null);
    const myColorRef = useRef<PlayerColor | null>(null);
    const nearMissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { shakeClass, triggerShake } = useScreenShake();

    useEffect(() => {
        isLocalMatchRef.current = isLocalMatch;
    }, [isLocalMatch]);

    useEffect(() => {
        serverStateRef.current = serverState;
    }, [serverState]);

    useEffect(() => {
        myColorRef.current = myColor;
    }, [myColor]);

    useEffect(() => {
        if (isAuthenticated && wsStatus === 'DISCONNECTED') {
            wsService.connect();
        }
    }, [isAuthenticated, wsStatus]);

    useEffect(() => {
        if (menuMode === 'local') {
            setLocalSetupStep('players');
            setQuickMode(false);
            setLocalHumanCount(prev => Math.min(Math.max(1, prev), maxPlayers));
        }
    }, [menuMode, maxPlayers]);

    const deviceProfile = useMemo(() => {
        const nav = navigator as Navigator & { deviceMemory?: number };
        const cores = nav.hardwareConcurrency || 8;
        const memory = nav.deviceMemory || 4;
        const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
        return {
            isLowEnd: cores <= 4 || memory <= 2,
            isMobile,
            diceAnimDurationMs: cores <= 4 || memory <= 2 ? 400 : 780,
        };
    }, []);

    useEffect(() => {
        const prevBody = document.body.style.overscrollBehavior;
        const prevHtml = document.documentElement.style.overscrollBehavior;
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';
        return () => {
            document.body.style.overscrollBehavior = prevBody;
            document.documentElement.style.overscrollBehavior = prevHtml;
        };
    }, []);

    const truncatePlayerName = (name: string) => (
        name.length > 10 ? `${name.slice(0, 10)}...` : name
    );

    const addToLog = useCallback((text: string, type: 'normal' | 'kill' | 'finish') => {
        setLog(prev => [{ text, type }, ...prev].slice(0, 10));
    }, []);

    const flashMovedPiece = useCallback((color?: PlayerColor, pieceId?: number) => {
        if (!color || typeof pieceId !== 'number') return;
        setMovingPieceTrail({ color, pieceId });
        setTimeout(() => setMovingPieceTrail(null), 620);
    }, []);

    // Flash the board briefly for major events
    const triggerBoardFlash = useCallback((color: string) => {
        if (deviceProfile.isLowEnd) return;
        setBoardFlashColor(color);
        setShowBoardFlash(true);
        setTimeout(() => setShowBoardFlash(false), 400);
    }, [deviceProfile.isLowEnd]);

    // Compute all intermediate cell coords for a piece moving N steps
    const getPathSteps = useCallback((
        playerColor: PlayerColor,
        oldTravelled: number,
        newTravelled: number,
        wasInBase: boolean
    ): { r: number; c: number }[] => {
        const steps: { r: number; c: number }[] = [];
        const startOffset = START_OFFSETS[playerColor];

        if (wasInBase) {
            // Coming out of base: piece goes to start position
            steps.push(PATH_COORDS[startOffset]);
            return steps;
        }

        for (let t = oldTravelled + 1; t <= newTravelled; t++) {
            if (t >= 51 && t <= 55) {
                // Home stretch
                const homeIdx = t - 51;
                const coord = HOME_PATHS[playerColor][Math.min(homeIdx, 4)];
                if (coord) steps.push(coord);
            } else if (t === 56) {
                // Reached home center
                steps.push({ r: 8, c: 8 });
            } else if (t < 51) {
                const absPos = (startOffset + t) % 52;
                const coord = PATH_COORDS[absPos];
                if (coord) steps.push(coord);
            }
        }
        return steps;
    }, []);

    // Animate cell-by-cell hopping with per-step sound and squash-stretch
    const animateHop = useCallback((
        color: PlayerColor,
        pieceId: number,
        steps: { r: number; c: number }[],
        onComplete?: () => void
    ) => {
        if (steps.length === 0) {
            onComplete?.();
            return;
        }

        // Clear any previous trail timers
        trailTimersRef.current.forEach(t => clearTimeout(t));
        trailTimersRef.current = [];
        setTrailCells([]);

        const HOP_MS = 120; // ms per hop
        const MAX_DURATION = 1500; // cap total
        const hopDuration = Math.min(HOP_MS, MAX_DURATION / steps.length);
        let stepIdx = 0;
        const TRAIL_FADE_MS = 500; // how long each cell trail lingers

        const doStep = () => {
            if (stepIdx >= steps.length) {
                // Final landing -- satisfying thud
                playLandingSound();
                setHoppingPiece(null);
                // Clear remaining trail after fade
                const clearTimer = setTimeout(() => setTrailCells([]), TRAIL_FADE_MS);
                trailTimersRef.current.push(clearTimer);
                onComplete?.();
                return;
            }

            const coord = steps[stepIdx];
            // Per-cell hop sound with pitch variation built into playHopSound
            playHopSound();

            // Add this cell to the trail
            setTrailCells(prev => [...prev, { r: coord.r, c: coord.c, color }]);

            // Schedule fade-out removal for this specific cell
            const cellR = coord.r;
            const cellC = coord.c;
            const fadeTimer = setTimeout(() => {
                setTrailCells(prev => prev.filter(t => !(t.r === cellR && t.c === cellC)));
            }, TRAIL_FADE_MS + stepIdx * hopDuration);
            trailTimersRef.current.push(fadeTimer);

            setHoppingPiece({
                color,
                pieceId,
                currentStep: coord,
                isHopping: true,
            });

            stepIdx++;
            hoppingRef.current = setTimeout(doStep, hopDuration);
        };

        doStep();
    }, []);

    // Get base position for a piece (for fly-back animation)
    const getBasePosition = useCallback((color: PlayerColor, pieceId: number): { r: number; c: number } => {
        const baseMap: Record<PlayerColor, { r: number; c: number }> = {
            GREEN: { r: 1, c: 1 }, YELLOW: { r: 1, c: 10 }, RED: { r: 10, c: 1 }, BLUE: { r: 10, c: 10 }
        };
        const b = baseMap[color];
        const offsets = [[2, 2], [2, 4], [4, 2], [4, 4]];
        return { r: b.r + offsets[pieceId][0], c: b.c + offsets[pieceId][1] };
    }, []);

    // Haptic feedback helper with celebration pattern
    const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'capture' | 'celebration' = 'light') => {
        if ('vibrate' in navigator) {
            const patterns: Record<string, number | number[]> = {
                light: 10,
                medium: 40,
                heavy: 80,
                capture: [30, 15, 50, 15, 30],
                celebration: [20, 10, 20, 10, 40, 10, 80],
            };
            navigator.vibrate(patterns[type] ?? 10);
        }
    }, []);

    // Compute landing position for move preview ghost
    const getLandingPosition = useCallback((
        playerColor: PlayerColor,
        piece: ServerPiece,
        roll: number
    ): { r: number; c: number } | null => {
        if (piece.finished) return null;
        const startOffset = START_OFFSETS[playerColor];

        if (piece.position === -1) {
            // Coming out of base
            if (roll !== 6) return null;
            return PATH_COORDS[startOffset];
        }

        const newTravelled = piece.travelled + roll;
        if (newTravelled > 56) return null;

        if (newTravelled === 56) return { r: 8, c: 8 };
        if (newTravelled >= 51) {
            const homeIdx = newTravelled - 51;
            return HOME_PATHS[playerColor][Math.min(homeIdx, 4)] || null;
        }
        const absPos = (startOffset + newTravelled) % 52;
        return PATH_COORDS[absPos] || null;
    }, []);

    // ---- WebSocket Message Handler ----

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
            if (hoppingRef.current) {
                clearTimeout(hoppingRef.current);
                hoppingRef.current = null;
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
        const actorColor = (playerColor || serverState?.currentPlayerColor || 'GREEN') as PlayerColor;
        setIsRolling(true);
        setRollingColor(actorColor);
        setDiceRevealed(false);
        setMovePreview(null);
        playDiceShakeEnhanced();

        if (diceAnimRef.current) {
            clearInterval(diceAnimRef.current);
            diceAnimRef.current = null;
        }

        // Dice face cycling animation -- shows faces cycling through
        let i = 0;
        const tickMs = deviceProfile.isLowEnd ? 40 : 55;
        const maxTicks = Math.max(8, Math.round(deviceProfile.diceAnimDurationMs / tickMs));
        // Sequence: cycle through faces avoiding spoiler near end
        const cycleOrder = [1, 4, 2, 5, 3, 6];

        diceAnimRef.current = setInterval(() => {
            // Use cycling order for more visual variety
            let displayVal = cycleOrder[i % cycleOrder.length];
            // Avoid showing the final number during last few ticks for dramatic reveal
            if (i > maxTicks - 4 && displayVal === roll) {
                displayVal = cycleOrder[(i + 1) % cycleOrder.length];
            }
            setDiceByColor(prev => ({ ...prev, [actorColor]: displayVal }));
            i++;
            if (i >= maxTicks) {
                if (diceAnimRef.current) {
                    clearInterval(diceAnimRef.current);
                    diceAnimRef.current = null;
                }
                // Final reveal -- land thud sound
                setDiceByColor(prev => ({ ...prev, [actorColor]: roll }));
                setIsRolling(false);
                setRollingColor(null);
                setDiceRevealed(true);
                playDiceLandThud();

                if (roll === 6) {
                    setShowSixEffect(true);
                    playSixRolled();
                    triggerHaptic('heavy');
                    if (!deviceProfile.isLowEnd) {
                        triggerShake('light');
                        // Golden burst around dice
                        setDiceSixBurstPos({ x: 0, y: 0 });
                        setTimeout(() => setDiceSixBurstPos(null), 600);
                    }
                    setConsecutiveSixes(prev => {
                        const next = prev + 1;
                        if (next >= 2) {
                            setStreakType('six');
                            setCaptureStreak(next);
                            setShowStreakOverlay(true);
                            playStreakSound();
                            setTimeout(() => setShowStreakOverlay(false), 1800);
                        }
                        return next;
                    });
                    setTimeout(() => setShowSixEffect(false), 1500);
                } else {
                    setConsecutiveSixes(0);
                }

                // Brief reveal flash effect
                setTimeout(() => setDiceRevealed(false), 400);

                if (skipped && reason === 'three_sixes') {
                    addToLog(`${playerColor} rolled 3 sixes! Turn skipped.`, 'normal');
                    playThreeSixesForfeit();
                } else if (!canMove) {
                    addToLog(`${playerColor} rolled ${roll}. No moves.`, 'normal');
                } else {
                    addToLog(`${playerColor} rolled ${roll}`, 'normal');
                }

                // Dice roll announcer text
                if (roll === 6) {
                    setDiceAnnouncement('SIX!');
                    setTimeout(() => setDiceAnnouncement(null), 800);
                } else if (!canMove) {
                    setDiceAnnouncement('No moves!');
                    setTimeout(() => setDiceAnnouncement(null), 800);
                }
            }
        }, tickMs);
    }, [addToLog, deviceProfile.diceAnimDurationMs, deviceProfile.isLowEnd, serverState?.currentPlayerColor, triggerHaptic, triggerShake]);

    /** Check if any opponent piece is within 1-6 cells of the local player's pieces (danger zone). */
    const checkNearMiss = useCallback((state: ServerGameState | null) => {
        if (!state || state.status !== 'PLAYING') return;
        const localColor = myColorRef.current;
        if (!localColor) return;
        const localPlayer = state.players.find(p => p.color === localColor);
        if (!localPlayer) return;

        const myMainPathPieces = localPlayer.pieces.filter(p => p.position >= 0);
        if (myMainPathPieces.length === 0) return;

        for (const opponent of state.players) {
            if (opponent.color === localColor) continue;
            for (const opPiece of opponent.pieces) {
                if (opPiece.position < 0) continue;
                for (const myPiece of myMainPathPieces) {
                    if (SAFE_SPOTS.includes(myPiece.position)) continue;
                    const dist = (myPiece.position - opPiece.position + 52) % 52;
                    if (dist >= 1 && dist <= 6) {
                        if (nearMissTimerRef.current) clearTimeout(nearMissTimerRef.current);
                        setShowNearMiss(true);
                        nearMissTimerRef.current = setTimeout(() => setShowNearMiss(false), 1500);
                        return;
                    }
                }
            }
        }
    }, []);

    const handlePieceMoved = useCallback((data: any) => {
        triggerHaptic('light');
        if (data.captured) addToLog(`${data.playerColor} captured a piece!`, 'kill');

        // Cell-by-cell hopping animation
        const color = data.playerColor as PlayerColor;
        const pieceId = data.pieceId as number;
        const oldTravelled = data.oldTravelled ?? 0;
        const newTravelled = data.newTravelled ?? oldTravelled;
        const wasInBase = data.wasInBase ?? false;

        // Piece entry effect when coming out of base
        if (wasInBase && boardRef.current) {
            playPieceEntryPop();
            const startOffset = START_OFFSETS[color];
            const startCoord = PATH_COORDS[startOffset];
            if (startCoord) {
                const rect = boardRef.current.getBoundingClientRect();
                const cellSize = rect.width / 15;
                setPieceEntryEffect({
                    x: startCoord.c * cellSize - cellSize / 2,
                    y: startCoord.r * cellSize - cellSize / 2,
                    color: COLOR_MAP[color].main,
                });
                setTimeout(() => setPieceEntryEffect(null), 500);
            }
        }

        const steps = getPathSteps(color, oldTravelled, newTravelled, wasInBase);

        if (steps.length > 0) {
            animateHop(color, pieceId, steps, () => {
                flashMovedPiece(color, pieceId);
            });
        } else {
            playPieceMove();
            flashMovedPiece(color, pieceId);
        }

        // Clear move preview
        setMovePreview(null);

        // Reset capture streak on a non-capture move
        if (!data.captured) {
            captureStreakRef.current = 0;
        }

        // Near-miss detection: check after a short delay so state has settled
        setTimeout(() => checkNearMiss(serverStateRef.current), 200);
    }, [addToLog, triggerHaptic, flashMovedPiece, getPathSteps, animateHop, checkNearMiss]);

    const handlePieceCaptured = useCallback((data: any) => {
        // Dramatic pause built into timing: capture sound starts immediately
        playCaptureEnhanced();
        triggerHaptic('capture');
        addToLog(`${data.capturedBy} captured ${data.capturedPlayer}'s piece!`, 'kill');

        // INTENSE screen shake on capture -- casino-grade impact
        if (!deviceProfile.isLowEnd) {
            triggerShake('capture');
        }

        // Board flash in attacker's color
        const attackerColor = COLOR_MAP[data.capturedBy as PlayerColor]?.main || '#fff';
        triggerBoardFlash(attackerColor);

        // Capture callout with player names
        const currentState = serverStateRef.current;
        if (currentState) {
            const attackerPlayer = currentState.players.find((p: ServerPlayer) => p.color === data.capturedBy);
            const victimPlayer = currentState.players.find((p: ServerPlayer) => p.color === data.capturedPlayer);
            setCaptureCallout({
                attacker: attackerPlayer?.username || data.capturedBy,
                victim: victimPlayer?.username || data.capturedPlayer,
                attackerColor: data.capturedBy,
            });
            setTimeout(() => setCaptureCallout(null), 2500);
        }

        // Fly-back animation: captured piece flies back to base with delay
        // Delayed 300ms to let the explosion play out -- brief "slow motion" moment
        const capturedColor = data.capturedPlayer as PlayerColor;
        const capturedPieceId = data.capturedPieceId as number;

        // Get the current position of the captured piece
        // Server sends 'position', not 'capturePosition'
        const capturePos = data.position ?? data.capturePosition ?? -1;
        let fromCoord = { r: 8, c: 8 }; // fallback center
        if (capturePos >= 0 && capturePos < PATH_COORDS.length) {
            fromCoord = PATH_COORDS[capturePos];
        }

        const toCoord = getBasePosition(capturedColor, capturedPieceId);

        // Anchor the captured piece at capture point immediately so it doesn't
        // snap to base before the flyback animation begins
        setCaptureFlyback({
            color: capturedColor,
            pieceId: capturedPieceId,
            fromPos: fromCoord,
            toPos: toCoord,
        });

        // Play return sound after a brief dramatic pause
        setTimeout(() => playCaptureReturn(), 300);

        // Clear flyback after animation completes (300ms pause + 800ms arc)
        setTimeout(() => setCaptureFlyback(null), 1100);

        // Attacker power pulse
        if (data.attackerPieceId !== undefined) {
            setAttackerPiece({ color: data.capturedBy, pieceId: data.attackerPieceId });
            setTimeout(() => setAttackerPiece(null), 900);
        }

        // Capture explosion + COIN SHOWER at the point of capture
        if (boardRef.current) {
            const capturedColorHex = COLOR_MAP[capturedColor]?.main || '#ff0000';
            const rect = boardRef.current.getBoundingClientRect();
            const cellSize = rect.width / 15;
            const explosionX = fromCoord.c * cellSize - cellSize / 2;
            const explosionY = fromCoord.r * cellSize - cellSize / 2;

            // Capture explosion (enhanced with shockwave, flash, more particles)
            setCaptureExplosionPos({
                x: explosionX,
                y: explosionY,
                color: capturedColorHex,
            });
            setTimeout(() => setCaptureExplosionPos(null), 900);

            // COIN SHOWER -- gold coins burst from the capture point (skip on low-end)
            if (!deviceProfile.isLowEnd) {
                setCoinShowerPos({ x: explosionX, y: explosionY });
                setTimeout(() => setCoinShowerPos(null), 1500);

                // Play coin shower sound slightly delayed for layered audio
                setTimeout(() => playCoinShower(), 100);
            }
        }

        // Track capture streak
        captureStreakRef.current += 1;
        if (captureStreakRef.current >= 2) {
            setCaptureStreak(captureStreakRef.current);
            setStreakType('capture');
            setShowStreakOverlay(true);
            playStreakSound();
            setTimeout(() => setShowStreakOverlay(false), 2500);
        }
    }, [addToLog, triggerHaptic, triggerShake, deviceProfile.isLowEnd, getBasePosition, triggerBoardFlash]);

    const handlePieceHome = useCallback((data: any) => {
        playHomeEntryEnhanced();
        triggerHaptic('celebration');
        const finishTarget = serverState?.targetFinishCount || 4;
        addToLog(`${data.playerColor} got a piece home! (${data.finishedCount}/${finishTarget})`, 'finish');

        // Board flash in the player's color
        const homeColor = COLOR_MAP[data.playerColor as PlayerColor]?.main || '#FFD700';
        triggerBoardFlash(homeColor);

        // Trigger sparkle animation
        setSparklingPiece({ color: data.playerColor, pieceId: data.pieceId });
        setTimeout(() => setSparklingPiece(null), 1500);

        // Home celebration burst at center of board
        if (boardRef.current && !deviceProfile.isLowEnd) {
            const rect = boardRef.current.getBoundingClientRect();
            setHomeCelebrationPos({ x: rect.width / 2, y: rect.height / 2 });
            setTimeout(() => setHomeCelebrationPos(null), 1400);
        }
    }, [addToLog, triggerHaptic, serverState?.targetFinishCount, deviceProfile.isLowEnd, triggerBoardFlash]);

    const handleTurnStart = useCallback((data: any) => {
        const turnSecs = Math.max(8, Math.floor((data?.turnTimeLimitMs || serverState?.turnTimeLimitMs || 30000) / 1000));
        setTurnTimeLeft(turnSecs);
        startTurnTimer(turnSecs);
        if (data?.playerId && data.playerId === user?.id) {
            playTurnChangeSwoosh();
            playTurnStart();
            triggerHaptic('light');
            // Flash "YOUR TURN" banner briefly
            setShowTurnBanner(true);
            setTimeout(() => setShowTurnBanner(false), 1200);
        }
    }, [triggerHaptic, user?.id, serverState?.turnTimeLimitMs]);

    const handleGameFinished = useCallback((data: any) => {
        setFinishData(data);
        setMatchState('FINISHED');
        stopTurnTimer();
        addToLog('Game Over!', 'finish');

        // Trigger enhanced celebration
        playWinSoundEnhanced();
        triggerHaptic('celebration');
        if (!deviceProfile.isLowEnd) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 6000);
        }
    }, [addToLog, deviceProfile.isLowEnd, triggerHaptic]);

    // ---- Timers ----

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

    // ---- Actions ----

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
        const humanCount = Math.min(Math.max(1, localHumanCount), maxPlayers);
        const players: ServerPlayer[] = orderedColors.map((color, i) => ({
            id: `local_${i + 1}`,
            username: i < humanCount ? (i === 0 ? (user?.username || 'Player 1') : `Player ${i + 1}`) : `Bot ${i + 1 - humanCount}`,
            color,
            isBot: i >= humanCount,
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
        setLocalControlledPlayerIds(players.filter(p => !p.isBot).map(p => p.id || '').filter(Boolean));
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
        setDiceByColor({});
        setRollingColor(null);
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
        const oldTravelled = piece.travelled;
        const wasInBase = piece.position === -1;

        if (piece.position === -1) {
            if (roll !== 6) return;
            piece.position = startOffset;
            piece.travelled = 0;

            // Check for capture at start position (matches server logic)
            if (!SAFE_SPOTS.includes(startOffset)) {
                for (const other of state.players) {
                    if (other.color === player.color) continue;
                    for (const otherPiece of other.pieces) {
                        if (otherPiece.position === startOffset && otherPiece.position >= 0) {
                            otherPiece.position = -1;
                            otherPiece.travelled = 0;
                            captured = true;

                            handlePieceCaptured({
                                capturedBy: player.color,
                                capturedPlayer: other.color,
                                capturedPieceId: otherPiece.id,
                                attackerPieceId: pieceId,
                                position: startOffset,
                            });
                        }
                    }
                }
            }
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

                                // Fire FULL capture effects for local games (same as handlePieceCaptured)
                                handlePieceCaptured({
                                    capturedBy: player.color,
                                    capturedPlayer: other.color,
                                    capturedPieceId: otherPiece.id,
                                    attackerPieceId: pieceId,
                                    position: newAbsPos,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Cell-by-cell hopping animation for local moves
        const steps = getPathSteps(player.color, oldTravelled, piece.travelled, wasInBase);
        const hopDelay = Math.min(120, 1500 / Math.max(steps.length, 1)) * steps.length + 200;

        // Piece entry effect when coming out of base
        if (wasInBase && boardRef.current) {
            playPieceEntryPop();
            const startCoord = PATH_COORDS[startOffset];
            if (startCoord) {
                const rect = boardRef.current.getBoundingClientRect();
                const cellSize = rect.width / 15;
                setPieceEntryEffect({
                    x: startCoord.c * cellSize - cellSize / 2,
                    y: startCoord.r * cellSize - cellSize / 2,
                    color: COLOR_MAP[player.color].main,
                });
                setTimeout(() => setPieceEntryEffect(null), 500);
            }
        }

        if (steps.length > 0) {
            animateHop(player.color, piece.id, steps, () => {
                flashMovedPiece(player.color, piece.id);
            });
        } else {
            playPieceMove();
            flashMovedPiece(player.color, piece.id);
        }

        state.waitingForMove = false;
        state.movablePieces = [];
        setServerState(state);
        setMovePreview(null);

        // Near-miss detection for local moves
        checkNearMiss(state);

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
        }, Math.max(350, hopDelay));
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
        const isLocalBotTurn = !!(isLocalMatch && player.id && !localControlledPlayerIds.includes(player.id as string));
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

        // Auto-move: if only one piece can move, auto-select with brief highlight
        if (movable.length === 1 && !skipped) {
            setTimeout(() => {
                // Brief highlight of the auto-selected piece
                setMovingPieceTrail({ color: player.color, pieceId: movable[0] });
                setTimeout(() => {
                    setMovingPieceTrail(null);
                    executeLocalMove(movable[0], roll);
                }, 250);
            }, 500);
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

    const resetEffectStates = useCallback(() => {
        setMovingPieceTrail(null);
        setShowRollHint(false);
        setCapturingPiece(null);
        setCaptureFlyback(null);
        setAttackerPiece(null);
        setSparklingPiece(null);
        setHoppingPiece(null);
        setCaptureStreak(0);
        setShowStreakOverlay(false);
        setCaptureExplosionPos(null);
        setCaptureCallout(null);
        setCoinShowerPos(null);
        setHomeCelebrationPos(null);
        setShowNearMiss(false);
        setDiceAnnouncement(null);
        setShowTurnBanner(false);
        setShowConfetti(false);
        setConsecutiveSixes(0);
        setPieceEntryEffect(null);
        setDiceSixBurstPos(null);
        setBoardFlashColor(null);
        setShowBoardFlash(false);
        setMovePreview(null);
        setDicePressed(false);
        captureStreakRef.current = 0;
        if (hoppingRef.current) {
            clearTimeout(hoppingRef.current);
            hoppingRef.current = null;
        }
    }, []);

    const leaveGame = () => {
        if (!isLocalMatch) {
            wsService.send({ game: 'ludo', type: 'leave_game', data: {} });
        }
        setIsLocalMatch(false);
        setLocalControlledPlayerIds([]);
        setMatchState('MENU');
        setServerState(null);
        setMyColor(null);
        setDiceByColor({});
        setRollingColor(null);
        setLog([]);
        setFinishData(null);
        resetEffectStates();
        stopTurnTimer();
    };

    const playAgain = () => {
        setIsLocalMatch(false);
        setLocalControlledPlayerIds([]);
        setFinishData(null);
        setServerState(null);
        setMyColor(null);
        setDiceByColor({});
        setRollingColor(null);
        setLog([]);
        resetEffectStates();
        setMatchState('MENU');
    };

    // ---- Piece Rendering ----

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
            const offsets = [[2, 2], [2, 4], [4, 2], [4, 4]];
            return { gridRow: b.r + offsets[pieceId][0], gridColumn: b.c + offsets[pieceId][1] };
        }

        // Finished (-3) or at home center
        if (pos === -3 || (pos === -2 && traveled >= 56)) {
            return { gridRow: 8, gridColumn: 8, opacity: 0.5 };
        }

        // In home stretch (pos === -2 OR travelled >= 51)
        if (pos === -2 || traveled >= 51) {
            const homeIdx = traveled - 51;
            if (homeIdx >= 0 && homeIdx <= 5) {
                const coord = HOME_PATHS[color][Math.min(homeIdx, 4)];
                return { gridRow: coord.r, gridColumn: coord.c };
            }
            return { gridRow: 8, gridColumn: 8, opacity: 0.5 };
        }

        // On main path
        const coord = PATH_COORDS[pos];
        if (coord) return { gridRow: coord.r, gridColumn: coord.c };

        // Fallback
        return { gridRow: 1, gridColumn: 1, display: 'none' as const };
    };

    // ---- Derived State ----

    const isMyTurn = !!(serverState?.status === 'PLAYING' && (
        (isLocalMatch ? (
            !!serverState.players[serverState.currentPlayerIndex]?.id &&
            localControlledPlayerIds.includes(serverState.players[serverState.currentPlayerIndex].id as string)
        ) : false) ||
        (user && serverState.players[serverState.currentPlayerIndex]?.id === user.id)
    ));
    const canRollDice = !!(isMyTurn && !serverState?.waitingForMove && !isRolling);
    const currentPlayer = serverState?.players[serverState.currentPlayerIndex];

    // Dice drag/swipe handlers for Ludo King-style gesture rolling
    const handleDicePointerDown = useCallback((e: React.PointerEvent) => {
        if (!canRollDice) return;
        diceDragStartY.current = e.clientY;
        diceDragTriggered.current = false;
        setIsDiceDragging(true);
        setDicePressed(true);
        setDiceDragDelta(0);
    }, [canRollDice]);

    const handleDicePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDiceDragging || diceDragStartY.current === null || diceDragTriggered.current) return;
        const delta = diceDragStartY.current - e.clientY;
        setDiceDragDelta(Math.max(0, delta));
        if (delta > 30) {
            diceDragTriggered.current = true;
            setIsDiceDragging(false);
            setDicePressed(false);
            setDiceDragDelta(0);
            diceDragStartY.current = null;
            rollDice();
        }
    }, [isDiceDragging, rollDice]);

    const handleDicePointerUp = useCallback(() => {
        if (isDiceDragging && !diceDragTriggered.current && canRollDice) {
            rollDice();
        }
        setIsDiceDragging(false);
        setDicePressed(false);
        setDiceDragDelta(0);
        diceDragStartY.current = null;
    }, [isDiceDragging, canRollDice, rollDice]);

    const handleDicePointerLeave = useCallback(() => {
        setIsDiceDragging(false);
        setDicePressed(false);
        setDiceDragDelta(0);
        diceDragStartY.current = null;
    }, []);

    const diceSwipeStyle = isDiceDragging && diceDragDelta > 0 ? {
        transform: `translateY(${-Math.min(diceDragDelta * 0.5, 20)}px) rotate(${Math.min(diceDragDelta * 0.3, 15)}deg)`,
    } : undefined;

    // Urgency tick with escalating pitch
    useEffect(() => {
        if (matchState !== 'PLAYING' || !isMyTurn) return;
        if (turnTimeLeft > 0 && turnTimeLeft <= 5) {
            playUrgencyTick(turnTimeLeft);
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
        if (localControlledPlayerIds.length === 0) return;
        const current = serverState.players[serverState.currentPlayerIndex];
        if (!current || !current.id || localControlledPlayerIds.includes(current.id)) return;
        if (serverState.waitingForMove) return;

        const t = setTimeout(() => rollDice(), 900);
        return () => clearTimeout(t);
    }, [
        isLocalMatch,
        serverState,
        localControlledPlayerIds,
        isRolling,
    ]);

    // Move preview: top-level useMemo so hook count is stable across all render branches
    const computedMovePreview = useMemo(() => {
        if (!serverState || !serverState.waitingForMove || !isMyTurn || !currentPlayer || deviceProfile.isLowEnd) return null;
        const roll = serverState.lastRoll;
        if (!roll) return null;
        const activeColor = isLocalMatch ? currentPlayer.color : myColor;
        if (!activeColor) return null;
        const player = serverState.players.find((p: { color: PlayerColor }) => p.color === activeColor);
        if (!player) return null;
        const previews: Array<{row: number, col: number, color: string}> = [];
        for (const pieceId of serverState.movablePieces) {
            const piece = player.pieces.find((p: ServerPiece) => p.id === pieceId);
            if (!piece || piece.finished) continue;
            const landing = getLandingPosition(activeColor, piece, roll);
            if (landing) {
                previews.push({ row: landing.r, col: landing.c, color: COLOR_MAP[activeColor].main });
            }
        }
        return previews;
    }, [serverState, isMyTurn, currentPlayer, isLocalMatch, myColor, deviceProfile.isLowEnd, getLandingPosition]);

    // ---- Render: MENU ----

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
                                    <span>{quickMode ? '2 pieces to finish \u00B7 18s turn timer' : '4 pieces to finish \u00B7 30s turn timer'}</span>
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
                                            <button key={n} className={maxPlayers === n ? 'selected' : ''} onClick={() => {
                                                setMaxPlayers(n);
                                                setLocalHumanCount(1);
                                            }}>
                                                {n} Players
                                            </button>
                                        ))}
                                    </div>
                                    <div className="pot-row sub" style={{ marginTop: 10 }}>
                                        <span>You vs {maxPlayers - 1} bot{maxPlayers - 1 === 1 ? '' : 's'}</span>
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
                                                {localPreferredColor === color ? '\u2713' : ''}
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

    // ---- Render: QUEUING ----

    if (matchState === 'QUEUING') {
        const mins = Math.floor(queueTimer / 60);
        const secs = queueTimer % 60;

        return (
            <div className="ludo-mobile-screen">
                    <div className="ludo-mobile-card" style={{ textAlign: 'center' }}>
                    <div className="ludo-queue-spinner" />
                    <h2 className="ludo-title" style={{ marginTop: '20px' }}>Finding Match...</h2>
                    <p className="ludo-subtitle">
                        {maxPlayers} players, {formatIndianNumber(betAmount)} entry \u00B7 {quickMode ? 'Quick' : 'Classic'}
                    </p>
                    <p className="ludo-subtitle" style={{ fontSize: '0.8rem' }}>
                        Bots auto-fill empty seats after ~8 seconds
                    </p>
                    <div className="ludo-queue-timer">{mins}:{secs.toString().padStart(2, '0')}</div>
                    <button className="ludo-action-btn secondary" onClick={cancelMatch}>Cancel</button>
                </div>
            </div>
        );
    }

    // ---- Render: WAITING ROOM ----

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

    // ---- Render: PLAYING loading skeleton (serverState not yet received) ----

    if (matchState === 'PLAYING' && !serverState) {
        return (
            <div className="ludo-mobile-screen">
                <div className="ludo-loading-shell" style={{ display: 'grid' }}>
                    <div className="ludo-loading-top shimmer-block" />
                    <div className="ludo-loading-grid">
                        <div className="shimmer-block" />
                        <div className="shimmer-block" />
                        <div className="shimmer-block" />
                        <div className="shimmer-block" />
                    </div>
                    <div className="ludo-loading-board shimmer-block" />
                    <div className="ludo-loading-dice shimmer-block" />
                    <div className="ludo-loading-bottom shimmer-block" />
                </div>
            </div>
        );
    }

    // ---- Render: PLAYING + FINISHED ----

    if ((matchState === 'PLAYING' || matchState === 'FINISHED') && serverState) {
        const players = serverState.players;
        const displayBet = serverState.betAmount / INTERNAL_MULTIPLIER;
        const totalPot = displayBet * players.length;
        const payoutPot = Math.floor(totalPot * 0.95);
        const finishTarget = serverState.targetFinishCount || 4;
        const turnSeconds = Math.max(8, Math.floor((serverState.turnTimeLimitMs || 30000) / 1000));
        const isDuelPresentation = serverState.maxPlayers === 2;

        // Board rotation: in online matches, rotate so player's color is at the bottom
        const boardRotationDeg = (!isLocalMatch && myColor) ? (
            myColor === 'GREEN' ? 180 :
            myColor === 'YELLOW' ? 90 :
            myColor === 'RED' ? -90 :
            0 // BLUE already at bottom-right
        ) : 0;

        // Remap avatar positions to match rotated board visual layout.
        // Original positions: GREEN=top-left, YELLOW=top-right, RED=bottom-left, BLUE=bottom-right
        // After rotation, bases move; avatars must follow.
        const AVATAR_POS_ORDER: PlayerColor[] = ['GREEN', 'YELLOW', 'BLUE', 'RED']; // TL, TR, BR, BL in clockwise order
        const avatarPosMap: Record<PlayerColor, string> = (() => {
            if (boardRotationDeg === 0) {
                return { GREEN: 'green', YELLOW: 'yellow', RED: 'red', BLUE: 'blue' };
            }
            // Number of 90deg clockwise steps the board rotates
            // Positive rotation = clockwise visual movement of bases
            const steps = ((boardRotationDeg % 360) + 360) % 360 / 90;
            const map: Record<string, string> = {};
            const posNames = ['green', 'yellow', 'blue', 'red']; // matches TL, TR, BR, BL
            for (let i = 0; i < 4; i++) {
                // After rotating, the base that was at index i visually moves to index (i + steps) % 4
                const newIdx = (i + steps) % 4;
                map[AVATAR_POS_ORDER[i]] = posNames[newIdx];
            }
            return map as Record<PlayerColor, string>;
        })();
        const myHudPlayer = isLocalMatch
            ? players[0]
            : players.find(p => p.id === user?.id) || null;
        const opponentHudPlayer = isLocalMatch
            ? players.find(p => p.id !== myHudPlayer?.id) || currentPlayer || null
            : (players.find(p => p.id !== myHudPlayer?.id) || currentPlayer || null);
        const myHudDiceValue = myHudPlayer ? diceByColor[myHudPlayer.color] ?? null : null;
        const opponentHudDiceValue = opponentHudPlayer ? diceByColor[opponentHudPlayer.color] ?? null : null;
        const activeDiceValue = currentPlayer ? diceByColor[currentPlayer.color] ?? null : null;
        const opponentCanRoll = !!(
            matchState === 'PLAYING' &&
            opponentHudPlayer &&
            currentPlayer?.color === opponentHudPlayer.color &&
            !serverState.waitingForMove &&
            !isRolling
        );
        const turnLabel = currentPlayer
            ? (isLocalMatch
                ? `${currentPlayer.username}'s turn`
                : (currentPlayer.id === user?.id ? 'Your turn' : `${currentPlayer.username}'s turn`))
            : 'Turn in progress';
        const turnColor = currentPlayer ? COLOR_MAP[currentPlayer.color].main : '#8ea7bf';
        const mobileOpponents = players.filter(player => player.color !== myHudPlayer?.color);
        const roomLabel = serverState.code || (isLocalMatch ? 'LOCAL' : 'MATCH');

        // Current player color for edge glow
        const currentPlayerColorHex = currentPlayer ? COLOR_MAP[currentPlayer.color].main : '#8ea7bf';

        const handleToggleSound = () => {
            const nextEnabled = !soundEnabled;
            soundManager.setEnabled(nextEnabled);
            setSoundEnabled(nextEnabled);
        };

        const handleBoardTap = (event: React.MouseEvent<HTMLDivElement>) => {
            if (!boardRef.current || !serverState.waitingForMove || !isMyTurn) return;
            if ((event.target as HTMLElement).closest('.piece')) return;

            const movablePieces = players.flatMap((player) =>
                player.pieces
                    .filter((piece) =>
                        serverState.movablePieces.includes(piece.id) &&
                        !piece.finished &&
                        (isLocalMatch ? player.color === currentPlayer?.color : player.color === myColor)
                    )
                    .map((piece) => ({ player, piece }))
            );

            if (movablePieces.length === 0) return;

            const rect = boardRef.current.getBoundingClientRect();
            const cellSize = rect.width / 15;
            // Convert screen tap to board-local coordinates accounting for rotation
            let relX = event.clientX - rect.left - rect.width / 2;
            let relY = event.clientY - rect.top - rect.height / 2;
            if (boardRotationDeg !== 0) {
                const angle = -boardRotationDeg * Math.PI / 180; // un-rotate
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const rx = relX * cosA - relY * sinA;
                const ry = relX * sinA + relY * cosA;
                relX = rx;
                relY = ry;
            }
            const tapColumn = Math.max(1, Math.min(15, Math.round((relX + rect.width / 2) / cellSize) + 1));
            const tapRow = Math.max(1, Math.min(15, Math.round((relY + rect.height / 2) / cellSize) + 1));

            const nearest = movablePieces
                .map(({ player, piece }) => {
                    const coords = getPieceStyle(
                        player.color,
                        piece.position,
                        piece.travelled,
                        piece.id
                    );
                    const row = Number(coords.gridRow) || 1;
                    const column = Number(coords.gridColumn) || 1;
                    return { pieceId: piece.id, distance: Math.abs(row - tapRow) + Math.abs(column - tapColumn) };
                })
                .sort((a, b) => a.distance - b.distance)[0];

            if (nearest && nearest.distance <= 2) {
                movePiece(nearest.pieceId);
            }
        };

        // Emoji reaction handler
        const handleSendEmoji = (emoji: string) => {
            playEmojiPop();
            triggerHaptic('light');
            const id = `${Date.now()}-${Math.random()}`;
            setEmojiReactions(prev => [...prev, { id, emoji, fromTop: false }]);
            setTimeout(() => {
                setEmojiReactions(prev => prev.filter(r => r.id !== id));
            }, 1500);
        };

        // computedMovePreview is now a top-level useMemo (defined above early returns)

        return (
            <div className={`ludo-game-screen${deviceProfile.isLowEnd ? ' low-end' : ''} ${shakeClass}`}>
                {/* Enhanced Confetti */}
                {showConfetti && !deviceProfile.isLowEnd && <EnhancedConfetti duration={6000} />}

                {/* Screen edge glow in current player's color */}
                {matchState === 'PLAYING' && isMyTurn && !deviceProfile.isLowEnd && (
                    <ScreenEdgeGlow color={currentPlayerColorHex} active={true} />
                )}

                {/* Urgency vignette when timer is low and it's my turn */}
                {isMyTurn && matchState === 'PLAYING' && (
                    <UrgencyVignette timeLeft={turnTimeLeft} threshold={5} />
                )}

                {/* Capture callout overlay */}
                <AnimatePresence>
                    {captureCallout && (
                        <motion.div
                            className="capture-callout-overlay"
                            initial={{ opacity: 0, scale: 0.5, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -20 }}
                            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                        >
                            <div className="capture-callout-text">
                                <span className={`callout-name callout-${captureCallout.attackerColor.toLowerCase()}`}>
                                    {captureCallout.attacker}
                                </span>
                                <span className="callout-action">CAPTURED</span>
                                <span className="callout-name callout-victim">
                                    {captureCallout.victim}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="ludo-rotate-warning">
                    <div className="rotate-phone-glyph">
                        <span />
                    </div>
                    <strong>Rotate back to portrait</strong>
                    <p>Ludo is locked for vertical mobile play.</p>
                </div>

                <div className="ludo-mobile-topbar">
                    <div className="ludo-mobile-room">
                        <span className="mobile-top-label">Room</span>
                        <strong>{roomLabel}</strong>
                    </div>
                    <div className="ludo-mobile-prize">
                        <div className="mobile-secured-mark">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="10" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span>Secured</span>
                        </div>
                        <div className="mobile-prize-value">{formatIndianNumber(payoutPot)}</div>
                    </div>
                    <div className="ludo-mobile-actions">
                        <div className="ludo-mobile-balance">
                            <span className="mobile-top-label">{isDemoMode ? 'Demo' : 'Wallet'}</span>
                            <strong>{formatIndianNumber(activeBalance)}</strong>
                        </div>
                        <button className="ludo-mobile-icon-btn" onClick={handleToggleSound} aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}>
                            {soundEnabled ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                                    <path d="M19 5a9 9 0 0 1 0 14" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <line x1="23" y1="9" x2="17" y2="15" />
                                    <line x1="17" y1="9" x2="23" y2="15" />
                                </svg>
                            )}
                        </button>
                        <button className="ludo-mobile-icon-btn leave" onClick={leaveGame} aria-label="Leave match">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="ludo-mobile-opponents">
                    {mobileOpponents.map(player => {
                        const colors = COLOR_MAP[player.color];
                        const isActive = currentPlayer?.color === player.color;
                        return (
                            <div key={`mobile-${player.color}`} className={`ludo-mobile-player-card${isActive ? ' active' : ''}`}>
                                <div className="mobile-player-token" style={{ background: colors.gradient }} />
                                <div className="mobile-player-copy">
                                    <strong>{truncatePlayerName(player.username)}</strong>
                                    <span>{player.finishedCount}/{finishTarget} home</span>
                                </div>
                                <div className="mobile-player-status">
                                    <span className="mobile-player-die">{diceByColor[player.color] ?? '-'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Player Strip */}
                {!isDuelPresentation && (
                <div className="ludo-player-strip">
                    {players.map((player, idx) => {
                        const isActive = idx === serverState.currentPlayerIndex;
                        const colors = COLOR_MAP[player.color];
                        const isMe = player.id === user?.id;

                        return (
                            <motion.div key={player.color}
                                className={`ludo-strip-player${isActive ? ' active' : ''}${isMe ? ' me' : ''}`}
                                style={{ '--strip-color': colors.main, '--strip-glow': colors.glow } as React.CSSProperties}
                                animate={isActive ? {
                                    boxShadow: [
                                        `0 0 0 0 ${colors.glow}`,
                                        `0 0 12px 3px ${colors.glow}`,
                                        `0 0 0 0 ${colors.glow}`,
                                    ],
                                } : {}}
                                transition={isActive ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                            >
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
                            </motion.div>
                        );
                    })}
                </div>
                )}

                <div className="ludo-play-area">
                    {/* Board */}
                    <div className="ludo-board-container">
                        {matchState === 'PLAYING' && (
                            <div className={`ludo-turn-pill ${isMyTurn ? 'you' : 'opponent'}`}>
                                <span className="turn-pill-dot" style={{ background: turnColor }} />
                                <span className="turn-pill-label">{turnLabel}</span>
                                <span className="turn-pill-time">{turnTimeLeft}s</span>
                            </div>
                        )}
                        {/* In-board effects layer */}
                        <div className="ludo-board-effects-layer">
                            {/* Board Flash for major events */}
                            {boardFlashColor && (
                                <BoardFlash color={boardFlashColor} show={showBoardFlash} />
                            )}

                            {/* Capture Explosion (enhanced with shockwave + flash) */}
                            <AnimatePresence>
                                {captureExplosionPos && !deviceProfile.isLowEnd && (
                                    <CaptureExplosion
                                        color={captureExplosionPos.color}
                                        x={captureExplosionPos.x}
                                        y={captureExplosionPos.y}
                                    />
                                )}
                            </AnimatePresence>

                            {/* COIN SHOWER -- gold coins cascade from capture point */}
                            {coinShowerPos && !deviceProfile.isLowEnd && (
                                <CoinShower
                                    position={coinShowerPos}
                                    coinCount={deviceProfile.isMobile
                                        ? (captureStreakRef.current > 1 ? 15 : 10)
                                        : (captureStreakRef.current > 1 ? 40 : 25)}
                                />
                            )}

                            {/* Capture Streak Bonus Badge -- x2!, x3! with coin amount */}
                            <AnimatePresence>
                                {showStreakOverlay && streakType === 'capture' && captureStreak >= 2 && (
                                    <CaptureStreakBonus streak={captureStreak} />
                                )}
                            </AnimatePresence>

                            {/* Piece Entry Burst */}
                            <AnimatePresence>
                                {pieceEntryEffect && !deviceProfile.isLowEnd && (
                                    <PieceEntryBurst
                                        color={pieceEntryEffect.color}
                                        x={pieceEntryEffect.x}
                                        y={pieceEntryEffect.y}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Home Entry Celebration */}
                            <AnimatePresence>
                                {homeCelebrationPos && !deviceProfile.isLowEnd && (
                                    <HomeEntryCelebration
                                        x={homeCelebrationPos.x}
                                        y={homeCelebrationPos.y}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Streak Overlay */}
                            <AnimatePresence>
                                {showStreakOverlay && (
                                    <StreakOverlay streak={captureStreak} type={streakType} />
                                )}
                            </AnimatePresence>

                            {/* Turn Banner (flashes briefly -- slides in from side) */}
                            {showTurnBanner && myColor && (
                                <TurnBanner
                                    isMyTurn={true}
                                    playerName="You"
                                    color={COLOR_MAP[myColor].main}
                                />
                            )}

                            {/* Near Miss Flash */}
                            <NearMissFlash show={showNearMiss} />

                            {/* Dice Roll Announcer */}
                            <AnimatePresence>
                                {diceAnnouncement && (
                                    <motion.div
                                        className={`dice-announcement${diceAnnouncement === 'SIX!' ? ' dice-announcement-six' : ' dice-announcement-no-moves'}`}
                                        initial={{ opacity: 0, scale: 0.4 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.3 }}
                                        transition={{ duration: 0.15, ease: 'easeOut' }}
                                        style={currentPlayer ? { color: COLOR_MAP[currentPlayer.color].main } : undefined}
                                    >
                                        {diceAnnouncement}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Emoji Reactions */}
                            {matchState === 'PLAYING' && (
                                <EmojiReactions
                                    onSend={handleSendEmoji}
                                    incomingReactions={emojiReactions}
                                />
                            )}
                        </div>

                        <div className={`ludo-board-wrapper${isDuelPresentation ? ' duel-wrapper' : ''}`}>
                        {/* Board-corner player avatars (Ludo King style) */}
                        {(() => {
                            const maxFinished = Math.max(...players.map(p => p.finishedCount));
                            const leadingColors = maxFinished > 0
                                ? players.filter(p => p.finishedCount === maxFinished).map(p => p.color)
                                : [];
                            // Only show crown if there is a single leader (no ties)
                            const leaderColor = leadingColors.length === 1 ? leadingColors[0] : null;
                            return players.map((player) => {
                            const colors = COLOR_MAP[player.color];
                            const isActive = currentPlayer?.color === player.color;
                            const isMe = isLocalMatch
                                ? localControlledPlayerIds.includes(player.id as string)
                                : player.id === user?.id;
                            const posClass = `player-avatar-pos-${avatarPosMap[player.color]}`;
                            const diceVal = diceByColor[player.color];
                            const isLeading = player.color === leaderColor;

                            return (
                                <div
                                    key={`avatar-${player.color}`}
                                    className={`player-avatar-circle ${posClass}${isActive ? ' active' : ''}${isLeading ? ' player-leading' : ''}`}
                                    style={{
                                        background: colors.gradient,
                                        '--avatar-color': colors.main,
                                        '--avatar-glow': colors.glow,
                                        borderColor: colors.main,
                                    } as React.CSSProperties}
                                >
                                    {player.username[0].toUpperCase()}
                                    <span className="player-avatar-score">{player.finishedCount}/{finishTarget}</span>
                                    {player.isBot && <span className="player-avatar-bot">BOT</span>}
                                    {isActive && <span className="avatar-turn-arrow">{'\u25BC'}</span>}
                                    {isActive && diceVal && (
                                        <span className="avatar-dice-result">{diceVal}</span>
                                    )}
                                    <span className="player-avatar-label">
                                        {isMe && !isLocalMatch ? 'You' : player.username.slice(0, 8)}
                                    </span>
                                    {isActive && player.finishedCount < finishTarget && (
                                        <div className="avatar-timer-ring">
                                            <TimerRing timeLeft={turnTimeLeft} maxTime={turnSeconds} color={colors.main} />
                                        </div>
                                    )}
                                </div>
                            );
                        });
                        })()}

                        <div ref={boardRef} onClick={handleBoardTap} className={`ludo-board ${isDuelPresentation ? 'duel-board' : ''}${boardRotationDeg !== 0 ? ' board-rotated' : ''}`} style={{ '--board-rotation': `${boardRotationDeg}deg` } as React.CSSProperties}>
                        <div className="base green"><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="base yellow" style={{ gridColumn: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="base red" style={{ gridRow: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="base blue" style={{ gridRow: '10 / span 6', gridColumn: '10 / span 6' }}><div className="base-inner">{[0, 1, 2, 3].map(i => <div key={i} className="piece-spot" />)}</div></div>
                        <div className="home-center">
                            <div className="home-center-triangles">
                                <div className="home-tri-top" />
                                <div className="home-tri-bottom" />
                                <div className="home-tri-left" />
                                <div className="home-tri-right" />
                            </div>
                            <div className="home-center-jewel" />
                        </div>
                        {PATH_COORDS.map((coord, i) => {
                            const startColorClass =
                                i === START_OFFSETS.GREEN ? 'start-cell-green' :
                                i === START_OFFSETS.YELLOW ? 'start-cell-yellow' :
                                i === START_OFFSETS.BLUE ? 'start-cell-blue' :
                                i === START_OFFSETS.RED ? 'start-cell-red' : '';
                            const trailMatch = trailCells.find(t => t.r === coord.r && t.c === coord.c);
                            return (
                                <div key={`path-${i}`} className={`cell ${SAFE_SPOTS.includes(i) ? 'safe' : ''} ${startColorClass}${trailMatch ? ` cell-trail cell-trail-${trailMatch.color.toLowerCase()}` : ''}`} style={{ gridRow: coord.r, gridColumn: coord.c }} />
                            );
                        })}
                        {Object.entries(HOME_PATHS).map(([color, paths]) =>
                            paths.map((coord, i) => {
                                const trailMatch = trailCells.find(t => t.r === coord.r && t.c === coord.c);
                                return (
                                    <div key={`home-${color}-${i}`} className={`cell path-${color.toLowerCase()}${trailMatch ? ` cell-trail cell-trail-${trailMatch.color.toLowerCase()}` : ''}`} style={{ gridRow: coord.r, gridColumn: coord.c }} />
                                );
                            })
                        )}

                        {/* Move preview ghosts -- show where pieces would land */}
                        {computedMovePreview && computedMovePreview.map((preview, i) => (
                            <MovePreviewGhost
                                key={`preview-${i}`}
                                color={preview.color}
                                gridRow={preview.row}
                                gridColumn={preview.col}
                                visible={true}
                            />
                        ))}

                        {(() => {
                            // Build stacking offset map: group pieces by grid cell, assign offsets
                            const STACK_OFFSETS: [number, number][] = [[-4, -4], [4, -4], [-4, 4], [4, 4]];
                            const cellGroups: Record<string, string[]> = {};
                            const allPieceData = players.flatMap(p =>
                                p.pieces.map(piece => {
                                    const style = getPieceStyle(p.color, piece.position, piece.travelled, piece.id);
                                    let row = style.gridRow;
                                    let col = style.gridColumn;
                                    const isHoppingThis = hoppingPiece?.color === p.color && hoppingPiece?.pieceId === piece.id && hoppingPiece?.isHopping;
                                    if (isHoppingThis && hoppingPiece?.currentStep) {
                                        row = hoppingPiece.currentStep.r;
                                        col = hoppingPiece.currentStep.c;
                                    }
                                    const cellKey = `${row},${col}`;
                                    const pieceKey = `${p.color}-${piece.id}`;
                                    if (!cellGroups[cellKey]) cellGroups[cellKey] = [];
                                    cellGroups[cellKey].push(pieceKey);
                                    return { player: p, piece, style };
                                })
                            );
                            const stackOffsetMap: Record<string, [number, number]> = {};
                            for (const group of Object.values(cellGroups)) {
                                if (group.length > 1) {
                                    group.forEach((key, idx) => {
                                        stackOffsetMap[key] = STACK_OFFSETS[idx % STACK_OFFSETS.length];
                                    });
                                }
                            }

                            return allPieceData.map(({ player: p, piece, style }) => {
                                const activeColor = currentPlayer?.color;
                                const isMovable = serverState.waitingForMove &&
                                    serverState.movablePieces.includes(piece.id) &&
                                    !piece.finished &&
                                    (isLocalMatch ? p.color === activeColor : (isMyTurn && p.color === myColor));

                                // Check for animation states
                                const isHopping = hoppingPiece?.color === p.color && hoppingPiece?.pieceId === piece.id && hoppingPiece?.isHopping;
                                const isFlyingBack = captureFlyback?.color === p.color && captureFlyback?.pieceId === piece.id;
                                const isAttacker = attackerPiece?.color === p.color && attackerPiece?.pieceId === piece.id;
                                const isSparkling = sparklingPiece?.color === p.color && sparklingPiece?.pieceId === piece.id;
                                const isMovingTrail = movingPieceTrail?.color === p.color && movingPieceTrail?.pieceId === piece.id;

                                // Override position if hopping or flying back
                                let finalStyle = { ...style };
                                if (isHopping && hoppingPiece.currentStep) {
                                    finalStyle = {
                                        ...finalStyle,
                                        gridRow: hoppingPiece.currentStep.r,
                                        gridColumn: hoppingPiece.currentStep.c,
                                    };
                                } else if (isFlyingBack && captureFlyback) {
                                    // BUG FIX: During flyback, anchor piece at the capture point
                                    // (fromPos), NOT at its already-updated base position.
                                    // The Framer Motion x/y arc animation moves it from fromPos to toPos.
                                    finalStyle = {
                                        ...finalStyle,
                                        gridRow: captureFlyback.fromPos.r,
                                        gridColumn: captureFlyback.fromPos.c,
                                    };
                                }

                                // Apply stacking offset when multiple pieces share a cell
                                const pieceKey = `${p.color}-${piece.id}`;
                                const stackOffset = stackOffsetMap[pieceKey];
                                if (stackOffset) {
                                    (finalStyle as any).marginLeft = `${stackOffset[0]}px`;
                                    (finalStyle as any).marginTop = `${stackOffset[1]}px`;
                                }

                                const classNames = [
                                    'piece',
                                    p.color.toLowerCase(),
                                    isMovable && 'glow',
                                    isMovingTrail && 'trail',
                                    isHopping && 'hopping',
                                    isFlyingBack && 'flyback',
                                    isAttacker && 'attacker-pulse',
                                    isSparkling && 'sparkling-enhanced',
                                ].filter(Boolean).join(' ');

                                // Compute arc flyback pixel offsets when this piece is being captured
                                let flybackArc: { dx: number; dy: number; arcY: number } | null = null;
                                if (isFlyingBack && captureFlyback && boardRef.current) {
                                    const bw = boardRef.current.getBoundingClientRect().width;
                                    const cellPx = bw / 15;
                                    const dx = (captureFlyback.toPos.c - captureFlyback.fromPos.c) * cellPx;
                                    const dy = (captureFlyback.toPos.r - captureFlyback.fromPos.r) * cellPx;
                                    const dist = Math.sqrt(dx * dx + dy * dy);
                                    // Arc height scales with distance: at least 40px, up to 120px
                                    const arcY = -Math.max(40, Math.min(120, dist * 0.45));
                                    flybackArc = { dx, dy, arcY };
                                }

                                return (
                                    <motion.div
                                        key={`${p.color}-${piece.id}`}
                                        className={classNames}
                                        style={{ ...finalStyle, cursor: isMovable ? 'pointer' : 'default' }}
                                        animate={isHopping ? {
                                            // Parabolic arc with landing bounce
                                            y: [0, -12, 1, -1, 0],
                                            scale: [1, 1.08, 0.98, 1.01, 1],
                                            scaleX: [1, 0.94, 1.04, 1],
                                            scaleY: [1, 1.08, 0.96, 1],
                                            rotateZ: -boardRotationDeg,
                                        } : isMovingTrail ? {
                                            y: [0, -14, 0],
                                            scale: [1, 1.1, 1],
                                            rotateZ: -boardRotationDeg,
                                        } : (isFlyingBack && flybackArc) ? {
                                            // Hold at capture point briefly, then arc to base
                                            x: [0, 0, flybackArc.dx * 0.5, flybackArc.dx],
                                            y: [0, 0, flybackArc.arcY, flybackArc.dy],
                                            scale: [1, 1.1, 1.3, 0.6],
                                            opacity: [1, 1, 0.9, 0.3],
                                            rotate: [-boardRotationDeg, -boardRotationDeg, -boardRotationDeg + 180, -boardRotationDeg + 360],
                                        } : isFlyingBack ? {
                                            scale: [1, 1.1, 1.4, 0.3],
                                            opacity: [1, 1, 1, 0.2],
                                            y: [0, 0, -25, 0],
                                            rotateZ: -boardRotationDeg,
                                        } : isAttacker ? {
                                            scale: [1, 1.35, 1.15, 1],
                                            rotateZ: -boardRotationDeg,
                                        } : isMovable ? {
                                            // Movable pieces "breathe" -- subtle scale pulse
                                            scale: [1, 1.08, 1],
                                            y: [0, -2, 0],
                                            rotateZ: -boardRotationDeg,
                                        } : {
                                            y: 0,
                                            scale: 1,
                                            rotateZ: -boardRotationDeg,
                                        }}
                                        onClick={() => {
                                            if (isMovable) {
                                                triggerHaptic('light');
                                                movePiece(piece.id);
                                            }
                                        }}
                                        layout={!isFlyingBack}
                                        initial={false}
                                        whileTap={isMovable ? { scale: 0.85, y: 2 } : undefined}
                                        whileHover={isMovable ? { scale: 1.15, y: -4 } : undefined}
                                        transition={isHopping
                                            ? { duration: 0.14, times: [0, 0.4, 0.85, 0.93, 1], ease: 'easeOut' }
                                            : isMovingTrail
                                            ? { duration: 0.35, times: [0, 0.4, 1], ease: 'easeOut' }
                                            : isFlyingBack
                                            ? { duration: 1.0, times: [0, 0.27, 0.6, 1], ease: [0.25, 0.1, 0.25, 1] }
                                            : isAttacker
                                            ? { duration: 0.6, times: [0, 0.25, 0.5, 1], ease: 'easeOut' }
                                            : isMovable
                                            ? { duration: 0.8, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' }
                                            : { type: 'spring', stiffness: 280, damping: 20, mass: 0.55 }}
                                    />
                                );
                            });
                        })()}
                        </div>
                        </div>{/* close ludo-board-wrapper */}

                        {matchState === 'PLAYING' && myHudPlayer && (isLocalMatch || isDuelPresentation) && (
                            <>
                                <div className="ludo-board-hud top">
                                    <div className="hud-token" style={{ background: COLOR_MAP[(opponentHudPlayer?.color || currentPlayer?.color || 'GREEN') as PlayerColor].gradient }} />
                                    <div className={`dice-3d-wrapper hud-dice-wrapper ${opponentCanRoll ? 'can-roll' : 'disabled'}`}>
                                        {opponentHudDiceValue ? (
                                            <Dice3D
                                                value={opponentHudDiceValue}
                                                isRolling={!!(isRolling && rollingColor === opponentHudPlayer?.color)}
                                                showSix={false}
                                            />
                                        ) : <span className="hud-dice-wait">...</span>}
                                    </div>
                                    {isDuelPresentation && (
                                        <div className="hud-label">{opponentHudPlayer?.username || 'Opponent'}</div>
                                    )}
                                </div>

                                <div className="ludo-board-hud bottom">
                                    <div className="hud-token" style={{ background: COLOR_MAP[myHudPlayer.color].gradient }} />
                                    <motion.div
                                        className={`dice-3d-wrapper hud-dice-wrapper ${canRollDice ? 'can-roll' : 'disabled'}${isDiceDragging ? ' dice-dragging' : ''}`}
                                        onPointerDown={handleDicePointerDown}
                                        onPointerMove={handleDicePointerMove}
                                        onPointerUp={handleDicePointerUp}
                                        onPointerLeave={handleDicePointerLeave}
                                        style={diceSwipeStyle}
                                        whileTap={canRollDice ? { scale: 0.85 } : {}}
                                        animate={dicePressed && canRollDice ? { scale: 0.9, y: 2 } : {}}
                                    >
                                        {myHudDiceValue ? (
                                            <Dice3D
                                                value={myHudDiceValue}
                                                isRolling={!!(isRolling && rollingColor === myHudPlayer.color)}
                                                showSix={!!(showSixEffect && rollingColor === myHudPlayer.color)}
                                            />
                                        ) : (
                                            <span className="hud-dice-wait">{canRollDice ? 'TAP' : 'WAIT'}</span>
                                        )}
                                        {consecutiveSixes >= 2 && (
                                            <div className={`six-counter-badge ${consecutiveSixes >= 3 ? 'six-counter-danger' : 'six-counter-warning'}`}>
                                                x{consecutiveSixes}
                                            </div>
                                        )}
                                    </motion.div>
                                    <div className="hud-turn-arrow">&#9664;</div>
                                    {isDuelPresentation && (
                                        <div className="hud-label">You</div>
                                    )}
                                </div>
                            </>
                        )}
                        <AnimatePresence>
                            {isDuelPresentation && matchState === 'PLAYING' && isMyTurn && serverState.waitingForMove && (
                                <motion.div
                                    className="ludo-move-hint"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                >
                                    <span className="hint-hand">{'\u{1F446}'}</span> Select your token to move
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {matchState === 'PLAYING' && (
                    <div className="ludo-mobile-bottom-bar">
                        <div className={`ludo-mobile-self-card${isMyTurn ? ' active' : ''}`} style={{ '--card-player-color': myHudPlayer ? COLOR_MAP[myHudPlayer.color].main : COLOR_MAP.RED.main } as React.CSSProperties}>
                            <div className="mobile-player-token you" style={{ background: myHudPlayer ? COLOR_MAP[myHudPlayer.color].gradient : COLOR_MAP.RED.gradient }} />
                            <div className="mobile-player-copy">
                                <strong>{truncatePlayerName(myHudPlayer?.username || 'You')}</strong>
                                <span>{myHudPlayer?.finishedCount || 0}/{finishTarget} home</span>
                            </div>
                            <div className="mobile-player-status">
                                <span className="mobile-player-turn">{isMyTurn ? 'Your turn' : turnLabel}</span>
                            </div>
                        </div>

                        <div className="ludo-mobile-dice-zone">
                            <motion.div
                                className={`dice-3d-wrapper mobile-dice-wrapper ${canRollDice ? 'can-roll' : 'disabled'}${isDiceDragging ? ' dice-dragging' : ''}`}
                                onPointerDown={handleDicePointerDown}
                                onPointerMove={handleDicePointerMove}
                                onPointerUp={handleDicePointerUp}
                                onPointerLeave={handleDicePointerLeave}
                                style={diceSwipeStyle}
                                whileTap={canRollDice ? { scale: 0.85 } : {}}
                                animate={dicePressed && canRollDice ? { scale: 0.92, y: 3 } : {}}
                            >
                                {activeDiceValue ? (
                                    <Dice3D
                                        value={activeDiceValue}
                                        isRolling={!!(isRolling && rollingColor === currentPlayer?.color)}
                                        showSix={!!showSixEffect}
                                    />
                                ) : (
                                    <span className="hud-dice-wait">{canRollDice ? 'ROLL' : 'WAIT'}</span>
                                )}
                                {consecutiveSixes >= 2 && (
                                    <div className={`six-counter-badge ${consecutiveSixes >= 3 ? 'six-counter-danger' : 'six-counter-warning'}`}>
                                        x{consecutiveSixes}
                                    </div>
                                )}
                            </motion.div>
                            {/* Dice six burst effect */}
                            <AnimatePresence>
                                {diceSixBurstPos && showSixEffect && !deviceProfile.isLowEnd && (
                                    <DiceSixBurst x={0} y={0} />
                                )}
                            </AnimatePresence>
                            <div className="mobile-dice-caption">
                                {isMyTurn && serverState.waitingForMove ? 'Choose token' : (canRollDice ? 'Tap to roll' : 'Stand by')}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Winning Prediction Bar */}
                    {matchState === 'PLAYING' && serverState && (() => {
                        const playerProgress = serverState.players.map((p: ServerPlayer) => {
                            const score = p.pieces.reduce((sum: number, piece: ServerPiece) => {
                                if (piece.finished) return sum + 56;
                                if (piece.position === -1) return sum;
                                return sum + Math.max(0, piece.travelled);
                            }, 0);
                            return { color: p.color, progress: (score / 224) * 100, name: p.username || `Player ${p.color}` };
                        });
                        const totalProgress = playerProgress.reduce((s: number, p: { progress: number }) => s + p.progress, 0);
                        return (
                            <div className="ludo-prediction-bar">
                                {playerProgress.map((p: { color: string; progress: number; name: string }) => (
                                    <div
                                        key={p.color}
                                        className={`prediction-segment prediction-${p.color.toLowerCase()}`}
                                        style={{ width: `${totalProgress > 0 ? Math.max((p.progress / totalProgress) * 100, 2) : 100 / playerProgress.length}%` }}
                                    >
                                        <span className="prediction-label">{Math.round(p.progress)}%</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {/* Bottom Controls */}
                    <div className="ludo-bottom-panel">
                    {matchState === 'FINISHED' && finishData ? (
                        <div className="ludo-finish-panel enhanced">
                            {/* Trophy animation for winner */}
                            {finishData.finishOrder?.[0] && !deviceProfile.isLowEnd && (
                                <TrophyAnimation
                                    winnerName={finishData.finishOrder[0].username}
                                    winnerColor={COLOR_MAP[finishData.finishOrder[0].color as PlayerColor]?.main || '#FFD700'}
                                />
                            )}

                            <motion.h3
                                className="finish-title"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                            >
                                Game Over!
                            </motion.h3>

                            {/* Victory Podium */}
                            {finishData.finishOrder && finishData.finishOrder.length >= 2 ? (
                                <div className="podium-container">
                                    {/* 2nd place - left */}
                                    {finishData.finishOrder[1] && (() => {
                                        const p = finishData.finishOrder[1];
                                        const colors = COLOR_MAP[p.color as PlayerColor];
                                        const payout = finishData.payouts?.[p.id] || 0;
                                        const displayPayout = payout / INTERNAL_MULTIPLIER;
                                        const isMe = p.id === user?.id;
                                        return (
                                            <motion.div
                                                className="podium-place podium-2nd"
                                                initial={{ opacity: 0, y: 40 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.9, type: 'spring', stiffness: 160, damping: 14 }}
                                            >
                                                <div className="podium-avatar" style={{ background: colors?.gradient }}>
                                                    {p.username?.[0]?.toUpperCase()}
                                                </div>
                                                <span className="podium-name">{p.username} {isMe ? '(You)' : ''}</span>
                                                <span className="podium-medal silver">2nd</span>
                                                {displayPayout > 0 && (
                                                    <div className="podium-payout">
                                                        <PayoutCounter amount={displayPayout} formatter={formatIndianNumber} duration={1500} />
                                                    </div>
                                                )}
                                                <div className="podium-bar podium-bar-2nd" />
                                            </motion.div>
                                        );
                                    })()}

                                    {/* 1st place - center */}
                                    {finishData.finishOrder[0] && (() => {
                                        const p = finishData.finishOrder[0];
                                        const colors = COLOR_MAP[p.color as PlayerColor];
                                        const payout = finishData.payouts?.[p.id] || 0;
                                        const displayPayout = payout / INTERNAL_MULTIPLIER;
                                        const isMe = p.id === user?.id;
                                        return (
                                            <motion.div
                                                className="podium-place podium-1st"
                                                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                transition={{ delay: 0.5, type: 'spring', stiffness: 180, damping: 12 }}
                                            >
                                                <div className="winner-crown">
                                                    <span className="crown-icon">&#x1F451;</span>
                                                </div>
                                                <div className="podium-avatar podium-avatar-1st" style={{ background: colors?.gradient }}>
                                                    {p.username?.[0]?.toUpperCase()}
                                                </div>
                                                <span className="podium-name podium-name-1st">{p.username} {isMe ? '(You)' : ''}</span>
                                                <span className="podium-medal gold">1st</span>
                                                {displayPayout > 0 && (
                                                    <div className="podium-payout podium-payout-1st">
                                                        <PayoutCounter amount={displayPayout} formatter={formatIndianNumber} duration={1500} />
                                                    </div>
                                                )}
                                                <div className="podium-bar podium-bar-1st" />
                                            </motion.div>
                                        );
                                    })()}

                                    {/* 3rd place - right */}
                                    {finishData.finishOrder[2] && (() => {
                                        const p = finishData.finishOrder[2];
                                        const colors = COLOR_MAP[p.color as PlayerColor];
                                        const payout = finishData.payouts?.[p.id] || 0;
                                        const displayPayout = payout / INTERNAL_MULTIPLIER;
                                        const isMe = p.id === user?.id;
                                        return (
                                            <motion.div
                                                className="podium-place podium-3rd"
                                                initial={{ opacity: 0, y: 40 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 1.1, type: 'spring', stiffness: 160, damping: 14 }}
                                            >
                                                <div className="podium-avatar" style={{ background: colors?.gradient }}>
                                                    {p.username?.[0]?.toUpperCase()}
                                                </div>
                                                <span className="podium-name">{p.username} {isMe ? '(You)' : ''}</span>
                                                <span className="podium-medal bronze">3rd</span>
                                                {displayPayout > 0 && (
                                                    <div className="podium-payout">
                                                        <PayoutCounter amount={displayPayout} formatter={formatIndianNumber} duration={1500} />
                                                    </div>
                                                )}
                                                <div className="podium-bar podium-bar-3rd" />
                                            </motion.div>
                                        );
                                    })()}
                                </div>
                            ) : null}

                            {/* 4th place (if exists) shown as a simple row below podium */}
                            {finishData.finishOrder?.[3] && (() => {
                                const p = finishData.finishOrder[3];
                                const colors = COLOR_MAP[p.color as PlayerColor];
                                const payout = finishData.payouts?.[p.id] || 0;
                                const displayPayout = payout / INTERNAL_MULTIPLIER;
                                const isMe = p.id === user?.id;
                                return (
                                    <motion.div
                                        className={`finish-row${isMe ? ' me' : ''}`}
                                        initial={{ opacity: 0, x: -30, scale: 0.95 }}
                                        animate={{ opacity: 1, x: 0, scale: 1 }}
                                        transition={{ duration: 0.35, delay: 1.3, type: 'spring', stiffness: 150 }}
                                    >
                                        <span className="finish-medal">4th</span>
                                        <div className="finish-avatar" style={{ background: colors?.gradient }}>
                                            {p.username?.[0]?.toUpperCase()}
                                        </div>
                                        <span className="finish-name">
                                            {p.username} {isMe ? '(You)' : ''} {p.isBot ? 'BOT' : ''}
                                        </span>
                                        {displayPayout > 0 && (
                                            <PayoutCounter amount={displayPayout} formatter={formatIndianNumber} duration={1500} />
                                        )}
                                    </motion.div>
                                );
                            })()}

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.5 }}
                            >
                                <button className="ludo-action-btn primary play-again-btn" onClick={playAgain}>Play Again</button>
                            </motion.div>
                        </div>
                    ) : isDuelPresentation ? (
                        <>
                            <div className="ludo-local-status">
                                <span>
                                    {currentPlayer
                                        ? `${currentPlayer.id === user?.id ? 'Your' : `${currentPlayer.username}'s`} turn`
                                        : 'Turn in progress'}
                                </span>
                                <strong>Pot {formatIndianNumber(totalPot * 0.95)}</strong>
                            </div>
                            <button className="ludo-leave-btn" onClick={leaveGame}>
                                Leave Match
                            </button>
                        </>
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
                                            className={`dice-3d-wrapper dock-dice-wrapper ${canRollDice ? 'can-roll' : 'disabled'}${isDiceDragging ? ' dice-dragging' : ''}`}
                                            onPointerDown={handleDicePointerDown}
                                            onPointerMove={handleDicePointerMove}
                                            onPointerUp={handleDicePointerUp}
                                            onPointerLeave={handleDicePointerLeave}
                                            style={diceSwipeStyle}
                                            whileTap={canRollDice ? { scale: 0.85 } : {}}
                                            animate={dicePressed && canRollDice ? { scale: 0.92, y: 3 } : {}}
                                        >
                                            {activeDiceValue ? (
                                                <Dice3D
                                                    value={activeDiceValue}
                                                    isRolling={!!(isRolling && rollingColor === currentPlayer?.color)}
                                                    showSix={!!(showSixEffect && rollingColor === currentPlayer?.color)}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 700 }}>
                                                    {canRollDice ? 'TAP' : 'WAIT'}
                                                </span>
                                            )}
                                            {consecutiveSixes >= 2 && (
                                                <div className={`six-counter-badge ${consecutiveSixes >= 3 ? 'six-counter-danger' : 'six-counter-warning'}`}>
                                                    x{consecutiveSixes}
                                                </div>
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
                                                    <span className="hint-hand">{'\u{1F446}'}</span> Tap here to roll
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
            <div className="ludo-loading-shell">
                <div className="ludo-loading-top shimmer-block" />
                <div className="ludo-loading-grid">
                    <div className="shimmer-block" />
                    <div className="shimmer-block" />
                </div>
                <div className="ludo-loading-board shimmer-block" />
                <div className="ludo-loading-bottom shimmer-block" />
            </div>
        </div>
    );
};
