/**
 * Pure transformation from the raw iptv-org dataset into the addon's
 * catalog index. No I/O happens here, so it is fully unit-testable.
 */
import {
  EXTRA_REGION_LABEL,
  type CatalogDefinition,
  type CatalogPlan,
  type CategoryGroup,
  type OfficialPlatform,
} from '../config.js';
import type { IptvChannel, IptvDataset, IptvLogo, IptvStream } from '../iptv/types.js';
import type { SourcePolicy } from './policy.js';

export interface StreamEntry {
  readonly url: string;
  readonly title: string;
  readonly quality: string | null;
  readonly referrer: string | null;
  readonly userAgent: string | null;
  readonly geoBlocked: boolean;
  readonly not247: boolean;
}

export interface ChannelEntry {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  /** Region label from the plan (e.g. "Malaysia", "International"); drives the genre filter. */
  readonly region: string;
  readonly categories: readonly string[];
  readonly logo: string | null;
  readonly website: string | null;
  readonly streams: readonly StreamEntry[];
  /** Official platform pages that carry this channel live (opened externally). */
  readonly watchPages: readonly OfficialPlatform[];
}

export interface CatalogIndex {
  readonly definitions: readonly CatalogDefinition[];
  readonly regions: readonly string[];
  /** catalogId → region → max channels to show (after the health filter). */
  readonly limits: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly byCatalog: ReadonlyMap<string, readonly ChannelEntry[]>;
  readonly byId: ReadonlyMap<string, ChannelEntry>;
}

export interface BuildOptions {
  readonly excludeGeoBlocked: boolean;
  readonly excludeNot247: boolean;
  readonly policy: SourcePolicy;
  readonly now: Date;
}

interface ScopeRule {
  readonly region: string;
  readonly language: string | null;
  readonly fallbackGroup: CategoryGroup | null;
  /** Catalog id when the region has a catalog of its own. */
  readonly ownCatalog: string | null;
}

/** Formats Android image loaders render reliably; SVG is used only as a last resort. */
const RASTER_FORMATS = new Set(['PNG', 'JPEG', 'WebP']);

const feedKey = (channel: string, feed: string): string => `${channel}\u0000${feed}`;

function isClosed(channel: IptvChannel, now: Date): boolean {
  if (!channel.closed) return false;
  const closedAt = Date.parse(channel.closed);
  return Number.isFinite(closedAt) && closedAt <= now.getTime();
}

function qualityRank(quality: string | null): number {
  const match = quality ? /^(\d+)/.exec(quality) : null;
  return match?.[1] ? Number(match[1]) : 0;
}

function compareStreams(a: StreamEntry, b: StreamEntry): number {
  if (a.geoBlocked !== b.geoBlocked) return a.geoBlocked ? 1 : -1;
  if (a.not247 !== b.not247) return a.not247 ? 1 : -1;
  return qualityRank(b.quality) - qualityRank(a.quality);
}

function logoScore(logo: IptvLogo): number {
  let score = 0;
  if (logo.in_use) score += 1000;
  if (logo.feed === null) score += 500;
  if (logo.format && RASTER_FORMATS.has(logo.format)) score += 250;
  const longest = Math.max(logo.width, logo.height);
  const shortest = Math.min(logo.width, logo.height);
  if (longest > 0) score += Math.round((shortest / longest) * 100); // prefer near-square
  score += Math.min(longest, 1000) / 100; // tie-break on resolution
  return score;
}

function pickLogos(logos: readonly IptvLogo[]): Map<string, string> {
  const best = new Map<string, IptvLogo>();
  for (const logo of logos) {
    if (!logo.url.startsWith('https://')) continue;
    const current = best.get(logo.channel);
    if (!current || logoScore(logo) > logoScore(current)) best.set(logo.channel, logo);
  }
  return new Map([...best].map(([channel, logo]) => [channel, logo.url]));
}

function toStreamEntry(s: IptvStream): StreamEntry {
  return {
    url: s.url,
    title: s.title,
    quality: s.quality,
    referrer: s.referrer,
    userAgent: s.user_agent,
    geoBlocked: s.labels.includes('Geo-blocked'),
    not247: s.labels.includes('Not 24/7'),
  };
}

/**
 * Resolves which rule applies to a channel. A country rule wins over an
 * extra-channel rule, so pinning an in-scope channel changes nothing.
 */
function buildScopeResolver(plan: CatalogPlan): (ch: IptvChannel) => ScopeRule | undefined {
  const byCountry = new Map<string, ScopeRule>(
    plan.countries.map((c) => [
      c.code,
      { region: c.label, language: c.language, fallbackGroup: c.fallbackGroup, ownCatalog: c.ownCatalog?.id ?? null },
    ]),
  );
  const byId = new Map<string, ScopeRule>(
    plan.extras.map((e) => [e.id, { region: EXTRA_REGION_LABEL, language: e.language, fallbackGroup: null, ownCatalog: null }]),
  );
  return (ch) => byCountry.get(ch.country) ?? byId.get(ch.id);
}

function catalogsFor(categories: readonly string[], definitions: readonly CatalogDefinition[], scope: ScopeRule): string[] {
  if (scope.ownCatalog) return [scope.ownCatalog];
  const matched = definitions
    .filter((d) => d.kind === 'category' && categories.some((c) => d.categories.has(c)))
    .map((d) => d.id);
  if (matched.length > 0) return matched;
  return scope.fallbackGroup ? [scope.fallbackGroup] : [];
}

export function buildIndex(dataset: IptvDataset, plan: CatalogPlan, options: BuildOptions): CatalogIndex {
  const scopeOf = buildScopeResolver(plan);
  const blocked = new Set(dataset.blocklist.map((b) => b.channel));

  const eligible = new Map<string, { channel: IptvChannel; scope: ScopeRule }>();
  for (const ch of dataset.channels) {
    const scope = scopeOf(ch);
    if (!scope) continue;
    if (ch.is_nsfw || blocked.has(ch.id) || isClosed(ch, options.now)) continue;
    if (options.policy.isDeniedChannelName(ch.name)) continue;
    eligible.set(ch.id, { channel: ch, scope });
  }

  const feedLanguages = new Map<string, readonly string[]>();
  const mainFeed = new Map<string, string>();
  for (const feed of dataset.feeds) {
    if (!eligible.has(feed.channel)) continue;
    feedLanguages.set(feedKey(feed.channel, feed.id), feed.languages);
    if (feed.is_main) mainFeed.set(feed.channel, feed.id);
  }

  const streamsByChannel = new Map<string, StreamEntry[]>();
  const seenUrls = new Set<string>();
  for (const s of dataset.streams) {
    if (!s.channel) continue;
    const entry = eligible.get(s.channel);
    if (!entry || seenUrls.has(s.url) || !options.policy.isAllowedStreamUrl(s.url)) continue;

    const stream = toStreamEntry(s);
    if (options.excludeGeoBlocked && stream.geoBlocked) continue;
    if (options.excludeNot247 && stream.not247) continue;

    const requiredLanguage = entry.scope.language;
    if (requiredLanguage) {
      const feedId = s.feed ?? mainFeed.get(s.channel);
      const languages = feedId ? feedLanguages.get(feedKey(s.channel, feedId)) : undefined;
      // Unknown language is excluded: guessing would leak non-English feeds into English catalogs.
      if (!languages?.includes(requiredLanguage)) continue;
    }

    seenUrls.add(s.url);
    const list = streamsByChannel.get(s.channel) ?? [];
    list.push(stream);
    streamsByChannel.set(s.channel, list);
  }

  // curation key "group/region" → channel id → rank
  const curationRank = new Map<string, Map<string, number>>();
  const limits = new Map<string, Map<string, number>>();
  for (const c of plan.curations) {
    curationRank.set(`${c.group}/${c.region}`, new Map(c.ranked.map((id, i) => [id, i])));
    const perRegion = limits.get(c.group) ?? new Map<string, number>();
    perRegion.set(c.region, c.max);
    limits.set(c.group, perRegion);
  }

  const logos = pickLogos(dataset.logos);
  const byId = new Map<string, ChannelEntry>();
  const groupsById = new Map<string, string[]>();
  // Channels with a usable stream, plus channels that only have an official watch page.
  const listed = new Set([...streamsByChannel.keys(), ...[...plan.watchPages.keys()].filter((id) => eligible.has(id))]);
  for (const id of listed) {
    const entry = eligible.get(id);
    if (!entry) continue;
    const streams = streamsByChannel.get(id) ?? [];
    const watchPage = plan.watchPages.get(id);
    const { channel: ch, scope } = entry;
    // A curated region keeps only its ranked channels in that catalog.
    const groups = catalogsFor(ch.categories, plan.definitions, scope).filter((group) => {
      const ranks = curationRank.get(`${group}/${scope.region}`);
      return ranks === undefined || ranks.has(id);
    });
    // Not in any catalog: drop it so the health checker doesn't probe unused streams.
    if (groups.length === 0) continue;
    groupsById.set(id, groups);
    byId.set(id, {
      id,
      name: ch.name,
      country: ch.country,
      region: scope.region,
      categories: ch.categories,
      logo: logos.get(id) ?? null,
      website: ch.website,
      streams: streams.sort(compareStreams),
      watchPages: watchPage ? [watchPage] : [],
    });
  }

  const byCatalog = new Map<string, ChannelEntry[]>(plan.definitions.map((d) => [d.id, []]));
  for (const ch of byId.values()) {
    for (const group of groupsById.get(ch.id) ?? []) byCatalog.get(group)?.push(ch);
  }

  // Local regions first (plan order); inside a curated region, rank order; otherwise alphabetical.
  const regionRank = new Map(plan.regions.map((r, i) => [r, i]));
  const rankOfRegion = (r: string): number => regionRank.get(r) ?? Number.MAX_SAFE_INTEGER;
  for (const [group, list] of byCatalog) {
    list.sort((a, b) => {
      const byRegion = rankOfRegion(a.region) - rankOfRegion(b.region);
      if (byRegion !== 0) return byRegion;
      const ranks = curationRank.get(`${group}/${a.region}`);
      if (ranks) return (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0);
      return a.name.localeCompare(b.name, 'en');
    });
  }

  return { definitions: plan.definitions, regions: plan.regions, limits, byCatalog, byId };
}
