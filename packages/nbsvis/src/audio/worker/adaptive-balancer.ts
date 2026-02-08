import { IBalancer, BalancerContext, BalancerDecision } from './balancer';
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
  private readonly SHRINK_STEP = 16;

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

  endProcess(frame: number, blockSize: number): BalancerDecision | null {
    if (!this.active) return null;
    const now = performance.now() / 1000;

    if (this.warmupBlocks > 0) {
      console.log('Warmup blocks left:', this.warmupBlocks, ', skipping load measurement');
      this.warmupBlocks--;
      return null;
    }

    if (this.lastProcessTime !== 0) {
      // Expected time between process() calls
      const expected = blockSize / this.sampleRate;

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
    const decision = this.evaluatePolicy(frame);

    this.lastProcessTime = now;

    return decision;
  }

  private evaluatePolicy(frame: number): BalancerDecision | null {
    const decision: BalancerDecision = {};

    // --------------------------------------------------
    // 🔴 Circuit breaker – emergency protection
    // --------------------------------------------------
    if (this.peakLoad > 1.2) {
      decision.killVoicesRatio = 0.25; // kill 25% immediately
      this.downgradeQuality(decision);
      this.lastPolicyChangeFrame = frame;
      this.breakerCooldown = 60; // skip further changes for 60 blocks
      this.peakLoad = 1; // reset peak
      return decision;
    }

    // --------------------------------------------------
    // 🟠 Sustained overload – degrade quality
    // --------------------------------------------------
    if (this.emaLoad > 0.85) {
      this.downgradeQuality(decision);
      this.shrinkVoices(decision);
      this.lastPolicyChangeFrame = frame;
      return decision;
    }

    // --------------------------------------------------
    // 🟡 High load – stop growing, maybe shrink
    // --------------------------------------------------
    if (this.emaLoad > 0.7) {
      this.shrinkVoices(decision);
      return decision;
    }

    // --------------------------------------------------
    // 🟢 Healthy – cautiously grow & recover
    // --------------------------------------------------
    if (this.emaLoad < 0.5) {
      this.growVoices(decision);
      this.recoverQuality(frame, decision);
      return decision;
    }

    return null;
  }

  // ==== Voice pool policies ====

  private growVoices(decision: BalancerDecision) {
    if (this.maxVoices < this.MAX_VOICES_HARD) {
      this.maxVoices += this.GROW_STEP;
      decision.maxVoices = this.maxVoices;
    }
  }

  private shrinkVoices(decision: BalancerDecision) {
    if (this.maxVoices > this.MIN_VOICES) {
      this.maxVoices -= this.SHRINK_STEP;
      decision.maxVoices = this.maxVoices;
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
