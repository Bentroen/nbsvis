import {
  type AudioPlaybackPayload,
  type NbsvisAudioBackend,
  NoteBuffer,
} from '@opennbs/nbsvis-audio-api';

type TempoSegment = { startTick: number; bpm: number };
type Voice = { gain: GainNode };

export class OscillatorAudioBackend implements NbsvisAudioBackend {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noteBuffer: NoteBuffer | null = null;
  private tempoSegments: TempoSegment[] = [{ startTick: 0, bpm: 120 }];
  private lengthTicks = 0;
  private loopStartTick = 0;
  private _loop = false;

  private rafId: number | null = null;
  private playing = false;
  private ended = false;

  private tickAtPlayStart = 0;
  private perfAtPlayStart = 0;
  private currentTickValue = 0;
  private lastRenderedTick = -1;

  private activeVoices = new Set<Voice>();
  private maxVoices = 0;
  private endedListeners = new Set<() => void>();

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async loadSong(payload: AudioPlaybackPayload): Promise<void> {
    this.ensureContext();
    this.noteBuffer = new NoteBuffer(payload.noteData);
    this.tempoSegments = [...payload.timeline.tempoSegments].sort(
      (a, b) => a.startTick - b.startTick,
    );
    if (!this.tempoSegments.length || this.tempoSegments[0].startTick !== 0) {
      this.tempoSegments.unshift({ startTick: 0, bpm: payload.timeline.initialTempo });
    }
    this.lengthTicks = payload.timeline.lengthTicks;
    this.loopStartTick = payload.loopStartTick;
    this.stop();
    this.seekToTick(0);
  }

  play(): void {
    if (!this.noteBuffer) return;
    const ctx = this.ensureContext();
    if (ctx.state !== 'running') {
      void ctx.resume();
    }
    if (this.ended) {
      this.seekToTick(0);
      this.ended = false;
    }
    this.playing = true;
    this.tickAtPlayStart = this.currentTickValue;
    this.perfAtPlayStart = performance.now();
    this.startLoop();
  }

  pause(): void {
    this.playing = false;
  }

  stop(): void {
    this.playing = false;
    this.seekToTick(0);
    this.ended = false;
  }

  seekToTick(tick: number): void {
    this.currentTickValue = Math.max(0, Math.min(this.lengthTicks, tick));
    this.lastRenderedTick = Math.floor(this.currentTickValue) - 1;
    this.tickAtPlayStart = this.currentTickValue;
    this.perfAtPlayStart = performance.now();
  }

  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
  }

  get currentTick(): number {
    return this.currentTickValue;
  }

  get soundCount(): number {
    return this.activeVoices.size;
  }

  get maxSoundCount(): number {
    return this.maxVoices;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get isEnded(): boolean {
    return this.ended;
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const frame = () => {
      this.rafId = requestAnimationFrame(frame);
      if (!this.playing || !this.noteBuffer) return;

      const elapsedSeconds = (performance.now() - this.perfAtPlayStart) / 1000;
      this.currentTickValue = this.tickAtPlayStart + this.secondsToTicks(elapsedSeconds);

      if (this.currentTickValue >= this.lengthTicks) {
        if (this._loop) {
          this.seekToTick(this.loopStartTick);
          return;
        }
        this.currentTickValue = this.lengthTicks;
        this.playing = false;
        if (!this.ended) {
          this.ended = true;
          for (const listener of this.endedListeners) listener();
        }
      }

      const floorTick = Math.floor(this.currentTickValue);
      for (let t = this.lastRenderedTick + 1; t <= floorTick; t++) {
        if (t < 0 || t >= this.lengthTicks) continue;
        this.triggerTick(t);
      }
      this.lastRenderedTick = floorTick;
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private triggerTick(tick: number): void {
    if (!this.noteBuffer || !this.ctx || !this.master) return;
    const secPerTick = this.secondsForTickDelta(tick, 1);
    this.noteBuffer.forEachNoteAtTick(
      tick,
      (instrument: number, pitch: number, volume: number, panning: number) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const panNode = this.ctx!.createStereoPanner();

        osc.type = this.waveformForInstrument(instrument);
        osc.frequency.value = 440 * pitch;

        const now = this.ctx!.currentTime;
        const attack = 0.1;
        const release = Math.max(0.05, secPerTick * 0.9);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.18), now + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
        panNode.pan.value = panning;

        osc.connect(gain);
        gain.connect(panNode);
        panNode.connect(this.master!);

        const voice: Voice = { gain };
        this.activeVoices.add(voice);
        this.maxVoices = Math.max(this.maxVoices, this.activeVoices.size);
        osc.onended = () => this.activeVoices.delete(voice);

        osc.start(now);
        osc.stop(now + attack + release + 0.02);
      },
    );
  }

  private waveformForInstrument(instrument: number): OscillatorType {
    const waves: OscillatorType[] = ['triangle', 'sine', 'square', 'sawtooth'];
    return waves[instrument % waves.length];
  }

  private secondsToTicks(seconds: number): number {
    if (seconds <= 0) return 0;
    let remaining = seconds;
    let ticks = 0;

    for (let i = 0; i < this.tempoSegments.length; i++) {
      const seg = this.tempoSegments[i];
      const next = this.tempoSegments[i + 1];
      const segTickLength = next ? next.startTick - seg.startTick : Infinity;
      const secPerTick = 60 / (seg.bpm * 4);
      const segSeconds = segTickLength * secPerTick;
      if (remaining <= segSeconds) {
        return ticks + remaining / secPerTick;
      }
      ticks += segTickLength;
      remaining -= segSeconds;
    }
    return ticks;
  }

  private secondsForTickDelta(fromTick: number, tickDelta: number): number {
    let remaining = tickDelta;
    let tick = fromTick;
    let seconds = 0;
    while (remaining > 0) {
      const segIndex = this.findSegmentIndex(tick);
      const seg = this.tempoSegments[segIndex];
      const next = this.tempoSegments[segIndex + 1];
      const untilNext = next ? next.startTick - tick : remaining;
      const consume = Math.min(remaining, Math.max(untilNext, 1));
      const secPerTick = 60 / (seg.bpm * 4);
      seconds += consume * secPerTick;
      tick += consume;
      remaining -= consume;
    }
    return seconds;
  }

  private findSegmentIndex(tick: number): number {
    let idx = 0;
    for (let i = 0; i < this.tempoSegments.length; i++) {
      if (this.tempoSegments[i].startTick <= tick) idx = i;
      else break;
    }
    return idx;
  }
}
