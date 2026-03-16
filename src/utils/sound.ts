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

export const playUrgencyTick = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);

    gain.gain.setValueAtTime(0.045, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
};

// --- Enhanced Ludo Sounds ---

export const playDiceShakeEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    if (!noiseBuffer) noiseBuffer = createNoiseBuffer();

    // Multiple staggered rattles with pitch variation
    for (let i = 0; i < 8; i++) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 600 + Math.random() * 800;
        filter.Q.value = 2 + Math.random() * 3;

        const start = t + (i * 0.045);
        const vol = 0.06 + (i / 8) * 0.06; // crescendo

        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.04);

        src.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        src.start(start);
        src.stop(start + 0.04);
    }

    // Add a subtle wooden thunk at the end
    const thunk = ctx.createOscillator();
    const thunkGain = ctx.createGain();
    thunk.type = 'sine';
    thunk.frequency.setValueAtTime(180, t + 0.38);
    thunk.frequency.exponentialRampToValueAtTime(80, t + 0.44);
    thunkGain.gain.setValueAtTime(0.08, t + 0.38);
    thunkGain.gain.exponentialRampToValueAtTime(0.01, t + 0.44);
    thunk.connect(thunkGain);
    connectToOutput(thunkGain);
    thunk.start(t + 0.38);
    thunk.stop(t + 0.44);
};

export const playSixRolled = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Triumphant rising chord
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.04;

        osc.frequency.value = freq;
        osc.type = 'triangle';

        gain.gain.setValueAtTime(0.07, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.35);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.35);
    });

    // Sparkle high note
    const sparkle = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkle.frequency.value = 2093;
    sparkle.type = 'sine';
    sparkleGain.gain.setValueAtTime(0.03, t + 0.12);
    sparkleGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    sparkle.connect(sparkleGain);
    connectToOutput(sparkleGain);
    sparkle.start(t + 0.12);
    sparkle.stop(t + 0.5);
};

export const playCaptureEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    if (!noiseBuffer) noiseBuffer = createNoiseBuffer();

    // 1. Dramatic whoosh sweep
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.frequency.setValueAtTime(1600, t);
    sweep.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    sweep.type = 'sawtooth';
    sweepGain.gain.setValueAtTime(0.12, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    sweep.connect(sweepGain);
    connectToOutput(sweepGain);
    sweep.start(t);
    sweep.stop(t + 0.25);

    // 2. Heavy impact thump
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.frequency.setValueAtTime(80, t + 0.2);
    impact.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    impact.type = 'sine';
    impactGain.gain.setValueAtTime(0.2, t + 0.2);
    impactGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    impact.connect(impactGain);
    connectToOutput(impactGain);
    impact.start(t + 0.2);
    impact.stop(t + 0.5);

    // 3. Explosion noise burst
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, t + 0.18);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    noiseGain.gain.setValueAtTime(0.15, t + 0.18);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain);
    noiseSrc.start(t + 0.18);
    noiseSrc.stop(t + 0.6);

    // 4. Sub-bass rumble
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.frequency.value = 40;
    rumble.type = 'sine';
    rumbleGain.gain.setValueAtTime(0.08, t + 0.22);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
    rumble.connect(rumbleGain);
    connectToOutput(rumbleGain);
    rumble.start(t + 0.22);
    rumble.stop(t + 0.7);
};

export const playHomeEntryEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Ascending chime crescendo: C5 E5 G5 C6
    const chimes = [523.25, 659.25, 783.99, 1046.50];
    chimes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.08;

        osc.frequency.value = freq;
        osc.type = 'sine';

        const vol = 0.05 + (i / chimes.length) * 0.05; // crescendo
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.7);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.7);
    });

    // Harmonic shimmer layer
    const shimmer = [1046.50, 1318.51, 1567.98];
    shimmer.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + 0.3 + i * 0.06;

        osc.frequency.value = freq;
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.025, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.9);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.9);
    });

    // Soft bell resonance
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.frequency.value = 2093;
    bell.type = 'sine';
    bellGain.gain.setValueAtTime(0.02, t + 0.32);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    bell.connect(bellGain);
    connectToOutput(bellGain);
    bell.start(t + 0.32);
    bell.stop(t + 1.5);
};

export const playStreakSound = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Power-up ascending sweep
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.frequency.setValueAtTime(300, t);
    sweep.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    sweep.type = 'sawtooth';
    sweepGain.gain.setValueAtTime(0.06, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    sweep.connect(sweepGain);
    connectToOutput(sweepGain);
    sweep.start(t);
    sweep.stop(t + 0.35);

    // Punctuation chord
    [880, 1108.73, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + 0.25;
        osc.frequency.value = freq;
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.04, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.4);
    });
};

export const playWinSoundEnhanced = () => {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Grand fanfare: C5 D5 E5 G5 C6 with harmonics
    const melody = [523.25, 587.33, 659.25, 783.99, 1046.50];
    melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.1;

        osc.frequency.value = freq;
        osc.type = 'triangle';

        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.6);

        osc.connect(gain);
        connectToOutput(gain);
        osc.start(start);
        osc.stop(start + 0.6);

        // Add octave shimmer
        const shimmer = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        shimmer.frequency.value = freq * 2;
        shimmer.type = 'sine';
        shimmerGain.gain.setValueAtTime(0.03, start + 0.02);
        shimmerGain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
        shimmer.connect(shimmerGain);
        connectToOutput(shimmerGain);
        shimmer.start(start + 0.02);
        shimmer.stop(start + 0.5);
    });

    // Sustained victory chord after melody
    setTimeout(() => {
        const chordCtx = getCtx();
        const ct = chordCtx.currentTime;
        [1046.50, 1318.51, 1567.98].forEach((freq) => {
            const osc = chordCtx.createOscillator();
            const gain = chordCtx.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.05, ct);
            gain.gain.exponentialRampToValueAtTime(0.01, ct + 1.5);
            osc.connect(gain);
            connectToOutput(gain);
            osc.start(ct);
            osc.stop(ct + 1.5);
        });
    }, 500);

    // Timpani/bass drum feel
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.frequency.setValueAtTime(120, t + 0.5);
    bass.frequency.exponentialRampToValueAtTime(40, t + 0.8);
    bass.type = 'sine';
    bassGain.gain.setValueAtTime(0.12, t + 0.5);
    bassGain.gain.exponentialRampToValueAtTime(0.01, t + 0.9);
    bass.connect(bassGain);
    connectToOutput(bassGain);
    bass.start(t + 0.5);
    bass.stop(t + 0.9);
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

    // Bubbly pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(gain);
    connectToOutput(gain);
    osc.start(t);
    osc.stop(t + 0.1);
};
