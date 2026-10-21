import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIndex, type ChannelEntry } from '../catalog/build.js';
import { createSourcePolicy } from '../catalog/policy.js';
import { buildCatalogPlan, COUNTRY_RULES, EXTRA_CHANNELS } from '../config.js';
import { HealthChecker } from '../health/checker.js';
import { fixtureDataset } from '../testing/fixtures.js';
import {
  buildManifest,
  catalogResponse,
  channelIdFromStremioId,
  metaResponse,
  parseExtra,
  streamResponse,
  type StreamHealth,
} from './protocol.js';

const RTMKLIK = { name: 'RTMKlik', url: 'https://rtmklik.rtm.gov.my/', note: null };
const MANA_MANA = { name: 'MYTV Mana-Mana', url: 'https://www.mana2.my/live-tv', note: 'free' };
const plan = buildCatalogPlan(
  COUNTRY_RULES,
  EXTRA_CHANNELS,
  [{ group: 'entertainment', region: 'USA', max: 1, ranked: ['CBS.us', 'ABC.us'] }],
  { 'TV1.my': RTMKLIK, 'BernamaTV.my': MANA_MANA },
);
const index = buildIndex(fixtureDataset, plan, {
  excludeGeoBlocked: false,
  excludeNot247: false,
  policy: createSourcePolicy(),
  now: new Date('2026-10-17T00:00:00Z'),
});
const health = new HealthChecker(1, 1000); // no run yet: every stream counts as alive

/** Health stub that treats the given channels as dead. */
const deadChannels = (...ids: string[]): StreamHealth => ({
  hasLiveStream: (ch: ChannelEntry) => !ids.includes(ch.id),
  liveStreams: (ch: ChannelEntry) => (ids.includes(ch.id) ? [] : [...ch.streams]),
});
const all = { genre: null, search: null, skip: 0 };
const ids = (r: { metas: Record<string, unknown>[] } | null): unknown[] => (r?.metas ?? []).map((m) => m.id);

describe('protocol', () => {
  it('declares the Malaysia catalog and five category catalogs with a region genre filter', () => {
    const manifest = buildManifest(plan, '1.2.3') as {
      catalogs: { id: string; type: string; extra: { name: string; options?: string[] }[] }[];
    };
    assert.deepEqual(
      manifest.catalogs.map((c) => c.id),
      ['malaysia', 'sports', 'news', 'movies', 'entertainment', 'kids'],
    );
    for (const c of manifest.catalogs) {
      assert.equal(c.type, 'tv');
      const genre = c.extra.find((e) => e.name === 'genre');
      if (c.id === 'malaysia') assert.equal(genre, undefined);
      else assert.deepEqual(genre?.options, ['Singapore', 'UK', 'USA', 'International']);
    }
  });

  it('parses and clamps extra args', () => {
    assert.deepEqual(parseExtra(undefined), all);
    assert.deepEqual(parseExtra('genre=Malaysia&search=bbc%20news&skip=100'), {
      genre: 'Malaysia',
      search: 'bbc news',
      skip: 100,
    });
    assert.deepEqual(parseExtra('skip=-5'), all);
    assert.equal(parseExtra(`search=${'a'.repeat(500)}`).search?.length, 100);
    assert.equal(parseExtra(`genre=${'a'.repeat(500)}`).genre?.length, 50);
  });

  it('validates ids', () => {
    assert.equal(channelIdFromStremioId('iptvorg:BBCNews.uk'), 'BBCNews.uk');
    assert.equal(channelIdFromStremioId('iptvorg:../etc'), null);
    assert.equal(channelIdFromStremioId('tt1234567'), null);
  });

  it('filters a combined catalog by region', () => {
    assert.deepEqual(ids(catalogResponse(index, health, 'news', { ...all, genre: 'UK' })), ['iptvorg:BBCNews.uk']);
    assert.deepEqual(
      ids(catalogResponse(index, health, 'news', { ...all, genre: 'International' })),
      ['iptvorg:AlJazeera.qa'],
    );
    assert.deepEqual(ids(catalogResponse(index, health, 'news', { ...all, genre: 'Atlantis' })), []);
    assert.equal(catalogResponse(index, health, 'nope', all), null);
  });

  it('caps a curated region and promotes a backup when a pick is dead', () => {
    const usOnly = { ...all, genre: 'USA' };
    assert.deepEqual(ids(catalogResponse(index, health, 'entertainment', usOnly)), ['iptvorg:CBS.us']);
    assert.deepEqual(
      ids(catalogResponse(index, deadChannels('CBS.us'), 'entertainment', usOnly)),
      ['iptvorg:ABC.us'],
    );
    // The cap applies per region: other regions in the same catalog are unaffected.
    const everything = ids(catalogResponse(index, health, 'entertainment', all));
    assert.deepEqual(everything, ['iptvorg:CBS.us']);
    assert.deepEqual(ids(catalogResponse(index, health, 'malaysia', all)), [
      'iptvorg:BernamaTV.my',
      'iptvorg:TV1.my',
      'iptvorg:Uncategorised.my',
    ]);
  });

  it('serves meta and stream responses', () => {
    const meta = metaResponse(index, 'iptvorg:BBCNews.uk')?.meta;
    assert.equal(meta?.type, 'tv');
    assert.match(String(meta?.description), /United Kingdom/);
    assert.deepEqual(meta?.genres, ['UK', 'News']);
    assert.match(String(metaResponse(index, 'iptvorg:AlJazeera.qa')?.meta.description), /Qatar/);
    assert.deepEqual(meta?.behaviorHints, { defaultVideoId: 'iptvorg:BBCNews.uk' });

    const streams = streamResponse(index, health, 'iptvorg:TV1.my')?.streams ?? [];
    assert.equal(streams.length, 2);
    assert.deepEqual(streams[0]?.behaviorHints, {
      notWebReady: true,
      proxyHeaders: { request: { Referer: 'https://rtm-player.glueapi.io/', 'User-Agent': 'Mozilla/5.0' } },
    });
    // Official page comes last, as an external link.
    assert.deepEqual(streams[1], {
      externalUrl: 'https://rtmklik.rtm.gov.my/',
      name: 'Official',
      title: 'Watch on RTMKlik (opens externally)',
    });
    assert.equal(streamResponse(index, health, 'iptvorg:Missing.xx'), null);
  });

  it('keeps watch-page-only channels visible and serves the link even when streams are dead', () => {
    const bernama = streamResponse(index, health, 'iptvorg:BernamaTV.my')?.streams ?? [];
    assert.deepEqual(bernama.map((s) => s.title), ['Watch on MYTV Mana-Mana (opens externally)\nfree']);
    const deadTv1 = streamResponse(index, deadChannels('TV1.my'), 'iptvorg:TV1.my')?.streams ?? [];
    assert.deepEqual(deadTv1.map((s) => s.externalUrl), ['https://rtmklik.rtm.gov.my/']);
  });
});
