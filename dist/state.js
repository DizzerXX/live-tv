/**
 * Owns the current catalog index and its refresh lifecycle. A failed
 * refresh keeps serving the last good index.
 */
import { buildIndex } from './catalog/build.js';
import { errorMessage, log } from './util/log.js';
export class AddonState {
    source;
    definitions;
    buildOptions;
    health;
    healthcheckEnabled;
    #index = null;
    #lastSuccess = null;
    #lastError = null;
    #refreshing = false;
    #markFirstLoadDone = () => { };
    #firstLoad = new Promise((resolve) => {
        this.#markFirstLoadDone = resolve;
    });
    constructor(source, definitions, buildOptions, health, healthcheckEnabled) {
        this.source = source;
        this.definitions = definitions;
        this.buildOptions = buildOptions;
        this.health = health;
        this.healthcheckEnabled = healthcheckEnabled;
    }
    get index() {
        return this.#index;
    }
    get status() {
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
    async waitForFirstLoad(timeoutMs) {
        let timer;
        const timeout = new Promise((resolve) => {
            timer = setTimeout(resolve, timeoutMs);
        });
        try {
            await Promise.race([this.#firstLoad, timeout]);
        }
        finally {
            clearTimeout(timer);
        }
    }
    /** Reloads data and rebuilds the index. Health checks run afterwards without blocking requests. */
    async refresh() {
        if (this.#refreshing)
            return;
        this.#refreshing = true;
        try {
            const dataset = await this.source.load();
            const index = buildIndex(dataset, this.definitions, { ...this.buildOptions, now: new Date() });
            this.#index = index;
            this.#lastSuccess = new Date().toISOString();
            this.#lastError = null;
            log('info', 'index refreshed', {
                source: this.source.description,
                channels: index.byId.size,
                catalogs: Object.fromEntries([...index.byCatalog].map(([id, list]) => [id, list.length])),
            });
        }
        catch (err) {
            this.#lastError = errorMessage(err);
            log('error', 'index refresh failed; keeping previous index', { error: this.#lastError });
            return;
        }
        finally {
            this.#refreshing = false;
            this.#markFirstLoadDone();
        }
        if (this.healthcheckEnabled && this.#index) {
            const index = this.#index;
            void this.health
                .run(index)
                .then((ran) => {
                if (ran)
                    log('info', 'health check complete', { ...this.health.summary });
            })
                .catch((err) => log('error', 'health check failed', { error: errorMessage(err) }));
        }
    }
}
//# sourceMappingURL=state.js.map