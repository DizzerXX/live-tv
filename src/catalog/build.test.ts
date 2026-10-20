import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCatalogDefinitions } from '../config.js';
import { fixtureDataset } from '../testing/fixtures.js';
import { buildIndex, type BuildOptions } from './build.js';
import { createSourcePolicy } from './policy.js';

const definitions = buildCatalogDefinitions();
const baseOptions: BuildOptions = {
  excludeGeoBlocked: false,
  excludeNot247: false,
  policy: createSourcePolicy(),
  now: new Date('2026-10-17T00:00:00Z'),
};
const names = (list: readonly { name: string }[] | undefined): string[] => (list ?? []).map((c) => c.name);

describe('buildIndex', () => {
  const index = buildIndex(fixtureDataset, definitions, baseOptions);

  it('creates the 12 requested catalogs', () => {
    assert.deepEqual(
      definitions.map((d) => d.id),
      [
        'my-all',
        'sg-all',
        'uk-sports',
        'uk-news',
        'uk-movies',
        'uk-entertainment',
        'uk-kids',
        'us-sports',
        'us-news',
        'us-movies',
        'us-entertainment',
        'us-kids',
      ],
    );
  });

  it('keeps Malaysian channels in any language but drops disallowed hosts', () => {
    assert.deepEqual(names(index.byCatalog.get('my-all')), ['TV1']);
  });

  it('applies the English filter to Singapore, UK and US', () => {
    assert.deepEqual(names(index.byCatalog.get('sg-all')), ['CNA']);
    assert.deepEqual(names(index.byCatalog.get('us-entertainment')), []);
  });

  it('excludes denied brands, blocklisted, closed and out-of-scope channels', () => {
    assert.ok(!index.byId.has('SkySportsF1.uk'));
    assert.ok(!index.byId.has('DMCAChannel.us'));
    assert.ok(!index.byId.has('OldChannel.us'));
    assert.ok(!index.byId.has('FrenchTV.fr'));
  });

  it('drops raw-IP restreams and dedupes URLs', () => {
    const bbc = index.byId.get('BBCNews.uk');
    assert.ok(bbc);
    assert.equal(bbc.streams.length, 2);
    assert.ok(bbc.streams.every((s) => !s.url.includes('45.153.96.44')));
    assert.equal(index.byId.get('CBSNews247.us')?.streams.length, 1);
  });

  it('orders streams: not geo-blocked first, then highest quality', () => {
    const bbc = index.byId.get('BBCNews.uk');
    assert.deepEqual(
      bbc?.streams.map((s) => s.quality),
      ['1080p', '720p'],
    );
    assert.equal(bbc?.streams[1]?.geoBlocked, true);
  });

  it('prefers an in-use raster https logo', () => {
    assert.equal(index.byId.get('BBCNews.uk')?.logo, 'https://example.org/bbc.png');
    assert.equal(index.byId.get('CNA.sg')?.logo, null);
  });

  it('honours geo-blocked and not-24/7 exclusion flags', () => {
    const strict = buildIndex(fixtureDataset, definitions, {
      ...baseOptions,
      excludeGeoBlocked: true,
      excludeNot247: true,
    });
    assert.ok(!strict.byId.has('TV1.my'));
    assert.ok(!strict.byId.has('FIFAPlus.uk'));
    assert.equal(strict.byId.get('BBCNews.uk')?.streams.length, 1);
  });
});
