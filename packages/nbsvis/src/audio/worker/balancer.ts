// balancer.ts
import type { ResamplerFn } from './resampler';

export interface BalancerContext {
  readonly sampleRate: number;
}

export interface BalancerDecision {
  maxVoices?: number;
  resampler?: ResamplerFn;
  killVoicesRatio?: number; // 0..1
}

export interface BalancerMetrics {
  frame: number;
  blockSize: number;
  activeVoices: number;
  maxVoices: number;
  bufferFill: number; // 0..1
}

export interface IBalancer {
  /** Called once on processor construction */
  init(ctx: BalancerContext): void;

  /** Activate or deactivate balancer evaluation */
  setActive(active: boolean): void;

  /** Called at the beginning of process() */
  beginProcess(): void;

  /** Called at the end of process() */
  endProcess(metrics: BalancerMetrics): BalancerDecision | null;
}
