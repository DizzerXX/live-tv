/**
 * Stremio addon protocol responses (also consumed by Nuvio).
 * Spec: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md
 *
 * Every function here is pure: index + health state in, JSON-ready object out.
 */
import type { CatalogDefinition } from '../config.js';
import type { CatalogIndex, ChannelEntry, StreamEntry } from '../catalog/build.js';
import type { HealthChecker } from '../health/checker.js';

export const CONTENT_TYPE = 'tv';
export const ID_PREFIX = 'iptvorg:';
export const PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
const CHANNEL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  MY: 'Malaysia',
  SG: 'Singapore',
  UK: 'United Kingdom',
  US: 'United States',
};

export function buildManifest(definitions: readonly CatalogDefinition[], version: string): Record<string, unknown> {
  return {
    id: 'community.nuvio.livetv.iptvorg',
    version,
    name: 'Live TV (iptv-org)',
    description:
      'Free-to-air and free ad-supported live channels for Malaysia, Singapore, the UK and the US, ' +
      'sourced from the iptv-org public stream index.',
    types: [CONTENT_TYPE],
    idPrefixes: [ID_PREFIX],
    resources: [
      'catalog',
      { name: 'meta', types: [CONTENT_TYPE], idPrefixes: [ID_PREFIX] },
      { name: 'stream', types: [CONTENT_TYPE], idPrefixes: [ID_PREFIX] },
    ],
    catalogs: definitions.map((d) => ({
      type: CONTENT_TYPE,
      id: d.id,
      name: d.name,
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    })),
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}

export interface CatalogExtra {
  readonly search: string | null;
  readonly skip: number;
}

/** Parses the `search=foo&skip=100` path segment. Invalid values fall back to defaults. */
export function parseExtra(segment: string | undefined): CatalogExtra {
  if (!segment) return { search: null, skip: 0 };
  const params = new URLSearchParams(segment);
  const search = params.get('search')?.trim().slice(0, MAX_SEARCH_LENGTH) || null;
  const skipRaw = Number(params.get('skip') ?? '0');
  const skip = Number.isInteger(skipRaw) && skipRaw > 0 ? Math.min(skipRaw, 100_000) : 0;
  return { search, skip };
}

export function channelIdFromStremioId(stremioId: string): string | null {
  if (!stremioId.startsWith(ID_PREFIX)) return null;
  const id = stremioId.slice(ID_PREFIX.length);
  return CHANNEL_ID_PATTERN.test(id) ? id : null;
}

const toStremioId = (channelId: string): string => `${ID_PREFIX}${channelId}`;

const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function metaPreview(ch: ChannelEntry): Record<string, unknown> {
  return {
    id: toStremioId(ch.id),
    type: CONTENT_TYPE,
    name: ch.name,
    ...(ch.logo ? { poster: ch.logo, logo: ch.logo } : {}),
    posterShape: 'square',
    genres: ch.categories.map(titleCase),
  };
}

export function catalogResponse(
  index: CatalogIndex,
  health: HealthChecker,
  catalogId: string,
  extra: CatalogExtra,
): { metas: Record<string, unknown>[] } | null {
  const channels = index.byCatalog.get(catalogId);
  if (!channels) return null;
  const needle = extra.search?.toLowerCase() ?? null;
  const visible = channels.filter(
    (ch) => health.hasLiveStream(ch) && (needle === null || ch.name.toLowerCase().includes(needle)),
  );
  return { metas: visible.slice(extra.skip, extra.skip + PAGE_SIZE).map(metaPreview) };
}

export function metaResponse(
  index: CatalogIndex,
  stremioId: string,
): { meta: Record<string, unknown> } | null {
  const channelId = channelIdFromStremioId(stremioId);
  const ch = channelId ? index.byId.get(channelId) : undefined;
  if (!ch) return null;
  const country = COUNTRY_NAMES[ch.country] ?? ch.country;
  const description = [`Live channel · ${country}`, ch.website ? `Website: ${ch.website}` : null]
    .filter(Boolean)
    .join('\n');
  return {
    meta: {
      ...metaPreview(ch),
      description,
      ...(ch.website ? { website: ch.website } : {}),
      behaviorHints: { defaultVideoId: toStremioId(ch.id) },
    },
  };
}

function streamObject(channel: ChannelEntry, s: StreamEntry): Record<string, unknown> {
  const notes = [s.quality, s.geoBlocked ? 'may be geo-blocked' : null, s.not247 ? 'not 24/7' : null].filter(
    (x): x is string => x !== null,
  );
  const requestHeaders: Record<string, string> = {};
  if (s.referrer) requestHeaders.Referer = s.referrer;
  if (s.userAgent) requestHeaders['User-Agent'] = s.userAgent;
  const hasHeaders = Object.keys(requestHeaders).length > 0;

  return {
    url: s.url,
    name: 'Live TV',
    title: [s.title || channel.name, notes.join(' · ')].filter(Boolean).join('\n'),
    behaviorHints: {
      notWebReady: hasHeaders,
      ...(hasHeaders ? { proxyHeaders: { request: requestHeaders } } : {}),
    },
  };
}

export function streamResponse(
  index: CatalogIndex,
  health: HealthChecker,
  stremioId: string,
): { streams: Record<string, unknown>[] } | null {
  const channelId = channelIdFromStremioId(stremioId);
  const ch = channelId ? index.byId.get(channelId) : undefined;
  if (!ch) return null;
  return { streams: health.liveStreams(ch).map((s) => streamObject(ch, s)) };
}
