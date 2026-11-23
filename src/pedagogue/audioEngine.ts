export type SoundPreset = 'grand' | 'rhodes' | 'wurlitzer' | 'pad';
export type MetronomeFeel = '4_straight' | '2_4' | '4_swing' | '3_4' | '12_8';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private metroTimer: number | null = null;
  private metroRunning = false;
  private stepIdx = 0;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public resume(): void {
    this.ensureCtx();
  }

  public playNote(
    midi: number,
    delaySec = 0,
    durationSec = 1.6,
    preset: SoundPreset = 'grand',
    velocity = 0.8,
  ): void {
    const ac = this.ensureCtx();
    const now = ac.currentTime + Math.max(0, delaySec);
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const vel = Math.max(0.15, Math.min(1, velocity));

    const master = ac.createGain();
    master.connect(ac.destination);

    if (preset === 'grand') {
      const o1 = ac.createOscillator();
      const o2 = ac.createOscillator();
      const o3 = ac.createOscillator();
      const filter = ac.createBiquadFilter();

      o1.type = 'triangle';
      o2.type = 'sine';
      o3.type = 'sawtooth';
      o1.frequency.setValueAtTime(freq, now);
      o2.frequency.setValueAtTime(freq * 2, now);
      o3.frequency.setValueAtTime(freq * 3, now);

      const g1 = ac.createGain();
      const g2 = ac.createGain();
      const g3 = ac.createGain();
      g1.gain.setValueAtTime(0.55, now);
      g2.gain.setValueAtTime(0.22, now);
      g3.gain.setValueAtTime(0.06, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(5500, freq * (4 + vel * 4)), now);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(500, freq * 1.8),
        now + Math.min(durationSec, 1.2),
      );

      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(0.2 * vel, now + 0.012);
      master.gain.exponentialRampToValueAtTime(
        0.04 * vel,
        now + Math.min(0.45, durationSec * 0.45),
      );
      master.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

      o1.connect(g1).connect(filter);
      o2.connect(g2).connect(filter);
      o3.connect(g3).connect(filter);
      filter.connect(master);

      o1.start(now);
      o2.start(now);
      o3.start(now);
      o1.stop(now + durationSec + 0.05);
      o2.stop(now + durationSec + 0.05);
      o3.stop(now + durationSec + 0.05);
      return;
    }

    if (preset === 'rhodes') {
      const body = ac.createOscillator();
      const tine = ac.createOscillator();
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      const tineGain = ac.createGain();

      body.type = 'sine';
      body.frequency.setValueAtTime(freq, now);

      tine.type = 'sine';
      tine.frequency.setValueAtTime(freq * 4, now);

      tineGain.gain.setValueAtTime(0.14 * vel, now);
      tineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      // Subtle Rhodes stereo/amp tremolo
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(4.2, now);
      lfoGain.gain.setValueAtTime(0.04, now);
      lfo.connect(lfoGain).connect(master.gain);

      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(0.22 * vel, now + 0.014);
      master.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      body.connect(master);
      tine.connect(tineGain).connect(master);

      body.start(now);
      tine.start(now);
      lfo.start(now);
      body.stop(now + durationSec + 0.05);
      tine.stop(now + durationSec + 0.05);
      lfo.stop(now + durationSec + 0.05);
      return;
    }

    if (preset === 'wurlitzer') {
      const body = ac.createOscillator();
      const reed = ac.createOscillator();
      const filter = ac.createBiquadFilter();
      const reedGain = ac.createGain();

      body.type = 'triangle';
      body.frequency.setValueAtTime(freq, now);
      reed.type = 'square';
      reed.frequency.setValueAtTime(freq * 2, now);
      reedGain.gain.setValueAtTime(0.1 * vel, now);
      reedGain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.min(3200, freq * 2.5), now);
      filter.Q.setValueAtTime(0.9, now);

      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(0.22 * vel, now + 0.01);
      master.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      body.connect(master);
      reed.connect(reedGain).connect(filter).connect(master);

      body.start(now);
      reed.start(now);
      body.stop(now + durationSec + 0.05);
      reed.stop(now + durationSec + 0.05);
      return;
    }

    // Soft Pad
    const p1 = ac.createOscillator();
    const p2 = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    p1.type = 'sawtooth';
    p2.type = 'triangle';
    p1.frequency.setValueAtTime(freq, now);
    p2.frequency.setValueAtTime(freq * 1.004, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);

    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.14 * vel, now + 0.18);
    master.gain.setValueAtTime(0.12 * vel, now + Math.max(0.2, durationSec - 0.35));
    master.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.25);

    p1.connect(filter);
    p2.connect(filter);
    filter.connect(master);
    p1.start(now);
    p2.start(now);
    p1.stop(now + durationSec + 0.3);
    p2.stop(now + durationSec + 0.3);
  }

  public playClick(accent: 'high' | 'mid' | 'soft', delaySec = 0): void {
    const ac = this.ensureCtx();
    const now = ac.currentTime + Math.max(0, delaySec);
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    const freq = accent === 'high' ? 1320 : accent === 'mid' ? 920 : 620;
    const peak = accent === 'high' ? 0.17 : accent === 'mid' ? 0.11 : 0.06;

    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);

    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public startMetronome(
    bpm: number,
    feel: MetronomeFeel,
    onBeat?: (beatIndex: number) => void,
  ): void {
    this.stopMetronome();
    this.ensureCtx();
    this.metroRunning = true;
    this.stepIdx = 0;

    const quarterMs = 60000 / Math.max(35, Math.min(220, bpm));

    const scheduleNext = () => {
      if (!this.metroRunning) return;
      const idx = this.stepIdx++;
      let delayMs = quarterMs;

      if (feel === '4_straight') {
        const beat = idx % 4;
        this.playClick(beat === 0 ? 'high' : 'mid');
        onBeat?.(beat);
      } else if (feel === '2_4') {
        const beat = idx % 4;
        // Backbeat practice: strong click on 2 & 4, very soft pulse on 1 & 3
        this.playClick(beat === 1 || beat === 3 ? 'high' : 'soft');
        onBeat?.(beat);
      } else if (feel === '4_swing') {
        // Long-short eighth pair inside each beat (2:1 triplet ratio)
        const sub = idx % 8;
        const isDownbeat = sub % 2 === 0;
        if (sub === 0) this.playClick('high');
        else if (isDownbeat) this.playClick('mid');
        else this.playClick('soft');
        onBeat?.(Math.floor(sub / 2));
        delayMs = isDownbeat ? quarterMs * (2 / 3) : quarterMs * (1 / 3);
      } else if (feel === '3_4') {
        const beat = idx % 3;
        this.playClick(beat === 0 ? 'high' : 'mid');
        onBeat?.(beat);
      } else {
        // 12/8 ballad: 4 main beats, 3 eighth subdivisions per beat
        const sub = idx % 12;
        if (sub === 0) this.playClick('high');
        else if (sub % 3 === 0) this.playClick('mid');
        else this.playClick('soft');
        onBeat?.(Math.floor(sub / 3));
        delayMs = quarterMs / 3;
      }

      this.metroTimer = window.setTimeout(scheduleNext, delayMs);
    };

    scheduleNext();
  }

  public stopMetronome(): void {
    this.metroRunning = false;
    if (this.metroTimer !== null) {
      clearTimeout(this.metroTimer);
      this.metroTimer = null;
    }
  }
}

export const audioEngine = new AudioEngine();
