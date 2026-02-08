import { BalancerContext, BalancerDecision, BalancerMetrics, IBalancer } from './balancer';
import { cubicResample, linearResample, nearestNeighborResample, ResamplerFn } from './resampler';

const RESAMPLERS: ResamplerFn[] = [
  nearestNeighborResample, // 0 – emergency
  linearResample, // 1 – degraded
  cubicResample, // 2 – full quality
];

export class AdaptiveLoadBalancer implements IBalancer {
  // ==== Configuration ====

  private readonly MIN_VOICES = 64;
  private readonly MAX_VOICES_HARD = 4096;

  private readonly GROW_STEP = 8;
  private readonly FAST_GROW_STEP = 32;
  private readonly SHRINK_STEP = 16;

  private readonly SLOW_GROW_INTERVAL = 240;
  private readonly SHRINK_INTERVAL = 30;

  private readonly TIGHT_VOICE_PRESSURE = 0.85;
  private readonly HIGH_VOICE_PRESSURE = 0.7;

  private readonly CRITICAL_BUFFER_FILL = 0.2;
  private readonly LOW_BUFFER_FILL = 0.35;
  private readonly HEALTHY_BUFFER_FILL = 0.6;

  // ==== Runtime state ====

  private active = true;
  private sampleRate!: number;
  private lastProcessTime = 0;

  // Smoothed CPU pressure (0..∞)
  private emaLoad = 0;
  private peakLoad = 0;

  private qualityLevel = 2; // start at cubic
  private maxVoices = 256;

  private warmupBlocks = 0;
  private lastPolicyChangeFrame = 0;
  private breakerCooldown = 0;
  private breakerStrikes = 0;
  private lastBreakerFrame = 0;
  private lastGrowFrame = 0;
  private lastShrinkFrame = 0;

  init(ctx: BalancerContext): void {
    this.sampleRate = ctx.sampleRate;
  }

  setActive(active: boolean) {
    if (!this.active && active) {
      console.log('AdaptiveLoadBalancer activated');
      this.lastProcessTime = 0;
      this.warmupBlocks = 5; // ignore first ~5 blocks
      this.emaLoad = 1;
      this.peakLoad = 1;
    }

    this.active = active;
  }

  beginProcess(): void {
    if (!this.active) return;
    this.lastProcessTime = performance.now() / 1000;
  }

  endProcess(metrics: BalancerMetrics): BalancerDecision | null {
    if (!this.active) return null;
    const now = performance.now() / 1000;

    if (this.warmupBlocks > 0) {
      console.log('Warmup blocks left:', this.warmupBlocks, ', skipping load measurement');
      this.warmupBlocks--;
      return null;
    }

    if (this.lastProcessTime !== 0) {
      // Expected time between process() calls
      const expected = metrics.blockSize / this.sampleRate;

      // Clamp delta to avoid huge spikes
      const maxDelta = expected * 4;
      const delta = now - this.lastProcessTime;
      const clampedDelta = Math.min(delta, maxDelta);

      // >1 = falling behind, <1 = healthy
      const load = clampedDelta / expected;

      //console.log(
      //  `Block processed in ${clampedDelta.toFixed(4)}s (expected ${expected.toFixed(4)}s), load=${load.toFixed(2)}`,
      //);

      // === Load estimators ===

      // EMA: smooth but reactive
      this.emaLoad = this.emaLoad * 0.9 + load * 0.1;

      // Peak: catch bursts
      this.peakLoad = Math.max(this.peakLoad * 0.8, load);

      console.log(
        'Load:',
        load.toFixed(2),
        'EMA Load:',
        this.emaLoad.toFixed(2),
        'Peak Load:',
        this.peakLoad.toFixed(2),
      );
    }

    if (this.breakerCooldown > 0) {
      this.breakerCooldown--;
    }

    // === Decide policy ===
    const decision = this.evaluatePolicy(metrics);

    this.lastProcessTime = now;

    return decision;
  }

  private evaluatePolicy(metrics: BalancerMetrics): BalancerDecision | null {
    const decision: BalancerDecision = {};
    const { frame, activeVoices, maxVoices, bufferFill } = metrics;
    const voicePressure = maxVoices > 0 ? activeVoices / maxVoices : 0;
    const cpuRoom = this.emaLoad < 0.85;
    const bufferHealthy = bufferFill >= this.HEALTHY_BUFFER_FILL;
    const bufferTight = bufferFill <= this.LOW_BUFFER_FILL;

    // --------------------------------------------------
    // 🔴 Circuit breaker – emergency protection
    // --------------------------------------------------
    if (
      this.breakerCooldown === 0 &&
      this.peakLoad > 1.2 &&
      bufferFill < this.CRITICAL_BUFFER_FILL
    ) {
      if (frame - this.lastBreakerFrame > 240) {
        this.breakerStrikes = 0;
      }
      this.breakerStrikes = Math.min(this.breakerStrikes + 1, 4);

      const killRatio = Math.min(0.5, 0.2 + this.breakerStrikes * 0.1);
      decision.killVoicesRatio = killRatio;
      this.downgradeQuality(decision);

      const reducedMax = Math.max(this.MIN_VOICES, Math.floor(this.maxVoices * 0.8));
      if (reducedMax < this.maxVoices) {
        this.maxVoices = reducedMax;
        decision.maxVoices = this.maxVoices;
      }

      this.lastPolicyChangeFrame = frame;
      this.breakerCooldown = 60 + this.breakerStrikes * 30;
      this.lastBreakerFrame = frame;
      this.peakLoad = 1; // reset peak
      return decision;
    }

    if (this.breakerCooldown > 0) {
      return null;
    }

    // --------------------------------------------------
    // 🟠 Sustained overload – degrade quality
    // --------------------------------------------------
    if (this.emaLoad > 0.98 && bufferTight) {
      this.downgradeQuality(decision);
      this.shrinkVoices(decision, frame);
      this.lastPolicyChangeFrame = frame;
      return decision;
    }

    // --------------------------------------------------
    // 🟡 High load – stop growing, maybe shrink
    // --------------------------------------------------
    if (this.emaLoad > 0.9 && bufferFill < this.HEALTHY_BUFFER_FILL) {
      this.shrinkVoices(decision, frame);
      return decision;
    }

    // --------------------------------------------------
    // 🟢 Healthy – cautiously grow & recover
    // --------------------------------------------------
    if (cpuRoom && bufferHealthy) {
      if (voicePressure >= this.TIGHT_VOICE_PRESSURE) {
        this.growVoices(decision, frame, this.FAST_GROW_STEP, 0);
      } else if (voicePressure >= this.HIGH_VOICE_PRESSURE) {
        this.growVoices(decision, frame, this.GROW_STEP, this.SLOW_GROW_INTERVAL);
      }

      this.recoverQuality(frame, decision);
      return decision;
    }

    return null;
  }

  // ==== Voice pool policies ====

  private growVoices(decision: BalancerDecision, frame: number, step: number, minInterval: number) {
    if (frame - this.lastGrowFrame < minInterval) return;
    if (this.maxVoices < this.MAX_VOICES_HARD) {
      this.maxVoices = Math.min(this.maxVoices + step, this.MAX_VOICES_HARD);
      decision.maxVoices = this.maxVoices;
      this.lastGrowFrame = frame;
    }
  }

  private shrinkVoices(decision: BalancerDecision, frame: number) {
    if (frame - this.lastShrinkFrame < this.SHRINK_INTERVAL) return;
    if (this.maxVoices > this.MIN_VOICES) {
      this.maxVoices = Math.max(this.maxVoices - this.SHRINK_STEP, this.MIN_VOICES);
      decision.maxVoices = this.maxVoices;
      this.lastShrinkFrame = frame;
    }
  }

  // ==== Quality policies ====

  private downgradeQuality(decision: BalancerDecision) {
    if (this.qualityLevel > 0) {
      this.qualityLevel--;
      decision.resampler = RESAMPLERS[this.qualityLevel];
    }
  }

  private recoverQuality(frame: number, decision: BalancerDecision) {
    // hysteresis: only recover every ~200 blocks
    if (frame - this.lastPolicyChangeFrame < 200) return;

    if (this.qualityLevel < 2) {
      this.qualityLevel++;
      decision.resampler = RESAMPLERS[this.qualityLevel];
      this.lastPolicyChangeFrame = frame;
    }
  }
}
