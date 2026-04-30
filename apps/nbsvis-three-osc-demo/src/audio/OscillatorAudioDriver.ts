import { midiToFrequency } from '../three/PianoLayout';

type Voice = {
  osc: OscillatorNode;
  gain: GainNode;
};

export class OscillatorAudioDriver {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<number, Voice>();

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.24;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async init(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state !== 'running') {
      await ctx.resume();
    }
  }

  async noteOn(midi: number): Promise<void> {
    await this.init();
    if (this.voices.has(midi)) return;
    if (!this.ctx || !this.master) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start();

    this.voices.set(midi, { osc, gain });
  }

  noteOff(midi: number): void {
    if (!this.ctx) return;
    const voice = this.voices.get(midi);
    if (!voice) return;

    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    const current = Math.max(voice.gain.gain.value, 0.0001);
    voice.gain.gain.setValueAtTime(current, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    voice.osc.stop(now + 0.08);
    this.voices.delete(midi);
  }

  panic(): void {
    for (const midi of this.voices.keys()) {
      this.noteOff(midi);
    }
  }
}
