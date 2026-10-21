import { probeStream } from './probe.js';
async function runPool(items, concurrency, worker) {
    let next = 0;
    const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            await worker(item);
        }
    });
    await Promise.all(lanes);
}
export class HealthChecker {
    concurrency;
    timeoutMs;
    #dead = new Set();
    #summary = { checkedAt: null, alive: 0, unknown: 0, dead: 0 };
    #running = false;
    constructor(concurrency, timeoutMs) {
        this.concurrency = concurrency;
        this.timeoutMs = timeoutMs;
    }
    get summary() {
        return this.#summary;
    }
    isAlive(stream) {
        return !this.#dead.has(stream.url);
    }
    liveStreams(channel) {
        return channel.streams.filter((s) => this.isAlive(s));
    }
    hasLiveStream(channel) {
        return channel.streams.some((s) => this.isAlive(s));
    }
    /** Returns false if a run was already in progress. */
    async run(index) {
        if (this.#running)
            return false;
        this.#running = true;
        try {
            const streams = [...index.byId.values()].flatMap((c) => c.streams);
            const dead = new Set();
            const counts = { alive: 0, unknown: 0, dead: 0 };
            await runPool(streams, this.concurrency, async (stream) => {
                const result = await probeStream(stream, this.timeoutMs);
                counts[result] += 1;
                if (result === 'dead')
                    dead.add(stream.url);
            });
            this.#dead = dead;
            this.#summary = { checkedAt: new Date().toISOString(), ...counts };
            return true;
        }
        finally {
            this.#running = false;
        }
    }
}
//# sourceMappingURL=checker.js.map