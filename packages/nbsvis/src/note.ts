const CENTS_PER_OCTAVE = 1200;

export interface NoteView {
  instrument: number;
  pitch: number;
  volume: number;
  panning: number;
}

type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

type TypedArrayConstructor<T extends TypedArray> = {
  readonly BYTES_PER_ELEMENT: number;
  new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
};

export class NoteBuffer {
  static readonly HEADER_SIZE = Uint32Array.BYTES_PER_ELEMENT * 2; // noteCount + tickCount

  // Each note occupies 40 bytes (non-adjacent) in the array.
  // We store larger types first to eliminate padding
  // (e.g. storing Uint8 first could require padding to align an Int16 later).
  static readonly TICK_OFFSET_TYPE: TypedArrayConstructor<Uint32Array> = Uint32Array;
  static readonly PITCH_TYPE: TypedArrayConstructor<Int16Array> = Int16Array;
  static readonly INSTRUMENT_TYPE: TypedArrayConstructor<Uint8Array> = Uint8Array;
  static readonly VOLUME_TYPE: TypedArrayConstructor<Uint8Array> = Uint8Array;
  static readonly PANNING_TYPE: TypedArrayConstructor<Int8Array> = Int8Array;

  readonly noteCount: number;
  readonly tickCount: number;

  readonly sab: SharedArrayBuffer;

  readonly instrumentIds: InstanceType<typeof NoteBuffer.INSTRUMENT_TYPE>;
  readonly pitch: InstanceType<typeof NoteBuffer.PITCH_TYPE>;
  readonly volume: InstanceType<typeof NoteBuffer.VOLUME_TYPE>;
  readonly panning: InstanceType<typeof NoteBuffer.PANNING_TYPE>;
  readonly tickOffsets: InstanceType<typeof NoteBuffer.TICK_OFFSET_TYPE>;
  private writeCursors: Uint32Array | null = null;

  private static computeLayout(noteCount: number, tickCount: number) {
    let offset = NoteBuffer.HEADER_SIZE;

    const tickOffsetsOffset = offset;
    offset += (tickCount + 1) * NoteBuffer.TICK_OFFSET_TYPE.BYTES_PER_ELEMENT;

    const pitchOffset = offset;
    offset += noteCount * NoteBuffer.PITCH_TYPE.BYTES_PER_ELEMENT;

    const instrumentOffset = offset;
    offset += noteCount * NoteBuffer.INSTRUMENT_TYPE.BYTES_PER_ELEMENT;

    const volumeOffset = offset;
    offset += noteCount * NoteBuffer.VOLUME_TYPE.BYTES_PER_ELEMENT;

    const panningOffset = offset;
    offset += noteCount * NoteBuffer.PANNING_TYPE.BYTES_PER_ELEMENT;

    return {
      tickOffsetsOffset,
      pitchOffset,
      instrumentOffset,
      volumeOffset,
      panningOffset,
      totalBytes: offset,
    };
  }

  constructor(sab: SharedArrayBuffer) {
    this.sab = sab;

    const header = new Uint32Array(sab, 0, 2);

    const noteCount = header[0];
    const tickCount = header[1];

    this.noteCount = noteCount;
    this.tickCount = tickCount;

    const layout = NoteBuffer.computeLayout(noteCount, tickCount);

    this.tickOffsets = new NoteBuffer.TICK_OFFSET_TYPE(
      sab,
      layout.tickOffsetsOffset,
      tickCount + 1,
    );
    this.pitch = new NoteBuffer.PITCH_TYPE(sab, layout.pitchOffset, noteCount);
    this.instrumentIds = new NoteBuffer.INSTRUMENT_TYPE(sab, layout.instrumentOffset, noteCount);
    this.volume = new NoteBuffer.VOLUME_TYPE(sab, layout.volumeOffset, noteCount);
    this.panning = new NoteBuffer.PANNING_TYPE(sab, layout.panningOffset, noteCount);
  }

  static allocate(noteCount: number, tickCount: number) {
    const layout = NoteBuffer.computeLayout(noteCount, tickCount);

    const tickOffsetAlignment = NoteBuffer.TICK_OFFSET_TYPE.BYTES_PER_ELEMENT;
    if (layout.tickOffsetsOffset % tickOffsetAlignment !== 0) {
      throw new RangeError(
        `tickOffsets byte offset ${layout.tickOffsetsOffset} must be a multiple of ${tickOffsetAlignment}`,
      );
    }

    const sab = new SharedArrayBuffer(layout.totalBytes);

    const header = new Uint32Array(sab, 0, 2);
    header[0] = noteCount;
    header[1] = tickCount;

    return new NoteBuffer(sab);
  }

  initializeTickOffsets(noteCountsPerTick: Uint32Array) {
    if (noteCountsPerTick.length !== this.tickCount) {
      throw new RangeError(
        `noteCountsPerTick length ${noteCountsPerTick.length} must equal tickCount ${this.tickCount}`,
      );
    }

    this.tickOffsets[0] = 0;
    for (let tick = 0; tick < this.tickCount; tick++) {
      this.tickOffsets[tick + 1] = this.tickOffsets[tick] + noteCountsPerTick[tick];
    }

    if (this.tickOffsets[this.tickCount] !== this.noteCount) {
      throw new RangeError(
        `tick offset total ${this.tickOffsets[this.tickCount]} does not match noteCount ${this.noteCount}`,
      );
    }

    this.writeCursors = this.tickOffsets.slice(0, this.tickCount);
  }

  writeNote(tick: number, instrument: number, pitch: number, volume: number, panning: number) {
    if (tick < 0 || tick >= this.tickCount) {
      console.log(`tick out of range: ${tick}, expected 0 <= tick < ${this.tickCount}`);
      return;
    }

    if (!this.writeCursors) {
      throw new Error(
        'NoteBuffer write cursors are not initialized. Call initializeTickOffsets() first.',
      );
    }

    const index = this.writeCursors[tick]++;
    if (index >= this.tickOffsets[tick + 1]) {
      throw new RangeError(`too many notes written for tick ${tick}`);
    }

    this.instrumentIds[index] = instrument;
    this.pitch[index] = CENTS_PER_OCTAVE * Math.log2(pitch);
    this.volume[index] = volume * 255; // convert from [0,1] to [0,255]
    this.panning[index] = panning * 127; // convert from [-1,1] to [-127,127]
  }

  getNoteRangeForTick(tick: number) {
    const start = this.tickOffsets[tick];
    const end = this.tickOffsets[tick + 1];
    return [start, end];
  }

  getNote(i: number): NoteView {
    return {
      instrument: this.instrumentIds[i],
      pitch: this.pitch[i],
      volume: this.volume[i],
      panning: this.panning[i],
    };
  }

  forEachNoteAtTick(
    tick: number,
    callbackFn: (instrument: number, pitch: number, volume: number, panning: number) => void,
  ) {
    const start = this.tickOffsets[tick];
    const end = this.tickOffsets[tick + 1];

    for (let i = start; i < end; i++) {
      callbackFn(
        this.instrumentIds[i],
        2 ** (this.pitch[i] / CENTS_PER_OCTAVE),
        this.volume[i] / 255,
        this.panning[i] / 127,
      );
    }
  }
}
