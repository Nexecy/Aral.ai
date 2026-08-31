/**
 * Web Audio API synthesizer for lightweight, zero-dependency feedback chimes.
 * Supports both Pomodoro completion chimes and interactive previews.
 */
class SoundService {
  private audioCtx: AudioContext | null = null;
  // Active preview nodes so we can stop them when a new preview starts
  private previewOscillators: OscillatorNode[] = [];
  private previewGains: GainNode[] = [];
  private previewTimeout: ReturnType<typeof setTimeout> | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Immediately silence and discard any active preview oscillators.
   */
  stopPreview() {
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    const ctx = this.audioCtx;
    this.previewGains.forEach((g) => {
      try {
        if (ctx) {
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.setValueAtTime(0, ctx.currentTime);
        }
      } catch (_) {}
    });
    this.previewOscillators.forEach((o) => {
      try { o.stop(); } catch (_) {}
    });
    this.previewOscillators = [];
    this.previewGains = [];
  }

  /**
   * Play a short audible preview of a chime choice.
   * Automatically stops any previously playing preview first.
   * Auto-stops after ~3 seconds.
   */
  previewSound(choice: string) {
    this.stopPreview();
    const ctx = this.getContext();
    if (!ctx) return;

    const trackOscillators: OscillatorNode[] = [];
    const trackGains: GainNode[] = [];

    const addNote = (freq: number, type: OscillatorType, startOffset: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startOffset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration + 0.05);
      trackOscillators.push(osc);
      trackGains.push(gain);
    };

    if (choice === 'bell') {
      addNote(880, 'sine', 0, 1.8, 0.2);
      addNote(1108.73, 'sine', 0.25, 1.4, 0.12);
    } else if (choice === 'digital') {
      addNote(600, 'square', 0, 0.12, 0.08);
      addNote(900, 'square', 0.15, 0.12, 0.08);
      addNote(600, 'square', 0.40, 0.12, 0.08);
      addNote(900, 'square', 0.55, 0.12, 0.08);
    } else if (choice === 'harp') {
      const harpNotes = [440, 554.37, 659.25, 880, 1108.73];
      harpNotes.forEach((freq, idx) => addNote(freq, 'triangle', idx * 0.08, 0.9, 0.12));
    } else {
      // zen
      const zenNotes = [523.25, 659.25, 783.99, 1046.50];
      zenNotes.forEach((freq, idx) => addNote(freq, 'sine', idx * 0.15, 1.2, 0.15));
    }

    this.previewOscillators = trackOscillators;
    this.previewGains = trackGains;

    // Auto-stop cleanup after 3s
    this.previewTimeout = setTimeout(() => {
      this.previewOscillators = [];
      this.previewGains = [];
    }, 3000);
  }

  /**
   * Ambient chime for Pomodoro cycle completion based on sound choice
   */
  playPomodoroChime(choice: string = 'zen') {
    const ctx = this.getContext();
    if (!ctx) return;

    if (choice === 'bell') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.9);
      return;
    }

    if (choice === 'digital') {
      [0, 0.15].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(i === 0 ? 600 : 900, ctx.currentTime + t);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.13);
      });
      return;
    }

    if (choice === 'harp') {
      const harpNotes = [440, 554.37, 659.25, 880, 1108.73];
      harpNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.95);
      });
      return;
    }

    // Default 'zen' Ambient 4-Note Chime
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.15);

      gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + index * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.15 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.15);
      osc.stop(ctx.currentTime + index * 0.15 + 1.3);
    });
  }

  /**
   * Subtle tick / flip sound for flashcards
   */
  playCardFlip() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  /**
   * Happy celebratory chime for high quiz scores
   */
  playSuccessFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const chords = [
      { f: 523.25, t: 0 },
      { f: 659.25, t: 0.1 },
      { f: 783.99, t: 0.2 },
      { f: 1046.50, t: 0.35 }
    ];

    chords.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.65);
    });
  }
}

export const sound = new SoundService();
