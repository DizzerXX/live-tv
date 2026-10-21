import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { StreamEntry } from '../catalog/build.js';
import { HealthChecker } from './checker.js';
import { classifyStatus, probeStream } from './probe.js';
import { isPublicAddress } from './safe-lookup.js';

const stream = (url: string): StreamEntry => ({
  url,
  title: 't',
  quality: null,
  referrer: null,
  userAgent: null,
  geoBlocked: false,
  not247: false,
});

describe('classifyStatus', () => {
  it('maps HTTP status codes to probe results', () => {
    assert.equal(classifyStatus(200), 'alive');
    assert.equal(classifyStatus(302), 'alive');
    assert.equal(classifyStatus(403), 'unknown');
    assert.equal(classifyStatus(451), 'unknown');
    assert.equal(classifyStatus(404), 'dead');
    assert.equal(classifyStatus(503), 'dead');
  });
});

describe('isPublicAddress', () => {
  it('rejects private, loopback, link-local and mapped addresses', () => {
    for (const [addr, family] of [
      ['127.0.0.1', 4],
      ['10.1.2.3', 4],
      ['172.20.0.1', 4],
      ['192.168.1.1', 4],
      ['169.254.169.254', 4],
      ['100.64.0.1', 4],
      ['::1', 6],
      ['fd00::1', 6],
      ['fe80::1', 6],
      ['::ffff:127.0.0.1', 6],
    ] as const) {
      assert.equal(isPublicAddress(addr, family), false, addr);
    }
  });

  it('accepts public addresses', () => {
    assert.equal(isPublicAddress('8.8.8.8', 4), true);
    assert.equal(isPublicAddress('2606:4700:4700::1111', 6), true);
  });
});

describe('probeStream', () => {
  let hits = 0;
  const server = createServer((_req, res) => {
    hits += 1;
    res.end('#EXTM3U');
  });
  let port = 0;

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  after(() => server.close());

  it('refuses to connect to loopback hosts (SSRF guard)', async () => {
    assert.equal(await probeStream(stream(`http://127.0.0.1:${port}/x.m3u8`), 2000), 'dead');
    assert.equal(await probeStream(stream(`http://localhost:${port}/x.m3u8`), 2000), 'dead');
    assert.equal(hits, 0);
  });

  it('HealthChecker hides channels whose streams all fail', async () => {
    const channel = {
      id: 'Local.us',
      name: 'Local',
      region: 'USA',
      country: 'US',
      categories: ['news'],
      logo: null,
      website: null,
      streams: [stream(`http://localhost:${port}/a.m3u8`), stream(`http://127.0.0.1:${port}/b.m3u8`)],
      watchPages: [],
    };
    const checker = new HealthChecker(2, 2000);
    assert.equal(checker.hasLiveStream(channel), true); // optimistic before first run
    const ran = await checker.run({ definitions: [], regions: [], limits: new Map(), byCatalog: new Map(), byId: new Map([[channel.id, channel]]) });
    assert.equal(ran, true);
    assert.equal(checker.hasLiveStream(channel), false);
    // An official watch page keeps the channel listed even with every stream dead.
    const withPage = { ...channel, watchPages: [{ name: 'RTMKlik', url: 'https://rtmklik.rtm.gov.my/', note: null }] };
    assert.equal(checker.hasLiveStream(withPage), true);
    assert.deepEqual(
      { alive: checker.summary.alive, dead: checker.summary.dead },
      { alive: 0, dead: 2 },
    );
  });

  it('treats non-HTTP schemes and malformed URLs as dead', async () => {
    assert.equal(await probeStream(stream('rtmp://example.org/live'), 2000), 'dead');
    assert.equal(await probeStream(stream('::nonsense'), 2000), 'dead');
  });
});
