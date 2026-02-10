import { IBalancer, BalancerContext, BalancerMetrics, BalancerDecision } from './balancer';
import { cubicResample, linearResample, nearestNeighborResample, ResamplerFn } from './resampler';

type ResamplerLevel = 0 | 1 | 2;
// 0 = nearest, 1 = linear, 2 = cubic

export class AdaptiveLoadBalancer implements IBalancer {
  private active = false;

  private sampleRate = 48000;
  private blockDuration = 0;

  private processStart = 0;
  private loadEMA = 0;
  private previousBufferFill = 0;
  private bufferDeltaEMA = 0;

  private framesSinceChange = 0;

  private resamplerLevel: ResamplerLevel = 2; // start at cubic
  private minVoices = 64;
  private defaultVoices = 256;
  private maxVoices = this.defaultVoices;
  private hardMaxVoices = 4096;

  // ---- Tunable constants ----
  private readonly CRITICAL_FILL = 0.25;
  private readonly WARNING_FILL = 0.4;
  private readonly OVERFILL = 0.6;

  private readonly COOLDOWN_FRAMES = 30;
  private readonly WARNING_COOLDOWN_FRAMES = 5;
  private readonly CRITICAL_COOLDOWN_FRAMES = 2;

  private readonly EMA_ALPHA = 0.1;
  private readonly CRITICAL_FRAMES = 5;
  private readonly WARNING_FRAMES = 10;
  private criticalFrames = 0;
  private warningFrames = 0;
  private readonly BUFFER_EMA_ALPHA = 0.2;

  init(ctx: BalancerContext): void {
    this.sampleRate = ctx.sampleRate;
    this.blockDuration = 128 / this.sampleRate;
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  beginProcess(): void {
    if (!this.active) return;
    this.processStart = performance.now();
  }

  endProcess(metrics: BalancerMetrics): BalancerDecision | null {
    if (!this.active) return null;

    const now = performance.now();
    const renderTime = (now - this.processStart) / 1000;
    const load = renderTime / this.blockDuration;

    // EMA smoothing
    this.loadEMA = this.loadEMA * (1 - this.EMA_ALPHA) + load * this.EMA_ALPHA;

    this.framesSinceChange++;

    const decision = this.evaluate(metrics);
    return decision;
  }

  private evaluate(metrics: BalancerMetrics): BalancerDecision | null {
    const bufferFill = metrics.bufferFill;

    const bufferDelta = bufferFill - this.previousBufferFill;
    this.previousBufferFill = bufferFill;

    this.bufferDeltaEMA =
      this.bufferDeltaEMA * (1 - this.BUFFER_EMA_ALPHA) + bufferDelta * this.BUFFER_EMA_ALPHA;

    const isDraining = this.bufferDeltaEMA < -0.005;
    const isCollapsing = this.bufferDeltaEMA < -0.02;

    const isHighLoad = this.loadEMA > 1.05;

    // ---- 1. Critical zone ----
    if (bufferFill < this.CRITICAL_FILL || isCollapsing) {
      this.criticalFrames++;

      console.log(
        '🔴 Critical buffer fill:',
        bufferFill.toFixed(2),
        'Δ:',
        this.bufferDeltaEMA.toFixed(3),
        'Load EMA:',
        this.loadEMA.toFixed(2),
        'Max voices:',
        metrics.maxVoices,
        'Resampler:',
        this.resamplerLevel,
      );

      if (this.criticalFrames >= this.CRITICAL_FRAMES) {
        if (this.framesSinceChange >= this.CRITICAL_COOLDOWN_FRAMES) {
          return this.emergencyDrop(metrics);
        }
        return null;
      }
      return null;
    } else {
      this.criticalFrames = 0;
    }

    // ---- 2. Warning zone ----
    if (bufferFill < this.WARNING_FILL && (isDraining || isHighLoad)) {
      this.warningFrames++;

      console.log(
        '🟡 Warning buffer fill:',
        bufferFill.toFixed(2),
        'Δ:',
        this.bufferDeltaEMA.toFixed(3),
        'Load EMA:',
        this.loadEMA.toFixed(2),
        'Max voices:',
        metrics.maxVoices,
        'Resampler:',
        this.resamplerLevel,
      );

      if (this.warningFrames >= this.WARNING_FRAMES) {
        if (this.framesSinceChange >= this.WARNING_COOLDOWN_FRAMES) {
          return this.degrade(metrics);
        }
        return null;
      }
      return null;
    } else {
      this.warningFrames = 0;
    }

    // ---- 3. Overfill zone (slow recovery) ----
    if (bufferFill > this.OVERFILL && this.loadEMA < 1.2) {
      console.log(
        '🟢 Overfill buffer fill:',
        bufferFill.toFixed(2),
        'Δ:',
        this.bufferDeltaEMA.toFixed(3),
        'Load EMA:',
        this.loadEMA.toFixed(2),
        'Max voices:',
        metrics.maxVoices,
        'Resampler:',
        this.resamplerLevel,
      );
      if (this.framesSinceChange >= this.COOLDOWN_FRAMES) {
        return this.upgrade(metrics);
      }
      return null;
    }

    console.log(
      '⚪ Regular buffer fill:',
      bufferFill.toFixed(2),
      'Δ:',
      this.bufferDeltaEMA.toFixed(3),
      'Load EMA:',
      this.loadEMA.toFixed(2),
      'Max voices:',
      metrics.maxVoices,
      'Resampler:',
      this.resamplerLevel,
    );
    return null;
  }

  // --------------------------------------------------
  // Decision helpers
  // --------------------------------------------------

  private emergencyDrop(metrics: BalancerMetrics): BalancerDecision {
    this.framesSinceChange = 0;

    const newMaxVoices = Math.max(this.minVoices, Math.floor(metrics.maxVoices * 0.7));

    this.maxVoices = newMaxVoices;
    this.resamplerLevel = 0;

    return {
      maxVoices: newMaxVoices,
      resampler: nearestNeighborResample,
      killVoicesRatio: 0.2,
    };
  }

  private degrade(metrics: BalancerMetrics): BalancerDecision | null {
    this.framesSinceChange = 0;

    // First lower resampler
    if (this.resamplerLevel > 0) {
      this.resamplerLevel--;
      return {
        resampler: this.getResampler(),
      };
    }

    // Then reduce voices slightly
    const newMaxVoices = Math.max(this.minVoices, Math.floor(metrics.maxVoices * 0.9));

    if (newMaxVoices !== metrics.maxVoices) {
      this.maxVoices = newMaxVoices;
      return {
        maxVoices: newMaxVoices,
      };
    }

    return null;
  }

  private upgrade(metrics: BalancerMetrics): BalancerDecision | null {
    this.framesSinceChange = 0;

    // First increase voices
    const utilization = metrics.activeVoices / metrics.maxVoices;

    // Only increase voices if we're actually using them
    if (utilization > 0.85) {
      const newMaxVoices = Math.min(this.hardMaxVoices, Math.floor(metrics.maxVoices * 1.1));

      if (newMaxVoices !== metrics.maxVoices) {
        this.maxVoices = newMaxVoices;
        return { maxVoices: newMaxVoices };
      }
    }

    // Then upgrade resampler
    if (this.resamplerLevel < 2) {
      this.resamplerLevel++;
      return {
        resampler: this.getResampler(),
      };
    }

    return null;
  }

  private getResampler(): ResamplerFn {
    switch (this.resamplerLevel) {
      case 0:
        return nearestNeighborResample;
      case 1:
        return linearResample;
      default:
        return cubicResample;
    }
  }
}
