// Web Audio API procedural sound engine for Battleship
// Ultra-reliable, fully customizable, no external asset dependencies.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private isMusicMuted = false;
  private isSfxMuted = false;
  private timer: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public getMusicMuted() {
    return this.isMusicMuted;
  }

  public getSfxMuted() {
    return this.isSfxMuted;
  }

  public toggleMusic(mute?: boolean): boolean {
    this.init();
    this.isMusicMuted = mute !== undefined ? mute : !this.isMusicMuted;
    if (this.ambientGain) {
      this.ambientGain.gain.setValueAtTime(
        this.isMusicMuted ? 0 : 0.12,
        this.ctx ? this.ctx.currentTime : 0,
      );
    }
    return this.isMusicMuted;
  }

  public toggleSfx(mute?: boolean): boolean {
    this.isSfxMuted = mute !== undefined ? mute : !this.isSfxMuted;
    return this.isSfxMuted;
  }

  public startAmbient() {
    this.init();
    if (!this.ctx || this.ambientGain) return;

    // Create ambient tactical hum / ocean wave sound
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to make it sound like deep submarine ocean hum
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(150, this.ctx.currentTime);
    filter.Q.setValueAtTime(3, this.ctx.currentTime);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime); // slow wave
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(50, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(
      this.isMusicMuted ? 0 : 0.12,
      this.ctx.currentTime,
    );

    whiteNoise.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    whiteNoise.start();

    // Occasional sonar background ping
    if (this.timer) clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (!this.isMusicMuted && Math.random() < 0.4) {
        this.playDistantSonar();
      }
    }, 8000);
  }

  private playDistantSonar() {
    if (!this.ctx || this.isMusicMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.5);
    } catch (e) {
      // ignore audio errors
    }
  }

  public playClick() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  public playSonarPing() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
      osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.2);
    } catch (e) {}
  }

  public playLaunch() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {}
  }

  public playMiss() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {}
  }

  public playHit() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.7;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.7);

      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.7);

      noise.connect(filter);
      filter.connect(gain);
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    } catch (e) {}
  }

  public playSunk() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      this.playHit();

      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(90, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 1.2);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.2);

      setTimeout(() => {
        if (!this.ctx || this.isSfxMuted) return;
        const alarm = this.ctx.createOscillator();
        const alarmGain = this.ctx.createGain();
        alarm.type = "square";
        alarm.frequency.setValueAtTime(440, this.ctx.currentTime);
        alarmGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        alarmGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        alarm.connect(alarmGain);
        alarmGain.connect(this.ctx.destination);
        alarm.start();
        alarm.stop(this.ctx.currentTime + 0.3);
      }, 300);
    } catch (e) {}
  }

  public playVictory() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.18);
        gain.gain.setValueAtTime(0.2, this.ctx!.currentTime + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx!.currentTime + idx * 0.18 + 0.6,
        );
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(this.ctx!.currentTime + idx * 0.18);
        osc.stop(this.ctx!.currentTime + idx * 0.18 + 0.6);
      });
    } catch (e) {}
  }

  public playDefeat() {
    if (this.isSfxMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [300, 280, 250, 200];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.3);
        gain.gain.setValueAtTime(0.25, this.ctx!.currentTime + idx * 0.3);
        gain.gain.linearRampToValueAtTime(
          0.001,
          this.ctx!.currentTime + idx * 0.3 + 0.5,
        );
        const filter = this.ctx!.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(500, this.ctx!.currentTime);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(this.ctx!.currentTime + idx * 0.3);
        osc.stop(this.ctx!.currentTime + idx * 0.3 + 0.5);
      });
    } catch (e) {}
  }
}

export const sound = new SoundEngine();
