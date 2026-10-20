import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIndex } from '../catalog/build.js';
import { createSourcePolicy } from '../catalog/policy.js';
import { buildCatalogDefinitions } from '../config.js';
import { HealthChecker } from '../health/checker.js';
import { fixtureDataset } from '../testing/fixtures.js';
import {
  buildManifest,
  catalogResponse,
  channelIdFromStremioId,
  metaResponse,
  parseExtra,
  streamResponse,
} from './protocol.js';

const definitions = buildCatalogDefinitions();
const index = buildIndex(fixtureDataset, definitions, {
  excludeGeoBlocked: false,
  excludeNot247: false,
  policy: createSourcePolicy(),
  now: new Date('2026-10-17T00:00:00Z'),
});
const health = new HealthChecker(1, 1000);

describe('protocol', () => {
  it('declares tv catalogs with search and skip extras', () => {
    const manifest = buildManifest(definitions, '1.2.3') as { catalogs: { type: string; extra: unknown[] }[] };
    assert.equal(manifest.catalogs.length, 12);
    assert.ok(manifest.catalogs.every((c) => c.type === 'tv' && c.extra.length === 2));
  });

  it('parses and clamps extra args', () => {
    assert.deepEqual(parseExtra(undefined), { search: null, skip: 0 });
    assert.deepEqual(parseExtra('search=bbc%20news&skip=100'), { search: 'bbc news', skip: 100 });
    assert.deepEqual(parseExtra('skip=-5'), { search: null, skip: 0 });
    assert.deepEqual(parseExtra('skip=abc'), { search: null, skip: 0 });
    assert.equal(parseExtra(`search=${'a'.repeat(500)}`).search?.length, 100);
  });

  it('validates ids', () => {
    assert.equal(channelIdFromStremioId('iptvorg:BBCNews.uk'), 'BBCNews.uk');
    assert.equal(channelIdFromStremioId('iptvorg:../etc'), null);
    assert.equal(channelIdFromStremioId('tt1234567'), null);
  });

  it('serves catalog, meta and stream responses', () => {
    const catalog = catalogResponse(index, health, 'uk-news', { search: 'bbc', skip: 0 });
    assert.deepEqual(catalog?.metas.map((m) => m.id), ['iptvorg:BBCNews.uk']);
    assert.equal(catalogResponse(index, health, 'nope', { search: null, skip: 0 }), null);

    const meta = metaResponse(index, 'iptvorg:BBCNews.uk')?.meta;
    assert.equal(meta?.type, 'tv');
    assert.deepEqual(meta?.behaviorHints, { defaultVideoId: 'iptvorg:BBCNews.uk' });

    const streams = streamResponse(index, health, 'iptvorg:TV1.my')?.streams ?? [];
    assert.equal(streams.length, 1);
    assert.deepEqual(streams[0]?.behaviorHints, {
      notWebReady: true,
      proxyHeaders: { request: { Referer: 'https://rtm-player.glueapi.io/', 'User-Agent': 'Mozilla/5.0' } },
    });
    assert.equal(streamResponse(index, health, 'iptvorg:Missing.xx'), null);
  });
});
