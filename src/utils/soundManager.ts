import * as sounds from './sound';

interface SoundSettings {
  enabled: boolean;
  volume: number;
  musicEnabled: boolean;
  musicVolume: number;
}

class SoundManager {
  private settings: SoundSettings;
  private audioContext: AudioContext | null = null;

  constructor() {
    const saved = localStorage.getItem('soundSettings');
    this.settings = saved ? JSON.parse(saved) : {
      enabled: true,
      volume: 0.7,
      musicEnabled: false,
      musicVolume: 0.3,
    };
  }

  private play(soundFn: () => void, volumeMultiplier: number = 1) {
    if (!this.settings.enabled) return;

    try {
      soundFn();
    } catch (error) {
      console.error('Sound playback error:', error);
    }
  }

  // General sounds
  click() {
    this.play(sounds.playClick);
  }

  bet() {
    this.play(sounds.playBet);
  }

  win() {
    this.play(sounds.playWin);
  }

  loss() {
    this.play(sounds.playLoss);
  }

  // Game-specific sounds
  diceShake() {
    this.play(sounds.playDiceShake);
  }

  cardFlip() {
    this.play(sounds.playCardFlip);
  }

  wheelTick() {
    this.play(sounds.playWheelTick);
  }

  explosion() {
    this.play(sounds.playExplosion);
  }

  spinTick() {
    this.play(sounds.playSpinTick);
  }

  // Mines game sounds
  mineReveal() {
    this.play(sounds.playClick);
  }

  mineExplode() {
    this.play(sounds.playExplosion);
  }

  // Crash game sounds
  crashTick() {
    this.play(() => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = 440 + Math.random() * 200;
      osc.type = 'sine';

      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    });
  }

  crashExplode() {
    this.play(sounds.playExplosion);
  }

  // Plinko sounds
  plinkoDropStart() {
    this.play(sounds.playClick);
  }

  plinkoBounce() {
    this.play(() => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = 600 + Math.random() * 400;
      osc.type = 'triangle';

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    });
  }

  plinkoLand() {
    this.play(sounds.playBet);
  }

  // Limbo sounds
  limboRise() {
    this.play(() => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
      osc.type = 'sawtooth';

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    });
  }

  // Settings
  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  setVolume(volume: number) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  setMusicEnabled(enabled: boolean) {
    this.settings.musicEnabled = enabled;
    this.saveSettings();
  }

  setMusicVolume(volume: number) {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  private saveSettings() {
    localStorage.setItem('soundSettings', JSON.stringify(this.settings));
  }
}

export const soundManager = new SoundManager();
export default soundManager;
