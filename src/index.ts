#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createSourcePolicy } from './catalog/policy.js';
import { buildCatalogDefinitions, loadConfig } from './config.js';
import { HealthChecker } from './health/checker.js';
import { localSource, remoteSource } from './iptv/source.js';
import { createAddonServer } from './server.js';
import { AddonState } from './state.js';
import { errorMessage, log } from './util/log.js';

function packageVersion(): string {
  const pkg: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const version = (pkg as { version?: unknown }).version;
  return typeof version === 'string' ? version : '0.0.0';
}

async function main(): Promise<void> {
  const config = loadConfig();
  const source = config.iptvDataDir ? localSource(config.iptvDataDir) : remoteSource(config.iptvApiBase);
  const health = new HealthChecker(config.healthcheck.concurrency, config.healthcheck.timeoutMs);
  const state = new AddonState(
    source,
    buildCatalogDefinitions(),
    {
      excludeGeoBlocked: config.excludeGeoBlocked,
      excludeNot247: config.excludeNot247,
      policy: createSourcePolicy(config.extraAllowedHosts),
    },
    health,
    config.healthcheck.enabled,
  );

  const server = createAddonServer(state, packageVersion());
  server.listen(config.port, config.host, () => {
    log('info', 'listening', { host: config.host, port: config.port, manifest: '/manifest.json' });
  });

  await state.refresh();
  const timer = setInterval(() => void state.refresh(), config.refreshIntervalMs);

  const shutdown = (signal: string): void => {
    log('info', 'shutting down', { signal });
    clearInterval(timer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  log('error', 'fatal startup error', { error: errorMessage(err) });
  process.exit(1);
});
