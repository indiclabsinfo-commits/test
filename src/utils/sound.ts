// Web Audio API Sound Generator
// Generates synthetic SFX to avoid asset dependencies

let audioCtx: AudioContext | null = null;

const getCtx = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
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
        gain.connect(ctx.destination);
        src.start(start);
        src.stop(start + 0.05);
    }
};

export const playCardFlip = () => {
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
    // Soft woodblock click for piece movement
    const ctx = getCtx();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 500;
    osc.type = 'square';

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
};

export const playCapture = () => {
    // Whoosh + impact sound for capturing opponent
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Whoosh (sweep down)
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();

    sweep.frequency.setValueAtTime(1200, t);
    sweep.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    sweep.type = 'sawtooth';

    sweepGain.gain.setValueAtTime(0.12, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
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
    impactGain.connect(ctx.destination);
    impact.start(t + 0.25);
    impact.stop(t + 0.45);
};

export const playHomeEntry = () => {
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
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.6);
    });
};

export const playWinSound = () => {
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

        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
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

            gain.gain.setValueAtTime(0.06, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.8);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.8);
        });
    }, 400);
};

export const playTurnStart = () => {
    const ctx = getCtx();
    const t = ctx.currentTime;

    [740, 988].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.05;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
    });
};

export const playUrgencyTick = () => {
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
