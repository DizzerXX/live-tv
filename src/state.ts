/**
 * Owns the current catalog index and its refresh lifecycle. A failed
 * refresh keeps serving the last good index.
 */
import { buildIndex, type BuildOptions, type CatalogIndex } from './catalog/build.js';
import type { CatalogPlan } from './config.js';
import type { HealthChecker } from './health/checker.js';
import type { DatasetSource } from './iptv/source.js';
import { errorMessage, log } from './util/log.js';

export interface RefreshStatus {
  readonly lastSuccess: string | null;
  readonly lastError: string | null;
  readonly channels: number;
}

export class AddonState {
  #index: CatalogIndex | null = null;
  #lastSuccess: string | null = null;
  #lastError: string | null = null;
  #refreshing = false;
  #markFirstLoadDone: () => void = () => {};
  readonly #firstLoad = new Promise<void>((resolve) => {
    this.#markFirstLoadDone = resolve;
  });

  constructor(
    private readonly source: DatasetSource,
    readonly plan: CatalogPlan,
    private readonly buildOptions: Omit<BuildOptions, 'now'>,
    readonly health: HealthChecker,
    private readonly healthcheckEnabled: boolean,
  ) {}

  get index(): CatalogIndex | null {
    return this.#index;
  }

  get status(): RefreshStatus {
    return {
      lastSuccess: this.#lastSuccess,
      lastError: this.#lastError,
      channels: this.#index?.byId.size ?? 0,
    };
  }

  /**
   * Resolves once the first refresh attempt has finished (success or failure),
   * or after `timeoutMs`. Lets requests that arrive during a cold start wait
   * for data instead of failing.
   */
  async waitForFirstLoad(timeoutMs: number): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([this.#firstLoad, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Reloads data and rebuilds the index. Health checks run afterwards without blocking requests. */
  async refresh(): Promise<void> {
    if (this.#refreshing) return;
    this.#refreshing = true;
    try {
      const dataset = await this.source.load();
      const index = buildIndex(dataset, this.plan, { ...this.buildOptions, now: new Date() });
      this.#index = index;
      this.#lastSuccess = new Date().toISOString();
      this.#lastError = null;
      log('info', 'index refreshed', {
        source: this.source.description,
        channels: index.byId.size,
        catalogs: Object.fromEntries([...index.byCatalog].map(([id, list]) => [id, list.length])),
      });
    } catch (err) {
      this.#lastError = errorMessage(err);
      log('error', 'index refresh failed; keeping previous index', { error: this.#lastError });
      return;
    } finally {
      this.#refreshing = false;
      this.#markFirstLoadDone();
    }

    if (this.healthcheckEnabled && this.#index) {
      const index = this.#index;
      void this.health
        .run(index)
        .then((ran) => {
          if (ran) log('info', 'health check complete', { ...this.health.summary });
        })
        .catch((err: unknown) => log('error', 'health check failed', { error: errorMessage(err) }));
    }
  }
}
