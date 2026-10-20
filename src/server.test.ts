import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createSourcePolicy } from './catalog/policy.js';
import { buildCatalogDefinitions } from './config.js';
import { HealthChecker } from './health/checker.js';
import { localSource } from './iptv/source.js';
import { createAddonServer } from './server.js';
import { AddonState } from './state.js';
import { fixtureDataset } from './testing/fixtures.js';

describe('HTTP server (end to end over a local dataset)', () => {
  let dir = '';
  let server: Server;
  let base = '';

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'iptv-fixture-'));
    for (const [name, data] of Object.entries(fixtureDataset)) {
      await writeFile(join(dir, `${name}.json`), JSON.stringify(data));
    }
    const state = new AddonState(
      localSource(dir),
      buildCatalogDefinitions(),
      { excludeGeoBlocked: false, excludeNot247: false, policy: createSourcePolicy() },
      new HealthChecker(2, 1000),
      false,
    );
    await state.refresh();
    server = createAddonServer(state, '9.9.9');
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('serves the manifest with CORS', async () => {
    const res = await fetch(`${base}/manifest.json`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const body = (await res.json()) as { version: string; catalogs: unknown[] };
    assert.equal(body.version, '9.9.9');
    assert.equal(body.catalogs.length, 12);
  });

  it('serves catalogs with and without extra args', async () => {
    const plain = (await (await fetch(`${base}/catalog/tv/uk-news.json`)).json()) as { metas: { name: string }[] };
    assert.deepEqual(plain.metas.map((m) => m.name), ['BBC News']);
    const searched = (await (await fetch(`${base}/catalog/tv/uk-news/search=zzz.json`)).json()) as { metas: unknown[] };
    assert.equal(searched.metas.length, 0);
  });

  it('serves streams and 404s unknown or malformed ids', async () => {
    const ok = (await (await fetch(`${base}/stream/tv/iptvorg%3ABBCNews.uk.json`)).json()) as { streams: unknown[] };
    assert.equal(ok.streams.length, 2);
    assert.equal((await fetch(`${base}/stream/tv/iptvorg:%E0%A4%A.json`)).status, 404);
    assert.equal((await fetch(`${base}/stream/movie/iptvorg:BBCNews.uk.json`)).status, 404);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  });

  it('holds data requests during a cold start until the first load finishes', async () => {
    const cold = new AddonState(
      localSource(dir),
      buildCatalogDefinitions(),
      { excludeGeoBlocked: false, excludeNot247: false, policy: createSourcePolicy() },
      new HealthChecker(2, 1000),
      false,
    );
    const coldServer = createAddonServer(cold, '1.0.0');
    await new Promise<void>((resolve) => coldServer.listen(0, '127.0.0.1', resolve));
    try {
      const url = `http://127.0.0.1:${(coldServer.address() as AddressInfo).port}/catalog/tv/uk-news.json`;
      const pending = fetch(url); // arrives before any data is loaded
      await new Promise((resolve) => setTimeout(resolve, 50));
      await cold.refresh();
      const res = await pending;
      assert.equal(res.status, 200);
      const body = (await res.json()) as { metas: unknown[] };
      assert.equal(body.metas.length, 1);
    } finally {
      coldServer.close();
    }
  });

  it('rejects non-read methods and answers CORS preflight', async () => {
    assert.equal((await fetch(`${base}/manifest.json`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/manifest.json`, { method: 'OPTIONS' })).status, 204);
  });
});
