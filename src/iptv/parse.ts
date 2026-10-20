/**
 * Runtime validation for iptv-org JSON. The upstream data is third-party
 * input, so every record is checked and malformed records are dropped
 * rather than trusted.
 */
import type {
  IptvBlocklistEntry,
  IptvChannel,
  IptvFeed,
  IptvLogo,
  IptvStream,
} from './types.js';

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const optStr = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function parseArray<T>(raw: unknown, label: string, parseItem: (r: Rec) => T | null): T[] {
  if (!Array.isArray(raw)) throw new Error(`iptv-org ${label}: expected a JSON array`);
  const out: T[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const parsed = parseItem(item);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

export const parseChannels = (raw: unknown): IptvChannel[] =>
  parseArray(raw, 'channels', (r) => {
    const id = str(r.id);
    const name = str(r.name);
    const country = str(r.country);
    if (!id || !name || !country) return null;
    return {
      id,
      name,
      country,
      categories: strArray(r.categories),
      is_nsfw: r.is_nsfw === true,
      closed: optStr(r.closed),
      website: optStr(r.website),
    };
  });

export const parseFeeds = (raw: unknown): IptvFeed[] =>
  parseArray(raw, 'feeds', (r) => {
    const channel = str(r.channel);
    const id = str(r.id);
    if (!channel || !id) return null;
    return { channel, id, is_main: r.is_main === true, languages: strArray(r.languages) };
  });

export const parseStreams = (raw: unknown): IptvStream[] =>
  parseArray(raw, 'streams', (r) => {
    const url = str(r.url);
    if (!url) return null;
    return {
      channel: optStr(r.channel),
      feed: optStr(r.feed),
      title: str(r.title) ?? '',
      url,
      referrer: optStr(r.referrer),
      user_agent: optStr(r.user_agent),
      quality: optStr(r.quality),
      labels: strArray(r.labels),
    };
  });

export const parseLogos = (raw: unknown): IptvLogo[] =>
  parseArray(raw, 'logos', (r) => {
    const channel = str(r.channel);
    const url = str(r.url);
    if (!channel || !url) return null;
    return {
      channel,
      feed: optStr(r.feed),
      in_use: r.in_use === true,
      width: num(r.width),
      height: num(r.height),
      format: optStr(r.format),
      url,
    };
  });

export const parseBlocklist = (raw: unknown): IptvBlocklistEntry[] =>
  parseArray(raw, 'blocklist', (r) => {
    const channel = str(r.channel);
    if (!channel) return null;
    return { channel, reason: str(r.reason) ?? 'unknown' };
  });
