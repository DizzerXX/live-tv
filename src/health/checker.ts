/**
 * Probes every stream in the index with bounded concurrency and keeps the
 * set of dead URLs. Until the first run completes, everything is "alive".
 */
import type { CatalogIndex, ChannelEntry, StreamEntry } from '../catalog/build.js';
import { probeStream } from './probe.js';

export interface HealthSummary {
  readonly checkedAt: string | null;
  readonly alive: number;
  readonly unknown: number;
  readonly dead: number;
}

async function runPool<T>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

export class HealthChecker {
  #dead: ReadonlySet<string> = new Set();
  #summary: HealthSummary = { checkedAt: null, alive: 0, unknown: 0, dead: 0 };
  #running = false;

  constructor(
    private readonly concurrency: number,
    private readonly timeoutMs: number,
  ) {}

  get summary(): HealthSummary {
    return this.#summary;
  }

  isAlive(stream: StreamEntry): boolean {
    return !this.#dead.has(stream.url);
  }

  liveStreams(channel: ChannelEntry): StreamEntry[] {
    return channel.streams.filter((s) => this.isAlive(s));
  }

  /** True if any stream is alive, or the channel links to an official platform page. */
  hasLiveStream(channel: ChannelEntry): boolean {
    return channel.watchPages.length > 0 || channel.streams.some((s) => this.isAlive(s));
  }

  /** Returns false if a run was already in progress. */
  async run(index: CatalogIndex): Promise<boolean> {
    if (this.#running) return false;
    this.#running = true;
    try {
      const streams = [...index.byId.values()].flatMap((c) => c.streams);
      const dead = new Set<string>();
      const counts = { alive: 0, unknown: 0, dead: 0 };
      await runPool(streams, this.concurrency, async (stream) => {
        const result = await probeStream(stream, this.timeoutMs);
        counts[result] += 1;
        if (result === 'dead') dead.add(stream.url);
      });
      this.#dead = dead;
      this.#summary = { checkedAt: new Date().toISOString(), ...counts };
      return true;
    } finally {
      this.#running = false;
    }
  }
}
