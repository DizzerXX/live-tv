import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCatalogPlan, COUNTRY_RULES, EXTRA_CHANNELS, type RegionCuration } from '../config.js';
import { fixtureDataset } from '../testing/fixtures.js';
import { buildIndex, type BuildOptions } from './build.js';
import { createSourcePolicy } from './policy.js';

/** Curation used by tests, independent of the production picks. */
const testCurations: RegionCuration[] = [
  { group: 'entertainment', region: 'USA', max: 1, ranked: ['CBS.us', 'ABC.us'] },
];
const OFFICIAL = { name: 'Official Site', url: 'https://example.gov.my/live', note: null };
const testWatchPages = { 'TV1.my': OFFICIAL, 'BernamaTV.my': OFFICIAL, 'AstroAwani.my': OFFICIAL };
const plan = buildCatalogPlan(COUNTRY_RULES, EXTRA_CHANNELS, testCurations, testWatchPages);
const baseOptions: BuildOptions = {
  excludeGeoBlocked: false,
  excludeNot247: false,
  policy: createSourcePolicy(),
  now: new Date('2026-10-17T00:00:00Z'),
};
const names = (list: readonly { name: string }[] | undefined): string[] => (list ?? []).map((c) => c.name);

describe('buildCatalogPlan', () => {
  it('creates a Malaysia catalog plus one catalog per category for the other regions', () => {
    const p = buildCatalogPlan();
    assert.deepEqual(
      p.definitions.map((d) => d.id),
      ['malaysia', 'sports', 'news', 'movies', 'entertainment', 'kids'],
    );
    assert.deepEqual(p.regions, ['Malaysia', 'Singapore', 'UK', 'USA', 'International']);
    const sports = p.definitions.find((d) => d.id === 'sports');
    assert.deepEqual(sports?.genreOptions, ['Singapore', 'UK', 'USA', 'International']);
    assert.deepEqual(p.definitions.find((d) => d.id === 'malaysia')?.genreOptions, []);
  });

  it('caps every US category at 15 in production config, with backups and no duplicates', () => {
    const p = buildCatalogPlan();
    for (const group of ['sports', 'news', 'movies', 'entertainment', 'kids'] as const) {
      const us = p.curations.find((c) => c.group === group && c.region === 'USA');
      assert.equal(us?.max, 15, group);
      assert.ok((us?.ranked.length ?? 0) > 15, `${group} has backups`);
      assert.equal(new Set(us?.ranked).size, us?.ranked.length, `${group} has no duplicate ids`);
      assert.ok(us?.ranked.every((id) => id.endsWith('.us')), `${group} only ranks US channels`);
    }
    assert.ok(!p.curations.some((c) => c.region !== 'USA'), 'other regions are not capped');
  });

  it('rejects invalid curations', () => {
    assert.throws(
      () => buildCatalogPlan(COUNTRY_RULES, EXTRA_CHANNELS, [{ group: 'news', region: 'Mars', max: 1, ranked: [] }]),
      /not a configured region/,
    );
    assert.throws(
      () => buildCatalogPlan(COUNTRY_RULES, EXTRA_CHANNELS, [{ group: 'news', region: 'UK', max: 0, ranked: [] }]),
      /positive integer/,
    );
    assert.throws(
      () => buildCatalogPlan(COUNTRY_RULES, EXTRA_CHANNELS, [{ group: 'news', region: 'Malaysia', max: 1, ranked: [] }]),
      /has its own catalog/,
    );
  });
});

describe('buildIndex', () => {
  const index = buildIndex(fixtureDataset, plan, baseOptions);

  it('combines regions in each category, local regions first', () => {
    assert.deepEqual(names(index.byCatalog.get('news')), ['CNA', 'BBC News', 'CBS News 24/7', 'Al Jazeera']);
    assert.deepEqual(
      index.byCatalog.get('news')?.map((c) => c.region),
      ['Singapore', 'UK', 'USA', 'International'],
    );
  });

  it('puts every Malaysian channel, in any language or category, in the Malaysia catalog only', () => {
    assert.deepEqual(names(index.byCatalog.get('malaysia')), ['Bernama TV', 'TV1', 'Uncategorised MY']);
    for (const [id, list] of index.byCatalog) {
      if (id !== 'malaysia') assert.ok(!list.some((c) => c.region === 'Malaysia'), id);
    }
  });

  it('lists channels that only have an official watch page', () => {
    const bernama = index.byId.get('BernamaTV.my');
    assert.equal(bernama?.streams.length, 0);
    assert.deepEqual(bernama?.watchPages, [OFFICIAL]);
    assert.deepEqual(index.byId.get('TV1.my')?.watchPages, [OFFICIAL]);
  });

  it('applies the pay-TV denylist even to channels with an official watch page', () => {
    assert.ok(!index.byId.has('AstroAwani.my'));
    assert.ok(!index.byId.has('AstroRia.my'));
  });

  it('rejects non-https watch pages', () => {
    assert.throws(
      () => buildCatalogPlan(COUNTRY_RULES, EXTRA_CHANNELS, [], { 'TV1.my': { name: 'x', url: 'http://x.my', note: null } }),
      /https URL/,
    );
  });

  it('leaves out UK/US channels outside the five categories', () => {
    assert.ok(!index.byId.has('Religious.uk'));
  });

  it('restricts a curated region to ranked channels, in rank order', () => {
    const us = index.byCatalog.get('entertainment')?.filter((c) => c.region === 'USA');
    assert.deepEqual(names(us), ['CBS', 'ABC']); // Plain Show is not ranked
    assert.equal(index.limits.get('entertainment')?.get('USA'), 1);
  });

  it('keeps an unranked channel in its other, uncurated catalogs', () => {
    assert.ok(names(index.byCatalog.get('kids')).includes('Plain Show'));
  });

  it('applies the English filter to Singapore, UK, US and extras', () => {
    assert.ok(!index.byId.has('Channel8.sg'));
    assert.ok(!index.byId.has('Telemundo.us'));
    assert.deepEqual(index.byId.get('AlJazeera.qa')?.streams.map((s) => s.title), ['Al Jazeera English']);
  });

  it('excludes denied brands, blocklisted, closed, disallowed-host and out-of-scope channels', () => {
    for (const id of ['SkySportsF1.uk', 'DMCAChannel.us', 'OldChannel.us', 'FrenchTV.fr', 'QatarTV.qa', 'TV3.my']) {
      assert.ok(!index.byId.has(id), id);
    }
  });

  it('drops raw-IP restreams, dedupes URLs and orders streams', () => {
    const bbc = index.byId.get('BBCNews.uk');
    assert.deepEqual(bbc?.streams.map((s) => s.quality), ['1080p', '720p']);
    assert.equal(bbc?.streams[1]?.geoBlocked, true);
    assert.equal(index.byId.get('CBSNews247.us')?.streams.length, 1);
  });

  it('prefers an in-use raster https logo', () => {
    assert.equal(index.byId.get('BBCNews.uk')?.logo, 'https://example.org/bbc.png');
    assert.equal(index.byId.get('CNA.sg')?.logo, null);
  });

  it('honours geo-blocked and not-24/7 exclusion flags', () => {
    const strict = buildIndex(fixtureDataset, plan, { ...baseOptions, excludeGeoBlocked: true, excludeNot247: true });
    // TV1's only stream is geo-blocked; its official watch page keeps it listed.
    assert.equal(strict.byId.get('TV1.my')?.streams.length, 0);
    assert.equal(strict.byId.get('TV1.my')?.watchPages.length, 1);
    assert.ok(!strict.byId.has('FIFAPlus.uk'));
    assert.equal(strict.byId.get('BBCNews.uk')?.streams.length, 1);
  });
});
