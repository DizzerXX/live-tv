import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSourcePolicy } from './policy.js';
describe('createSourcePolicy', () => {
    const policy = createSourcePolicy(['example-broadcaster.tv']);
    it('allows listed hosts and their subdomains', () => {
        assert.ok(policy.isAllowedStreamUrl('https://jmp2.uk/plu-123.m3u8'));
        assert.ok(policy.isAllowedStreamUrl('https://a.b.amagi.tv/playlist.m3u8'));
        assert.ok(policy.isAllowedStreamUrl('https://live.example-broadcaster.tv/x.m3u8'));
        assert.ok(policy.isAllowedStreamUrl('https://abc.mediatailor.us-east-1.amazonaws.com/v1/master/x.m3u8'));
    });
    it('rejects look-alike, raw-IP, credentialed and non-HTTP sources', () => {
        assert.ok(!policy.isAllowedStreamUrl('https://evilamagi.tv/playlist.m3u8'));
        assert.ok(!policy.isAllowedStreamUrl('https://amagi.tv.evil.com/playlist.m3u8'));
        assert.ok(!policy.isAllowedStreamUrl('http://45.153.96.44:8001/play'));
        assert.ok(!policy.isAllowedStreamUrl('http://[2001:4860::8888]/play.m3u8'));
        assert.ok(!policy.isAllowedStreamUrl('https://user:pass@x.amagi.tv/p.m3u8'));
        assert.ok(!policy.isAllowedStreamUrl('rtmp://x.amagi.tv/live'));
        assert.ok(!policy.isAllowedStreamUrl('https://bucket.s3.amazonaws.com/x.m3u8'));
        assert.ok(!policy.isAllowedStreamUrl('not a url'));
    });
    it('denies pay-TV brand names but keeps their FAST spin-offs', () => {
        assert.ok(policy.isDeniedChannelName('HBO Asia'));
        assert.ok(policy.isDeniedChannelName('Sky Sports Main Event'));
        assert.ok(policy.isDeniedChannelName('beIN SPORTS 1'));
        assert.ok(!policy.isDeniedChannelName('beIN SPORTS XTRA'));
        assert.ok(!policy.isDeniedChannelName('Sky News'));
    });
});
//# sourceMappingURL=policy.test.js.map