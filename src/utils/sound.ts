// Web Audio API Sound Generator
// Generates synthetic SFX to avoid asset dependencies
// Casino-grade sound design: weighty, satisfying, addictive

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

const isSoundEnabled = () => {
    try {
        const raw = localStorage.getItem('soundSettings');
        if (!raw) return true;
        const parsed = JSON.parse(raw);
        return parsed.enabled !== false;
    } catch {
        return true;
    }
};

const getCtx = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

const getMasterNode = () => {
    const ctx = getCtx();
    if (!masterGain || !compressor) {
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 2.2;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;

        masterGain = ctx.createGain();
        masterGain.gain.value = 0.7;

        compressor.connect(masterGain);
        masterGain.connect(ctx.destination);
    }
    return compressor;
};

const connectToOutput = (node: AudioNode) => {
    node.connect(getMasterNode());
};

// Helper for white noise
const createNoiseBuffer = () => {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
};

let noiseBuffer: AudioBuffer | null = null;

const ensureNoise = () => {
    if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
    return noiseBuffer;
};

export const playClick = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
};

export const playBet = () => {
    if (!isSoundEnabled()) return;
    // Coin sound (High pitched metallic clink)
    const ctx = getCtx();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.1); // Pitch bend up

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
};

export const playWin = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Major Arpeggio
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.08;

        osc.frequency.value = freq;
        osc.type = 'triangle';

        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
    });
};

export const playLoss = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.4);
    osc.type = 'sawtooth';

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
};

// --- Game Specific Sounds ---

export const playDiceShake = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    if (!noiseBuffer) noiseBuffer = createNoiseBuffer();

    // Multiple rattles
    for (let i = 0; i < 5; i++) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 800 + Math.random() * 400;

        const start = t + (i * 0.06);

        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.05);

        src.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        src.start(start);
        src.stop(start + 0.05);
    }
};

export const playCardFlip = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    if (!noiseBuffer) noiseBuffer = createNoiseBuffer();

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 1200;

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.15);
};

export const playWheelTick = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 800; // Wood/Plastic click
    osc.type = 'square';

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
};

export const playExplosion = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    if (!noiseBuffer) noiseBuffer = createNoiseBuffer();

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 1.0);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + 1.0);
};

export const playSpinTick = playWheelTick; // Alias

// =============================================================================
// LUDO SPECIFIC SOUNDS -- Casino-Grade
// =============================================================================

// ---------------------------------------------------------------------------
// 5. PIECE HOP -- Punchy wooden block impact
// Triangle + square wave mix for woody character, with bass thump undertone
// Randomized pitch +/-200Hz so consecutive hops never sound identical
// ---------------------------------------------------------------------------
export const playHopSound = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Randomize base pitch for variety between hops
    const baseFreq = 1800 + (Math.random() - 0.5) * 400; // 1600-2000Hz center
    const dur = 0.03;

    // Primary tone -- triangle wave for woody, rounded attack
    const tri = ctx.createOscillator();
    const triGain = ctx.createGain();
    tri.frequency.setValueAtTime(baseFreq, t);
    tri.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + dur);
    tri.type = 'triangle';
    triGain.gain.setValueAtTime(0.12, t);
    triGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    tri.connect(triGain);
    connectToOutput(triGain);
    tri.start(t);
    tri.stop(t + dur + 0.005);

    // Square wave layer at half frequency -- adds "crack" character
    const sq = ctx.createOscillator();
    const sqGain = ctx.createGain();
    sq.frequency.setValueAtTime(baseFreq * 0.5, t);
    sq.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, t + dur);
    sq.type = 'square';
    sqGain.gain.setValueAtTime(0.06, t);
    sqGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    sq.connect(sqGain);
    connectToOutput(sqGain);
    sq.start(t);
    sq.stop(t + dur + 0.005);

    // Bass thump -- physical board impact feel
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.frequency.setValueAtTime(300, t);
    bass.frequency.exponentialRampToValueAtTime(150, t + 0.02);
    bass.type = 'sine';
    bassGain.gain.setValueAtTime(0.1, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    bass.connect(bassGain);
    connectToOutput(bassGain);
    bass.start(t);
    bass.stop(t + 0.025);
};

// Heavier impact on landing at final cell -- satisfying thud with resonance
export const playLandingSound = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Deep resonant thud (like placing a chess piece firmly)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.12);

    // Click accent for definition
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.frequency.setValueAtTime(900, t);
    click.frequency.exponentialRampToValueAtTime(400, t + 0.04);
    click.type = 'square';
    clickGain.gain.setValueAtTime(0.025, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    click.connect(clickGain);
    connectToOutput(clickGain);
    click.start(t);
    click.stop(t + 0.04);

    // Sub-bass weight feel
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.frequency.setValueAtTime(80, t);
    sub.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    sub.type = 'sine';
    subGain.gain.setValueAtTime(0.06, t);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    sub.connect(subGain);
    connectToOutput(subGain);
    sub.start(t);
    sub.stop(t + 0.1);
};

// Dice landing thud -- separate from roll, plays when dice settles
export const playDiceLandThud = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Sharp wooden impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(250, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.06);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.08);

    // Short noise burst for surface texture
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const nGain = ctx.createGain();
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 1200;
    nFilter.Q.value = 1.5;
    nGain.gain.setValueAtTime(0.06, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
    src.connect(nFilter);
    nFilter.connect(nGain);
    connectToOutput(nGain);
    src.start(t);
    src.stop(t + 0.04);

    // Tiny bounce
    const bounce = ctx.createOscillator();
    const bounceGain = ctx.createGain();
    bounce.frequency.setValueAtTime(200, t + 0.06);
    bounce.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    bounce.type = 'sine';
    bounceGain.gain.setValueAtTime(0.04, t + 0.06);
    bounceGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    bounce.connect(bounceGain);
    connectToOutput(bounceGain);
    bounce.start(t + 0.06);
    bounce.stop(t + 0.1);
};

// Sound for captured piece flying back to base
export const playCaptureReturn = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Descending whoosh -- longer, more dramatic
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.frequency.setValueAtTime(1800, t);
    sweep.frequency.exponentialRampToValueAtTime(150, t + 0.5);
    sweep.type = 'sawtooth';
    sweepGain.gain.setValueAtTime(0.08, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    sweep.connect(sweepGain);
    connectToOutput(sweepGain);
    sweep.start(t);
    sweep.stop(t + 0.5);

    // Whistling overtone
    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.frequency.setValueAtTime(3200, t);
    whistle.frequency.exponentialRampToValueAtTime(400, t + 0.45);
    whistle.type = 'sine';
    whistleGain.gain.setValueAtTime(0.02, t);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    whistle.connect(whistleGain);
    connectToOutput(whistleGain);
    whistle.start(t);
    whistle.stop(t + 0.45);

    // Soft landing thud at end
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.frequency.setValueAtTime(120, t + 0.42);
    thud.frequency.exponentialRampToValueAtTime(50, t + 0.55);
    thud.type = 'sine';
    thudGain.gain.setValueAtTime(0.1, t + 0.42);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
    thud.connect(thudGain);
    connectToOutput(thudGain);
    thud.start(t + 0.42);
    thud.stop(t + 0.55);
};

export const playPieceMove = () => {
    if (!isSoundEnabled()) return;
    // Soft woodblock click for piece movement
    const ctx = getCtx();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();

    osc.frequency.setValueAtTime(460, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0.055, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    click.frequency.setValueAtTime(1400, t);
    click.frequency.exponentialRampToValueAtTime(700, t + 0.03);
    click.type = 'square';
    clickGain.gain.setValueAtTime(0.012, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    click.connect(clickGain);
    connectToOutput(gain);
    connectToOutput(clickGain);
    osc.start(t);
    osc.stop(t + 0.08);
    click.start(t);
    click.stop(t + 0.03);
};

// Piece entry pop -- when a piece leaves home base after rolling a 6
// Quick ascending sweep + short pop click for bright, satisfying feedback
export const playPieceEntryPop = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Ascending tone sweep: 600Hz to 1200Hz in 60ms -- the "whoosh up" of emergence
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.frequency.setValueAtTime(600, t);
    sweep.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
    sweep.type = 'sine';
    sweepGain.gain.setValueAtTime(0.1, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    sweep.connect(sweepGain);
    connectToOutput(sweepGain);
    sweep.start(t);
    sweep.stop(t + 0.08);

    // Pop click at 2000Hz, 15ms, triangle -- the satisfying snap as piece lands on board
    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.frequency.setValueAtTime(2000, t);
    pop.frequency.exponentialRampToValueAtTime(1200, t + 0.015);
    pop.type = 'triangle';
    popGain.gain.setValueAtTime(0.09, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    pop.connect(popGain);
    connectToOutput(popGain);
    pop.start(t);
    pop.stop(t + 0.02);
};

export const playCapture = () => {
    if (!isSoundEnabled()) return;
    // Whoosh + impact sound for capturing opponent
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Whoosh (sweep down)
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();

    sweep.frequency.setValueAtTime(1200, t);
    sweep.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    sweep.type = 'sawtooth';

    sweepGain.gain.setValueAtTime(0.1, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    sweep.connect(sweepGain);
    connectToOutput(sweepGain);
    sweep.start(t);
    sweep.stop(t + 0.3);

    // Impact (low thump)
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();

    impact.frequency.value = 60;
    impact.type = 'sine';

    impactGain.gain.setValueAtTime(0.15, t + 0.25);
    impactGain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    impact.connect(impactGain);
    connectToOutput(impactGain);
    impact.start(t + 0.25);
    impact.stop(t + 0.45);
};

export const playHomeEntry = () => {
    if (!isSoundEnabled()) return;
    // Chime sound for entering home stretch
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Two-tone chime (harmonic fifth)
    [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = freq;
        osc.type = 'sine';

        const start = t + (i * 0.05);
        gain.gain.setValueAtTime(0.065, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.6);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.6);
    });
};

export const playWinSound = () => {
    if (!isSoundEnabled()) return;
    // Victorious fanfare (extended version of playWin with more notes)
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Major scale celebration: C5 D5 E5 G5 C6
    const melody = [523.25, 587.33, 659.25, 783.99, 1046.50];

    melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.12;

        osc.frequency.value = freq;
        osc.type = 'triangle';

        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.5);
    });

    // Add harmonic layer
    setTimeout(() => {
        [1046.50, 1318.51].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = ctx.currentTime + (i * 0.08);

            osc.frequency.value = freq;
            osc.type = 'sine';

            gain.gain.setValueAtTime(0.04, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.8);

            osc.connect(gain);
            connectToOutput(gain);
            osc.start(start);
            osc.stop(start + 0.8);
        });
    }, 400);
};

export const playTurnStart = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    [740, 988].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.05;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.05, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.2);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.2);
    });
};

// Urgency tick with accelerating pitch based on remaining time
export const playUrgencyTick = (timeLeft?: number) => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Higher pitch as time decreases -- creates escalating tension
    const urgencyMultiplier = timeLeft !== undefined ? (1 + (5 - Math.max(0, timeLeft)) * 0.08) : 1;
    const baseFreq = 880 * urgencyMultiplier;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, t + 0.06);

    const vol = 0.04 + (timeLeft !== undefined ? (5 - Math.max(0, timeLeft)) * 0.008 : 0);
    gain.gain.setValueAtTime(Math.min(vol, 0.08), t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.06);

    // Second click for "clock" feel
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'sine';
    click.frequency.setValueAtTime(baseFreq * 1.5, t + 0.04);
    click.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.07);
    clickGain.gain.setValueAtTime(0.02, t + 0.04);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    click.connect(clickGain);
    connectToOutput(clickGain);
    click.start(t + 0.04);
    click.stop(t + 0.07);
};

// Payout coin tick sound -- used during counter animation
export const playPayoutTick = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Metallic coin clink
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(2800, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.025);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.025, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.035);
};

// =============================================================================
// ENHANCED LUDO SOUNDS -- Casino-Grade, Addictive
// =============================================================================

// ---------------------------------------------------------------------------
// 3. DICE ROLL -- Heavy, satisfying, 4-phase sound design (~750ms total)
// Phase 1: RATTLE - 12-15 bright clicks with descending pitch (dice settling)
// Phase 2: TUMBLE - 3 heavy thuds at descending frequencies
// Phase 3: LAND   - Deep authoritative thud with click accent
// Phase 4: SETTLE - 2 tiny ticks as die comes to rest
// ---------------------------------------------------------------------------
export const playDiceShakeEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Phase 1: RATTLE (0-350ms) -- 14 bright clicks, descending pitch
    const rattleCount = 14;
    for (let i = 0; i < rattleCount; i++) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'bandpass';
        // Start high (5500Hz), descend to 3500Hz as dice "settles"
        const progress = i / rattleCount;
        const baseFreq = 5500 - progress * 2000;
        filter.frequency.value = baseFreq + (Math.random() - 0.5) * 500;
        filter.Q.value = 6 + Math.random() * 4;

        // Stagger timing with slight randomness for organic feel
        const gap = 0.018 + Math.random() * 0.012; // 18-30ms apart
        const start = t + i * gap;
        const dur = 0.015 + Math.random() * 0.008;

        // Each click is punchy -- gain 0.25
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + dur);

        src.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        src.start(start);
        src.stop(start + dur + 0.005);
    }

    // Phase 2: TUMBLE (150ms, 350ms, 500ms) -- 3 heavy descending thuds
    const tumbleData = [
        { time: 0.15, freq: 200 },
        { time: 0.35, freq: 180 },
        { time: 0.50, freq: 160 },
    ];
    tumbleData.forEach(({ time, freq }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + time + 0.08);
        gain.gain.setValueAtTime(0.3, t + time);
        gain.gain.exponentialRampToValueAtTime(0.01, t + time + 0.1);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(t + time);
        osc.stop(t + time + 0.12);
    });

    // Phase 3: LAND (at 550ms) -- deep authoritative thud
    const landTime = 0.55;
    // Deep bass body
    const landBass = ctx.createOscillator();
    const landBassGain = ctx.createGain();
    landBass.type = 'sine';
    landBass.frequency.setValueAtTime(100, t + landTime);
    landBass.frequency.exponentialRampToValueAtTime(40, t + landTime + 0.1);
    landBassGain.gain.setValueAtTime(0.5, t + landTime);
    landBassGain.gain.exponentialRampToValueAtTime(0.01, t + landTime + 0.1);
    landBass.connect(landBassGain);
    connectToOutput(landBassGain);
    landBass.start(t + landTime);
    landBass.stop(t + landTime + 0.12);

    // Click accent on top of the landing thud
    const landClick = ctx.createOscillator();
    const landClickGain = ctx.createGain();
    landClick.type = 'triangle';
    landClick.frequency.setValueAtTime(1500, t + landTime);
    landClick.frequency.exponentialRampToValueAtTime(800, t + landTime + 0.02);
    landClickGain.gain.setValueAtTime(0.2, t + landTime);
    landClickGain.gain.exponentialRampToValueAtTime(0.01, t + landTime + 0.03);
    landClick.connect(landClickGain);
    connectToOutput(landClickGain);
    landClick.start(t + landTime);
    landClick.stop(t + landTime + 0.04);

    // Phase 4: SETTLE (650ms, 700ms) -- 2 tiny ticks, die coming to rest
    [0.65, 0.70].forEach((offset) => {
        const tick = ctx.createOscillator();
        const tickGain = ctx.createGain();
        tick.type = 'triangle';
        tick.frequency.setValueAtTime(3000, t + offset);
        tick.frequency.exponentialRampToValueAtTime(2000, t + offset + 0.015);
        tickGain.gain.setValueAtTime(0.1, t + offset);
        tickGain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.015);
        tick.connect(tickGain);
        connectToOutput(tickGain);
        tick.start(t + offset);
        tick.stop(t + offset + 0.02);
    });
};

// ---------------------------------------------------------------------------
// 4. SIX ROLLED -- DRAMATIC FANFARE
// Ascending arpeggio C5->E5->G5->C6 with triangle wave
// Low boom bass undertone at 80Hz
// Shimmer finish: filtered white noise at 6000Hz, slow decay
// ---------------------------------------------------------------------------
export const playSixRolled = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Low BOOM bass foundation -- feel it in your chest
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, t);
    boom.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    boomGain.gain.setValueAtTime(0.35, t);
    boomGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    boom.connect(boomGain);
    connectToOutput(boomGain);
    boom.start(t);
    boom.stop(t + 0.22);

    // Ascending arpeggio: C5 -> E5 -> G5 -> C6
    const arpNotes = [523, 659, 784, 1047];
    const noteDur = 0.06;
    const noteGap = 0.04;
    arpNotes.forEach((freq, i) => {
        const start = t + i * (noteDur + noteGap); // 100ms per note slot

        // Primary tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'triangle';
        // Crescendo through the arpeggio
        const vol = 0.1 + (i / arpNotes.length) * 0.08;
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + noteDur + 0.15);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + noteDur + 0.2);

        // Octave shimmer on each note for sparkle
        const shimOsc = ctx.createOscillator();
        const shimGain = ctx.createGain();
        shimOsc.frequency.value = freq * 2;
        shimOsc.type = 'sine';
        shimGain.gain.setValueAtTime(0.03, start + 0.01);
        shimGain.gain.exponentialRampToValueAtTime(0.001, start + noteDur + 0.1);
        shimOsc.connect(shimGain);
        connectToOutput(shimGain);
        shimOsc.start(start + 0.01);
        shimOsc.stop(start + noteDur + 0.12);
    });

    // SHIMMER finish -- white noise filtered at 6000Hz with slow decay
    const shimmerTime = t + arpNotes.length * (noteDur + noteGap);
    const shimmerSrc = ctx.createBufferSource();
    shimmerSrc.buffer = buf;
    const shimmerGain = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.value = 6000;
    shimmerFilter.Q.value = 1.5;
    shimmerGain.gain.setValueAtTime(0.12, shimmerTime);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, shimmerTime + 0.4);
    shimmerSrc.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    connectToOutput(shimmerGain);
    shimmerSrc.start(shimmerTime);
    shimmerSrc.stop(shimmerTime + 0.42);
};

// ---------------------------------------------------------------------------
// 2. CAPTURE SOUND -- DEVASTATING 5-layer explosion
// Layer 1: DEEP BASS IMPACT -- 60Hz sine, feel it in your chest
// Layer 2: CRACK -- bandpass-filtered white noise burst at 2000Hz
// Layer 3: GLASS SHATTER -- high noise burst 4000-8000Hz
// Layer 4: REVERB TAIL -- low sine 100Hz, slow decay
// Layer 5: DRAMATIC CHORD -- minor chord (A2, C3, E3) with triangle wave
// ---------------------------------------------------------------------------
export const playCaptureEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Layer 1: DEEP BASS IMPACT -- sine 60Hz, 150ms, gain 0.5
    const bassImpact = ctx.createOscillator();
    const bassImpactGain = ctx.createGain();
    bassImpact.type = 'sine';
    bassImpact.frequency.setValueAtTime(60, t);
    bassImpact.frequency.exponentialRampToValueAtTime(30, t + 0.15);
    bassImpactGain.gain.setValueAtTime(0.5, t);
    bassImpactGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    bassImpact.connect(bassImpactGain);
    connectToOutput(bassImpactGain);
    bassImpact.start(t);
    bassImpact.stop(t + 0.17);

    // Layer 2: CRACK -- white noise burst filtered at 2000Hz, bandpass Q=5, 50ms
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = buf;
    const crackGain = ctx.createGain();
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 2000;
    crackFilter.Q.value = 5;
    crackGain.gain.setValueAtTime(0.4, t);
    crackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    crackSrc.connect(crackFilter);
    crackFilter.connect(crackGain);
    connectToOutput(crackGain);
    crackSrc.start(t);
    crackSrc.stop(t + 0.06);

    // Layer 3: GLASS SHATTER -- high noise burst 4000-8000Hz, 80ms with fast decay
    const shatterSrc = ctx.createBufferSource();
    shatterSrc.buffer = buf;
    const shatterGain = ctx.createGain();
    const shatterFilter = ctx.createBiquadFilter();
    shatterFilter.type = 'bandpass';
    shatterFilter.frequency.value = 6000; // Center between 4000-8000Hz
    shatterFilter.Q.value = 0.5; // Wide band to cover 4000-8000Hz range
    shatterGain.gain.setValueAtTime(0.3, t + 0.01);
    shatterGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
    shatterSrc.connect(shatterFilter);
    shatterFilter.connect(shatterGain);
    connectToOutput(shatterGain);
    shatterSrc.start(t + 0.01);
    shatterSrc.stop(t + 0.1);

    // Layer 4: REVERB TAIL -- low sine 100Hz, slow decay over 400ms
    const reverbTail = ctx.createOscillator();
    const reverbGain = ctx.createGain();
    reverbTail.type = 'sine';
    reverbTail.frequency.setValueAtTime(100, t + 0.02);
    reverbTail.frequency.exponentialRampToValueAtTime(60, t + 0.42);
    reverbGain.gain.setValueAtTime(0.15, t + 0.02);
    reverbGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    reverbTail.connect(reverbGain);
    connectToOutput(reverbGain);
    reverbTail.start(t + 0.02);
    reverbTail.stop(t + 0.44);

    // Layer 5: DRAMATIC CHORD -- minor chord A2(110Hz) + C3(131Hz) + E3(165Hz)
    // Triangle wave, 300ms with slow release for emotional weight
    const chordFreqs = [110, 131, 165];
    chordFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, t + 0.03);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.33);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(t + 0.03);
        osc.stop(t + 0.35);
    });

    // Debris scatter -- 6 tiny high-freq clicks for additional impact feel
    for (let i = 0; i < 6; i++) {
        const debrisOsc = ctx.createOscillator();
        const dGain = ctx.createGain();
        const debrisFreq = 4000 + Math.random() * 4000;
        const debrisStart = t + 0.04 + Math.random() * 0.12;
        debrisOsc.frequency.setValueAtTime(debrisFreq, debrisStart);
        debrisOsc.frequency.exponentialRampToValueAtTime(debrisFreq * 0.4, debrisStart + 0.012);
        debrisOsc.type = 'square';
        dGain.gain.setValueAtTime(0.08, debrisStart);
        dGain.gain.exponentialRampToValueAtTime(0.001, debrisStart + 0.012);
        debrisOsc.connect(dGain);
        connectToOutput(dGain);
        debrisOsc.start(debrisStart);
        debrisOsc.stop(debrisStart + 0.015);
    }
};

// ---------------------------------------------------------------------------
// 6. HOME ENTRY -- Maximum celebration, victory jingle
// Quick ascending scale C5->D5->E5->G5->C6 (50ms each)
// Sustained major chord C5+E5+G5 (500ms slow fade)
// Cymbal crash: noise burst 8000Hz, 600ms slow decay
// 3 sparkle tones at random high frequencies
// ---------------------------------------------------------------------------
export const playHomeEntryEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Quick ascending scale: C5 D5 E5 G5 C6
    const scaleNotes = [523, 587, 659, 784, 1047];
    const scaleDur = 0.05;
    scaleNotes.forEach((freq, i) => {
        const start = t + i * scaleDur;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        // Crescendo through the scale
        const vol = 0.1 + (i / scaleNotes.length) * 0.06;
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + scaleDur + 0.08);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + scaleDur + 0.1);
    });

    // SUSTAINED CHORD: C5(523) + E5(659) + G5(784) together, 500ms slow fade
    const chordStart = t + scaleNotes.length * scaleDur + 0.02;
    const chordFreqs = [523, 659, 784];
    chordFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.12, chordStart);
        gain.gain.linearRampToValueAtTime(0.1, chordStart + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.5);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(chordStart);
        osc.stop(chordStart + 0.52);

        // Add slight reverb via delay
        const delay = ctx.createDelay();
        delay.delayTime.value = 0.03;
        const delayGain = ctx.createGain();
        delayGain.gain.value = 0.15;
        gain.connect(delay);
        delay.connect(delayGain);
        connectToOutput(delayGain);
    });

    // CYMBAL CRASH: noise burst at 8000Hz, 600ms with slow decay
    const cymbalSrc = ctx.createBufferSource();
    cymbalSrc.buffer = buf;
    const cymbalGain = ctx.createGain();
    const cymbalFilter = ctx.createBiquadFilter();
    cymbalFilter.type = 'highpass';
    cymbalFilter.frequency.value = 8000;
    cymbalGain.gain.setValueAtTime(0.15, chordStart);
    cymbalGain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.6);
    cymbalSrc.connect(cymbalFilter);
    cymbalFilter.connect(cymbalGain);
    connectToOutput(cymbalGain);
    cymbalSrc.start(chordStart);
    cymbalSrc.stop(chordStart + 0.62);

    // 3 SPARKLE tones at random high frequencies, scattered over 300ms
    for (let i = 0; i < 3; i++) {
        const sparkle = ctx.createOscillator();
        const sparkleGain = ctx.createGain();
        const sparkleFreq = 3000 + Math.random() * 2000; // 3000-5000Hz
        const sparkleTime = chordStart + Math.random() * 0.3;
        sparkle.frequency.value = sparkleFreq;
        sparkle.type = 'sine';
        sparkleGain.gain.setValueAtTime(0.08, sparkleTime);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, sparkleTime + 0.02);
        sparkle.connect(sparkleGain);
        connectToOutput(sparkleGain);
        sparkle.start(sparkleTime);
        sparkle.stop(sparkleTime + 0.025);
    }
};

export const playStreakSound = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Power-up ascending sweep -- like leveling up
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.frequency.setValueAtTime(250, t);
    sweep.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
    sweep.type = 'sawtooth';
    sweepGain.gain.setValueAtTime(0.06, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    sweep.connect(sweepGain);
    connectToOutput(sweepGain);
    sweep.start(t);
    sweep.stop(t + 0.3);

    // Punctuation power chord
    [880, 1108.73, 1318.51, 1760].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + 0.22;
        osc.frequency.value = freq;
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.04, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.5);
    });

    // Electric sizzle
    const buf = ensureNoise();
    const sizzle = ctx.createBufferSource();
    sizzle.buffer = buf;
    const sizzleGain = ctx.createGain();
    const sizzleFilter = ctx.createBiquadFilter();
    sizzleFilter.type = 'highpass';
    sizzleFilter.frequency.value = 4000;
    sizzleGain.gain.setValueAtTime(0.03, t + 0.2);
    sizzleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    sizzle.connect(sizzleFilter);
    sizzleFilter.connect(sizzleGain);
    connectToOutput(sizzleGain);
    sizzle.start(t + 0.2);
    sizzle.stop(t + 0.5);
};

// Grand victory fanfare -- multi-layered, emotional, unmistakable
export const playWinSoundEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Phase 1: Fanfare melody -- C5 E5 G5 C6 E6 (bright major)
    const melody = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.1;

        osc.frequency.value = freq;
        osc.type = 'triangle';

        // Build to peak
        const vol = 0.06 + (i / melody.length) * 0.06;
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.7);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.7);

        // Octave shimmer on each note
        const shimmer = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        shimmer.frequency.value = freq * 2;
        shimmer.type = 'sine';
        shimmerGain.gain.setValueAtTime(0.025, start + 0.02);
        shimmerGain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        shimmer.connect(shimmerGain);
        connectToOutput(shimmerGain);
        shimmer.start(start + 0.02);
        shimmer.stop(start + 0.5);
    });

    // Phase 2: Sustained victory chord (delayed to let melody breathe)
    setTimeout(() => {
        const chordCtx = getCtx();
        const ct = chordCtx.currentTime;

        // Full major chord with 7th -- lush and triumphant
        [1046.50, 1318.51, 1567.98, 1864.66].forEach((freq) => {
            const osc = chordCtx.createOscillator();
            const gain = chordCtx.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.045, ct);
            gain.gain.exponentialRampToValueAtTime(0.01, ct + 1.8);
            osc.connect(gain);
            connectToOutput(gain);
            osc.start(ct);
            osc.stop(ct + 1.8);
        });

        // High bell for emotional peak
        const bell = chordCtx.createOscillator();
        const bellGain = chordCtx.createGain();
        bell.frequency.value = 3135.96; // G7
        bell.type = 'sine';
        bellGain.gain.setValueAtTime(0.015, ct + 0.1);
        bellGain.gain.exponentialRampToValueAtTime(0.001, ct + 1.5);
        bell.connect(bellGain);
        connectToOutput(bellGain);
        bell.start(ct + 0.1);
        bell.stop(ct + 1.5);
    }, 500);

    // Phase 3: Bass foundation -- timpani roll feel
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.frequency.setValueAtTime(130, t + 0.5);
    bass.frequency.exponentialRampToValueAtTime(40, t + 0.9);
    bass.type = 'sine';
    bassGain.gain.setValueAtTime(0.12, t + 0.5);
    bassGain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
    bass.connect(bassGain);
    connectToOutput(bassGain);
    bass.start(t + 0.5);
    bass.stop(t + 1.0);

    // Second bass hit for emphasis
    const bass2 = ctx.createOscillator();
    const bass2Gain = ctx.createGain();
    bass2.frequency.setValueAtTime(98, t + 0.7);
    bass2.frequency.exponentialRampToValueAtTime(35, t + 1.1);
    bass2.type = 'sine';
    bass2Gain.gain.setValueAtTime(0.08, t + 0.7);
    bass2Gain.gain.exponentialRampToValueAtTime(0.01, t + 1.1);
    bass2.connect(bass2Gain);
    connectToOutput(bass2Gain);
    bass2.start(t + 0.7);
    bass2.stop(t + 1.1);
};

// ---------------------------------------------------------------------------
// 9. NEAR MISS -- Tension builder, makes player want to try again
// Descending slide 1200Hz->400Hz over 150ms
// "Ooh" beat frequency effect: two detuned sines at 300Hz and 305Hz (5Hz beat)
// ---------------------------------------------------------------------------
export const playNearMiss = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Descending slide -- 1200Hz to 400Hz over 150ms
    const slide = ctx.createOscillator();
    const slideGain = ctx.createGain();
    slide.frequency.setValueAtTime(1200, t);
    slide.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    slide.type = 'sine';
    slideGain.gain.setValueAtTime(0.1, t);
    slideGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    slide.connect(slideGain);
    connectToOutput(slideGain);
    slide.start(t);
    slide.stop(t + 0.17);

    // "Ooh" effect -- two detuned sines creating 5Hz beat frequency
    // This creates a wobbling, tension-filled undertone
    const ooh1 = ctx.createOscillator();
    const ooh1Gain = ctx.createGain();
    ooh1.frequency.value = 300;
    ooh1.type = 'sine';
    ooh1Gain.gain.setValueAtTime(0.06, t + 0.05);
    ooh1Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    ooh1.connect(ooh1Gain);
    connectToOutput(ooh1Gain);
    ooh1.start(t + 0.05);
    ooh1.stop(t + 0.27);

    const ooh2 = ctx.createOscillator();
    const ooh2Gain = ctx.createGain();
    ooh2.frequency.value = 305; // 5Hz detuning = pulsing beat
    ooh2.type = 'sine';
    ooh2Gain.gain.setValueAtTime(0.06, t + 0.05);
    ooh2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    ooh2.connect(ooh2Gain);
    connectToOutput(ooh2Gain);
    ooh2.start(t + 0.05);
    ooh2.stop(t + 0.27);
};

export const playBetClick = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Satisfying tactile click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.04);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.05);
};

export const playEmojiPop = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Bubbly pop with more body
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.05);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.08);

    // Resonant tail
    const tail = ctx.createOscillator();
    const tailGain = ctx.createGain();
    tail.frequency.setValueAtTime(1400, t + 0.04);
    tail.frequency.exponentialRampToValueAtTime(800, t + 0.12);
    tail.type = 'sine';
    tailGain.gain.setValueAtTime(0.03, t + 0.04);
    tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    tail.connect(tailGain);
    connectToOutput(tailGain);
    tail.start(t + 0.04);
    tail.stop(t + 0.12);
};

// Three sixes forfeit -- ominous descending sound
export const playThreeSixesForfeit = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Descending doom tones
    [880, 659.25, 440, 329.63].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.1;
        osc.frequency.value = freq;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.3);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.3);
    });

    // Sad trombone sub
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.frequency.setValueAtTime(200, t + 0.3);
    sub.frequency.exponentialRampToValueAtTime(80, t + 0.7);
    sub.type = 'triangle';
    subGain.gain.setValueAtTime(0.06, t + 0.3);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
    sub.connect(subGain);
    connectToOutput(subGain);
    sub.start(t + 0.3);
    sub.stop(t + 0.7);
};

// ---------------------------------------------------------------------------
// 8. TURN CHANGE SWOOSH -- Subtle subconscious signal
// Bandpass filtered noise sweeping 300Hz->1500Hz over 200ms
// Gain 0.08 -- just enough to register without interrupting
// ---------------------------------------------------------------------------
export const playTurnChangeSwoosh = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Bandpass filter sweeping 300Hz to 1500Hz
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + 0.2);
    filter.Q.value = 1.2;

    // Subtle gain -- just enough to subconsciously signal the turn change
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.04);
    gain.gain.setValueAtTime(0.08, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    src.connect(filter);
    filter.connect(gain);
    connectToOutput(gain);
    src.start(t);
    src.stop(t + 0.22);
};

// ---------------------------------------------------------------------------
// 1. COIN SHOWER -- Slot machine payout cascading coins
// 18 rapid metallic clinks at 2000-4000Hz with fast decay
// Low whoosh underneath: filtered noise sweep 200->800Hz
// "Cha-ching" punctuation at the end
// ---------------------------------------------------------------------------
export const playCoinShower = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // 18 rapid metallic "clink" sounds -- slot machine payout cascade
    const clinkCount = 18;
    for (let i = 0; i < clinkCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Random stagger: 30-50ms between clinks
        const delay = i * (0.03 + Math.random() * 0.02);
        // Randomized frequency in 2000-4000Hz for metallic variety
        const freq = 2000 + Math.random() * 2000;
        // Duration: 15-25ms for crisp metallic transients
        const dur = 0.015 + Math.random() * 0.01;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + delay + dur);

        // Metallic resonance via peaking filter
        filter.type = 'peaking';
        filter.frequency.value = freq * 1.5;
        filter.Q.value = 10;
        filter.gain.value = 8;

        // Stagger volume slightly for natural cascade feel
        const vol = 0.1 + Math.random() * 0.06;
        gain.gain.setValueAtTime(vol, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur + 0.02);

        osc.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.025);
    }

    // Low WHOOSH underneath -- filtered noise sweep 200->800Hz, 200ms
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = buf;
    const whooshGain = ctx.createGain();
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(200, t);
    whooshFilter.frequency.exponentialRampToValueAtTime(800, t + 0.2);
    whooshFilter.Q.value = 1;
    whooshGain.gain.setValueAtTime(0.08, t);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    whooshSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    connectToOutput(whooshGain);
    whooshSrc.start(t);
    whooshSrc.stop(t + 0.22);

    // Shimmering sustain: filtered noise for coin rattle texture
    const rattle = ctx.createBufferSource();
    rattle.buffer = buf;
    const rattleGain = ctx.createGain();
    const rattleFilter = ctx.createBiquadFilter();
    rattleFilter.type = 'bandpass';
    rattleFilter.frequency.setValueAtTime(5000, t + 0.1);
    rattleFilter.frequency.exponentialRampToValueAtTime(8000, t + 0.4);
    rattleFilter.Q.value = 2;
    rattleGain.gain.setValueAtTime(0.05, t + 0.1);
    rattleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    rattle.connect(rattleFilter);
    rattleFilter.connect(rattleGain);
    connectToOutput(rattleGain);
    rattle.start(t + 0.1);
    rattle.stop(t + 0.62);

    // "Cha-ching" two-note punctuation at the end
    const ching1 = ctx.createOscillator();
    const ching1Gain = ctx.createGain();
    ching1.type = 'sine';
    ching1.frequency.setValueAtTime(1800, t + 0.35);
    ching1Gain.gain.setValueAtTime(0.12, t + 0.35);
    ching1Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    ching1.connect(ching1Gain);
    connectToOutput(ching1Gain);
    ching1.start(t + 0.35);
    ching1.stop(t + 0.52);

    const ching2 = ctx.createOscillator();
    const ching2Gain = ctx.createGain();
    ching2.type = 'sine';
    ching2.frequency.setValueAtTime(2400, t + 0.42);
    ching2Gain.gain.setValueAtTime(0.15, t + 0.42);
    ching2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    ching2.connect(ching2Gain);
    connectToOutput(ching2Gain);
    ching2.start(t + 0.42);
    ching2.stop(t + 0.62);
};

// ---------------------------------------------------------------------------
// 7. STREAK BONUS -- Escalating celebration based on streak count
// Base: coin shower sound
// Higher streak = higher pitched "cha-ching"
// Streak >= 3: POWER UP ascending sine sweep 200->2000Hz
// Streak >= 5: Deep GONG at 65Hz, 800ms slow decay
// ---------------------------------------------------------------------------
export const playStreakBonus = (streakCount: number) => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Base: coin shower cascade (inline for pitch control)
    const clinkCount = Math.min(12 + streakCount * 2, 22); // More clinks for higher streaks
    const pitchMultiplier = 1 + (streakCount - 1) * 0.15; // Higher streak = higher pitch

    for (let i = 0; i < clinkCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const delay = i * (0.025 + Math.random() * 0.02);
        const freq = (2000 + Math.random() * 2000) * pitchMultiplier;
        const dur = 0.015 + Math.random() * 0.01;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(Math.min(freq, 8000), t + delay);
        osc.frequency.exponentialRampToValueAtTime(Math.min(freq, 8000) * 0.6, t + delay + dur);

        const vol = 0.08 + Math.random() * 0.05;
        gain.gain.setValueAtTime(vol, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur + 0.02);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.025);
    }

    // Pitched "cha-ching" -- higher streak = higher pitch
    const chingBase = 1800 * pitchMultiplier;
    const ching1 = ctx.createOscillator();
    const ching1Gain = ctx.createGain();
    ching1.type = 'sine';
    ching1.frequency.setValueAtTime(Math.min(chingBase, 7000), t + 0.3);
    ching1Gain.gain.setValueAtTime(0.12, t + 0.3);
    ching1Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    ching1.connect(ching1Gain);
    connectToOutput(ching1Gain);
    ching1.start(t + 0.3);
    ching1.stop(t + 0.47);

    const ching2Freq = Math.min(chingBase * 1.33, 8000);
    const ching2 = ctx.createOscillator();
    const ching2Gain = ctx.createGain();
    ching2.type = 'sine';
    ching2.frequency.setValueAtTime(ching2Freq, t + 0.37);
    ching2Gain.gain.setValueAtTime(0.15, t + 0.37);
    ching2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    ching2.connect(ching2Gain);
    connectToOutput(ching2Gain);
    ching2.start(t + 0.37);
    ching2.stop(t + 0.57);

    // Streak >= 3: POWER UP -- ascending sine sweep 200->2000Hz over 300ms
    if (streakCount >= 3) {
        const powerUp = ctx.createOscillator();
        const powerGain = ctx.createGain();
        powerUp.type = 'sawtooth';
        powerUp.frequency.setValueAtTime(200, t + 0.05);
        powerUp.frequency.exponentialRampToValueAtTime(2000, t + 0.35);
        powerGain.gain.setValueAtTime(0.08, t + 0.05);
        powerGain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);
        powerUp.connect(powerGain);
        connectToOutput(powerGain);
        powerUp.start(t + 0.05);
        powerUp.stop(t + 0.4);

        // Electric sizzle layer
        const sizzle = ctx.createBufferSource();
        sizzle.buffer = buf;
        const sizzleGain = ctx.createGain();
        const sizzleFilter = ctx.createBiquadFilter();
        sizzleFilter.type = 'highpass';
        sizzleFilter.frequency.value = 5000;
        sizzleGain.gain.setValueAtTime(0.04, t + 0.25);
        sizzleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        sizzle.connect(sizzleFilter);
        sizzleFilter.connect(sizzleGain);
        connectToOutput(sizzleGain);
        sizzle.start(t + 0.25);
        sizzle.stop(t + 0.52);
    }

    // Streak >= 5: Deep GONG -- sine at 65Hz, 800ms with slow decay
    if (streakCount >= 5) {
        const gong = ctx.createOscillator();
        const gongGain = ctx.createGain();
        gong.type = 'sine';
        gong.frequency.setValueAtTime(65, t);
        gong.frequency.exponentialRampToValueAtTime(55, t + 0.8);
        gongGain.gain.setValueAtTime(0.3, t);
        gongGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        gong.connect(gongGain);
        connectToOutput(gongGain);
        gong.start(t);
        gong.stop(t + 0.82);

        // Gong overtone for richness
        const gongOvertone = ctx.createOscillator();
        const gongOvertoneGain = ctx.createGain();
        gongOvertone.type = 'sine';
        gongOvertone.frequency.setValueAtTime(130, t);
        gongOvertone.frequency.exponentialRampToValueAtTime(110, t + 0.6);
        gongOvertoneGain.gain.setValueAtTime(0.1, t);
        gongOvertoneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        gongOvertone.connect(gongOvertoneGain);
        connectToOutput(gongOvertoneGain);
        gongOvertone.start(t);
        gongOvertone.stop(t + 0.62);
    }
};

// ---------------------------------------------------------------------------
// 10. TIMER WARNING -- Urgent metronome tick
// Square wave at 800Hz, 30ms, gain 0.2
// Clean and urgent, plays once per second when timer < 5s
// ---------------------------------------------------------------------------
export const playTimerWarning = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Primary tick -- square wave at 800Hz, 30ms
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tick.type = 'square';
    tick.frequency.setValueAtTime(800, t);
    tick.frequency.exponentialRampToValueAtTime(600, t + 0.03);
    tickGain.gain.setValueAtTime(0.2, t);
    tickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
    tick.connect(tickGain);
    connectToOutput(tickGain);
    tick.start(t);
    tick.stop(t + 0.035);

    // Subtle click accent for definition
    const accent = ctx.createOscillator();
    const accentGain = ctx.createGain();
    accent.type = 'sine';
    accent.frequency.setValueAtTime(1600, t);
    accent.frequency.exponentialRampToValueAtTime(1000, t + 0.015);
    accentGain.gain.setValueAtTime(0.06, t);
    accentGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    accent.connect(accentGain);
    connectToOutput(accentGain);
    accent.start(t);
    accent.stop(t + 0.02);
};
