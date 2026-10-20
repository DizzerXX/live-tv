/**
 * Small hand-written dataset in the real iptv-org schema, used by tests.
 * Records mirror real upstream entries (hosts and labels), trimmed to size.
 */
import type { IptvDataset } from '../iptv/types.js';

export const fixtureDataset: IptvDataset = {
  channels: [
    { id: 'BBCNews.uk', name: 'BBC News', country: 'UK', categories: ['news'], is_nsfw: false, closed: null, website: 'https://www.bbc.co.uk/news' },
    { id: 'SkySportsF1.uk', name: 'Sky Sports F1', country: 'UK', categories: ['sports'], is_nsfw: false, closed: null, website: null },
    { id: 'FIFAPlus.uk', name: 'FIFA+', country: 'UK', categories: ['sports'], is_nsfw: false, closed: null, website: null },
    { id: 'TV1.my', name: 'TV1', country: 'MY', categories: ['general'], is_nsfw: false, closed: null, website: null },
    { id: 'TV3.my', name: 'TV3', country: 'MY', categories: ['general'], is_nsfw: false, closed: null, website: null },
    { id: 'CNA.sg', name: 'CNA', country: 'SG', categories: ['news'], is_nsfw: false, closed: null, website: null },
    { id: 'Channel8.sg', name: 'Channel 8', country: 'SG', categories: ['general'], is_nsfw: false, closed: null, website: null },
    { id: 'OldChannel.us', name: 'Old Channel', country: 'US', categories: ['news'], is_nsfw: false, closed: '2020-01-01', website: null },
    { id: 'DMCAChannel.us', name: 'DMCA Channel', country: 'US', categories: ['movies'], is_nsfw: false, closed: null, website: null },
    { id: 'CBSNews247.us', name: 'CBS News 24/7', country: 'US', categories: ['news'], is_nsfw: false, closed: null, website: null },
    { id: 'Telemundo.us', name: 'Telemundo', country: 'US', categories: ['entertainment'], is_nsfw: false, closed: null, website: null },
    { id: 'FrenchTV.fr', name: 'French TV', country: 'FR', categories: ['news'], is_nsfw: false, closed: null, website: null },
  ],
  feeds: [
    { channel: 'BBCNews.uk', id: 'SD', is_main: true, languages: ['eng'] },
    { channel: 'SkySportsF1.uk', id: 'SD', is_main: true, languages: ['eng'] },
    { channel: 'FIFAPlus.uk', id: 'SD', is_main: true, languages: ['eng'] },
    { channel: 'TV1.my', id: 'SD', is_main: true, languages: ['msa'] },
    { channel: 'TV3.my', id: 'SD', is_main: true, languages: ['msa'] },
    { channel: 'CNA.sg', id: 'SD', is_main: true, languages: ['eng'] },
    { channel: 'Channel8.sg', id: 'SD', is_main: true, languages: ['zho'] },
    { channel: 'OldChannel.us', id: 'SD', is_main: true, languages: ['eng'] },
    { channel: 'DMCAChannel.us', id: 'SD', is_main: true, languages: ['eng'] },
    { channel: 'CBSNews247.us', id: 'SD', is_main: true, languages: ['eng'] },
    { channel: 'Telemundo.us', id: 'SD', is_main: true, languages: ['spa'] },
    { channel: 'FrenchTV.fr', id: 'SD', is_main: true, languages: ['fra'] },
  ],
  streams: [
    { channel: 'BBCNews.uk', feed: null, title: 'BBC News', url: 'https://vs-hls-push-uk-live.akamaized.net/x/bbc_news/720p.m3u8', referrer: null, user_agent: null, quality: '720p', labels: ['Geo-blocked'] },
    { channel: 'BBCNews.uk', feed: 'SD', title: 'BBC News', url: 'https://vs-hls-push-ww-live.akamaized.net/x/bbc_news/1080p.m3u8', referrer: null, user_agent: null, quality: '1080p', labels: [] },
    { channel: 'BBCNews.uk', feed: null, title: 'BBC News (restream)', url: 'http://45.153.96.44:8001/play/a0lp', referrer: null, user_agent: null, quality: null, labels: [] },
    { channel: 'SkySportsF1.uk', feed: null, title: 'Sky Sports F1', url: 'https://cdn.stmify.com/live/skyf1.m3u8', referrer: 'https://stmify.com/', user_agent: null, quality: null, labels: [] },
    { channel: 'FIFAPlus.uk', feed: null, title: 'FIFA+', url: 'https://jmp2.uk/sam-GBBA3500012E7.m3u8', referrer: null, user_agent: null, quality: '720p', labels: ['Not 24/7'] },
    { channel: 'TV1.my', feed: null, title: 'TV1', url: 'https://d25tgymtnqzu8s.cloudfront.net/smil:tv1/playlist.m3u8', referrer: 'https://rtm-player.glueapi.io/', user_agent: 'Mozilla/5.0', quality: '720p', labels: ['Geo-blocked'] },
    { channel: 'TV3.my', feed: null, title: 'TV3', url: 'https://radiomy-tonton-proxy.api-danidev.workers.dev/tv3.m3u8', referrer: null, user_agent: null, quality: null, labels: [] },
    { channel: 'CNA.sg', feed: null, title: 'CNA', url: 'https://d2e1asnsl7br7b.cloudfront.net/7782e205e72f43aeb4a48ec97f66ebbe/index.m3u8', referrer: null, user_agent: null, quality: '1080p', labels: [] },
    { channel: 'Channel8.sg', feed: null, title: 'Channel 8', url: 'https://d2e1asnsl7br7b.cloudfront.net/ch8/index.m3u8', referrer: null, user_agent: null, quality: null, labels: [] },
    { channel: 'OldChannel.us', feed: null, title: 'Old', url: 'https://old.wurl.tv/playlist.m3u8', referrer: null, user_agent: null, quality: null, labels: [] },
    { channel: 'DMCAChannel.us', feed: null, title: 'DMCA', url: 'https://dmca.amagi.tv/playlist.m3u8', referrer: null, user_agent: null, quality: null, labels: [] },
    { channel: 'CBSNews247.us', feed: null, title: 'CBS News 24/7', url: 'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8', referrer: null, user_agent: null, quality: '720p', labels: [] },
    { channel: 'CBSNews247.us', feed: null, title: 'duplicate', url: 'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8', referrer: null, user_agent: null, quality: '720p', labels: [] },
    { channel: 'Telemundo.us', feed: null, title: 'Telemundo', url: 'https://telemundo.akamaized.net/master.m3u8', referrer: null, user_agent: null, quality: null, labels: [] },
    { channel: 'FrenchTV.fr', feed: null, title: 'French', url: 'https://french.akamaized.net/master.m3u8', referrer: null, user_agent: null, quality: null, labels: [] },
    { channel: null, feed: null, title: 'Orphan', url: 'https://orphan.amagi.tv/playlist.m3u8', referrer: null, user_agent: null, quality: null, labels: [] },
  ],
  logos: [
    { channel: 'BBCNews.uk', feed: null, in_use: true, width: 512, height: 512, format: 'SVG', url: 'https://example.org/bbc.svg' },
    { channel: 'BBCNews.uk', feed: null, in_use: true, width: 512, height: 512, format: 'PNG', url: 'https://example.org/bbc.png' },
    { channel: 'BBCNews.uk', feed: null, in_use: false, width: 1000, height: 1000, format: 'PNG', url: 'https://example.org/bbc-old.png' },
    { channel: 'CNA.sg', feed: null, in_use: true, width: 300, height: 100, format: 'PNG', url: 'http://example.org/insecure.png' },
  ],
  blocklist: [{ channel: 'DMCAChannel.us', reason: 'dmca' }],
};
