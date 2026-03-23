// Web Audio API Sound Generator
// Generates synthetic SFX to avoid asset dependencies

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

// --- Ludo Specific Sounds ---

// Per-cell hop sound -- wooden piece tapping on a board
// Each call produces a slightly different pitch for natural, organic feel
export const playHopSound = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Random pitch variation: base 1800-2400Hz with +/- 100Hz jitter
    const baseFreq = 1800 + Math.random() * 600;
    const pitchJitter = (Math.random() - 0.5) * 200; // +/- 100Hz
    const freq = baseFreq + pitchJitter;

    // Duration: 25-35ms for a crisp wooden tap
    const dur = 0.025 + Math.random() * 0.01;

    // Primary tap -- triangle wave for that woody, rounded character
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + dur);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + dur);

    // Subtle low-frequency body -- sine at 400-500Hz for board resonance
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.frequency.setValueAtTime(400 + Math.random() * 100, t);
    body.type = 'sine';
    bodyGain.gain.setValueAtTime(0.08, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    body.connect(bodyGain);
    connectToOutput(bodyGain);
    body.start(t);
    body.stop(t + 0.015);
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

// --- Enhanced Ludo Sounds ---

// Realistic dice roll -- shake phase, land thud, settle rattle
export const playDiceShakeEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Phase 1: Shake (0-400ms) -- 12 rapid bandpass-filtered noise bursts
    // Simulates dice clattering inside a cupped hand
    const rattleCount = 12;
    let cursor = 0;
    for (let i = 0; i < rattleCount; i++) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'bandpass';
        // Each click at a random frequency in 3000-6000Hz range for bright rattling
        filter.frequency.value = 3000 + Math.random() * 3000;
        filter.Q.value = 4 + Math.random() * 6;

        // Random timing gaps (15-35ms apart) for organic feel
        const gap = 0.015 + Math.random() * 0.02;
        cursor += gap;
        const start = t + cursor;
        const dur = 0.018 + Math.random() * 0.004; // ~20ms per click

        // Volume builds slightly then decays for natural envelope
        const vol = 0.06 + Math.random() * 0.06;
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + dur);

        src.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        src.start(start);
        src.stop(start + dur);
    }

    // Phase 2: Land thud (at 400ms) -- deep low-frequency thump
    // Sine wave at 120-180Hz range for the bass body of the landing
    const thudFreq = 120 + Math.random() * 60;
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(thudFreq, t + 0.4);
    thud.frequency.exponentialRampToValueAtTime(thudFreq * 0.4, t + 0.5);
    thudGain.gain.setValueAtTime(0.18, t + 0.4);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    thud.connect(thudGain);
    connectToOutput(thudGain);
    thud.start(t + 0.4);
    thud.stop(t + 0.5);

    // Mid-frequency impact layer at 400Hz for surface attack character
    const midImpact = ctx.createOscillator();
    const midGain = ctx.createGain();
    midImpact.type = 'triangle';
    midImpact.frequency.setValueAtTime(400, t + 0.4);
    midImpact.frequency.exponentialRampToValueAtTime(180, t + 0.45);
    midGain.gain.setValueAtTime(0.1, t + 0.4);
    midGain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
    midImpact.connect(midGain);
    connectToOutput(midGain);
    midImpact.start(t + 0.4);
    midImpact.stop(t + 0.45);

    // Phase 3: Settle rattle (400-600ms) -- 3 quiet secondary clicks as die settles
    const settleGains = [0.15, 0.08, 0.04];
    const settleTimes = [0.46, 0.52, 0.57];
    settleTimes.forEach((offset, i) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3500 + Math.random() * 2000;
        filter.Q.value = 5;
        gain.gain.setValueAtTime(settleGains[i], t + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.015);
        src.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        src.start(t + offset);
        src.stop(t + offset + 0.02);
    });
};

// Rolling a 6 -- ascending golden chime with emphasis
export const playSixRolled = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Bright ascending arpeggio: C E G C (major triad + octave)
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.05;

        osc.frequency.value = freq;
        osc.type = 'triangle';

        // Crescendo on the arpeggio
        const vol = 0.06 + (i / freqs.length) * 0.04;
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.4);
    });

    // Sparkle shimmer at the top
    const sparkle = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkle.frequency.value = 2093;
    sparkle.type = 'sine';
    sparkleGain.gain.setValueAtTime(0.035, t + 0.18);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    sparkle.connect(sparkleGain);
    connectToOutput(sparkleGain);
    sparkle.start(t + 0.18);
    sparkle.stop(t + 0.6);

    // Second sparkle octave for richness
    const sp2 = ctx.createOscillator();
    const sp2Gain = ctx.createGain();
    sp2.frequency.value = 3136; // G7
    sp2.type = 'sine';
    sp2Gain.gain.setValueAtTime(0.015, t + 0.22);
    sp2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    sp2.connect(sp2Gain);
    connectToOutput(sp2Gain);
    sp2.start(t + 0.22);
    sp2.stop(t + 0.55);
};

// DRAMATIC capture sound -- 4-layer physical impact: thud, shatter, ring, debris
export const playCaptureEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // 1. Impact (0ms): Deep thud at 100-150Hz -- the collision itself
    const impactFreq = 100 + Math.random() * 50;
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.frequency.setValueAtTime(impactFreq, t);
    impact.frequency.exponentialRampToValueAtTime(impactFreq * 0.3, t + 0.15);
    impact.type = 'sine';
    impactGain.gain.setValueAtTime(0.5, t);
    impactGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    impact.connect(impactGain);
    connectToOutput(impactGain);
    impact.start(t);
    impact.stop(t + 0.15);

    // 2. Shatter (10ms): Burst of high-frequency noise -- piece breaking apart feel
    const shatter = ctx.createBufferSource();
    shatter.buffer = buf;
    const shatterGain = ctx.createGain();
    const shatterFilter = ctx.createBiquadFilter();
    shatterFilter.type = 'bandpass';
    shatterFilter.frequency.value = 4500; // Center of 3000-6000Hz band
    shatterFilter.Q.value = 0.8; // Wide Q covers 3000-6000Hz
    shatterGain.gain.setValueAtTime(0.3, t + 0.01);
    shatterGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
    shatter.connect(shatterFilter);
    shatterFilter.connect(shatterGain);
    connectToOutput(shatterGain);
    shatter.start(t + 0.01);
    shatter.stop(t + 0.09);

    // 3. Ring out (30ms): Mid-frequency resonance -- aftermath ringing
    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.frequency.setValueAtTime(800, t + 0.03);
    ring.type = 'triangle';
    ringGain.gain.setValueAtTime(0.15, t + 0.03);
    ringGain.gain.exponentialRampToValueAtTime(0.01, t + 0.23);
    ring.connect(ringGain);
    connectToOutput(ringGain);
    ring.start(t + 0.03);
    ring.stop(t + 0.23);

    // 4. Debris (50-150ms): 5 tiny scattered clicks at random high frequencies
    const debrisCount = 5;
    const debrisGains = [0.12, 0.09, 0.06, 0.04, 0.02];
    for (let i = 0; i < debrisCount; i++) {
        const debrisOsc = ctx.createOscillator();
        const dGain = ctx.createGain();
        const debrisFreq = 4000 + Math.random() * 4000; // 4000-8000Hz
        const debrisStart = t + 0.05 + Math.random() * 0.1; // Scattered over 50-150ms
        debrisOsc.frequency.setValueAtTime(debrisFreq, debrisStart);
        debrisOsc.frequency.exponentialRampToValueAtTime(debrisFreq * 0.5, debrisStart + 0.01);
        debrisOsc.type = 'square';
        dGain.gain.setValueAtTime(debrisGains[i], debrisStart);
        dGain.gain.exponentialRampToValueAtTime(0.001, debrisStart + 0.01);
        debrisOsc.connect(dGain);
        connectToOutput(dGain);
        debrisOsc.start(debrisStart);
        debrisOsc.stop(debrisStart + 0.012);
    }
};

// Triumphant home entry -- ascending arpeggio C5 E5 G5 C6 with reverb + shimmer
export const playHomeEntryEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    // Notes: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1047Hz)
    const notes = [523, 659, 784, 1047];
    const noteDur = 0.06;
    const stagger = 0.05;

    notes.forEach((freq, i) => {
        const start = t + i * stagger;

        // Primary tone -- sine wave for clear, bell-like quality
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + noteDur + 0.1);

        // Slight reverb via delay node at 30ms, feedback gain 0.2
        const delay = ctx.createDelay();
        delay.delayTime.value = 0.03;
        const delayGain = ctx.createGain();
        delayGain.gain.value = 0.2;

        osc.connect(gain);
        // Dry signal
        connectToOutput(gain);
        // Wet (reverb) signal
        gain.connect(delay);
        delay.connect(delayGain);
        connectToOutput(delayGain);

        osc.start(start);
        osc.stop(start + noteDur + 0.15);
    });

    // Shimmer layer: filtered white noise at 6000-10000Hz for sparkle
    const shimmerSrc = ctx.createBufferSource();
    shimmerSrc.buffer = buf;
    const shimmerGain = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.value = 8000; // Center of 6000-10000Hz
    shimmerFilter.Q.value = 0.5; // Wide band to cover range
    shimmerGain.gain.setValueAtTime(0.05, t);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    shimmerSrc.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    connectToOutput(shimmerGain);
    shimmerSrc.start(t);
    shimmerSrc.stop(t + 0.4);
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

export const playNearMiss = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Quick descending "whew" sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.15);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.18);

    // Relief sigh
    const sigh = ctx.createOscillator();
    const sighGain = ctx.createGain();
    sigh.frequency.setValueAtTime(600, t + 0.12);
    sigh.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    sigh.type = 'sine';
    sighGain.gain.setValueAtTime(0.03, t + 0.12);
    sighGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    sigh.connect(sighGain);
    connectToOutput(sighGain);
    sigh.start(t + 0.12);
    sigh.stop(t + 0.3);
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

// Turn change swoosh -- subtle "whoosh" when turns change
// Bandpass-filtered noise sweeping from 200Hz to 2000Hz over 200ms
export const playTurnChangeSwoosh = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ensureNoise();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Bandpass filter that sweeps from low to high
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.2);
    filter.Q.value = 1.5;

    // Gain envelope: fade in to 0.1 over 50ms, sustain, fade out over 100ms
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
    gain.gain.setValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    src.connect(filter);
    filter.connect(gain);
    connectToOutput(gain);
    src.start(t);
    src.stop(t + 0.22);
};
