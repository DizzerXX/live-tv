/**
 * Static catalog definitions and runtime configuration.
 *
 * There is one catalog per category group (Sports, News, …), each combining
 * every region. Regions are offered as the catalog's "genre" filter, which
 * Nuvio shows as a dropdown on the Discover screen.
 */

export type CategoryGroup = 'sports' | 'news' | 'movies' | 'entertainment' | 'kids';

/** Catalog order in the manifest (and in Nuvio's home rows). */
export const CATEGORY_GROUP_ORDER: readonly CategoryGroup[] = ['sports', 'news', 'movies', 'entertainment', 'kids'];

/** iptv-org category IDs that make up each group. */
export const CATEGORY_GROUPS: Readonly<Record<CategoryGroup, readonly string[]>> = {
  sports: ['sports'],
  news: ['news', 'business', 'weather'],
  movies: ['movies', 'classic'],
  entertainment: ['entertainment', 'general', 'series', 'comedy', 'lifestyle'],
  kids: ['kids', 'animation', 'family'],
};

const GROUP_LABELS: Readonly<Record<CategoryGroup, string>> = {
  sports: 'Sports',
  news: 'News',
  movies: 'Movies',
  entertainment: 'Entertainment',
  kids: 'Kids',
};

export interface CountryRule {
  /** iptv-org country code (note: iptv-org uses "UK", not "GB"). */
  readonly code: string;
  /** Region label shown in the genre filter. */
  readonly label: string;
  /** ISO 639-3 language a stream's feed must carry, or null for any language. */
  readonly language: string | null;
  /**
   * Where channels go when none of their categories match a group.
   * null = such channels are left out.
   */
  readonly fallbackGroup: CategoryGroup | null;
  /**
   * Give this region a catalog of its own (every channel, any category)
   * instead of spreading it across the category catalogs.
   */
  readonly ownCatalog: { readonly id: string; readonly name: string } | null;
}

/** Order here is also the sort order inside each catalog (local channels first). */
export const COUNTRY_RULES: readonly CountryRule[] = [
  // Every Malaysian channel, in its own catalog.
  { code: 'MY', label: 'Malaysia', language: null, fallbackGroup: null, ownCatalog: { id: 'malaysia', name: 'Malaysia' } },
  // "All Singapore channels": anything uncategorised lands in Entertainment.
  { code: 'SG', label: 'Singapore', language: 'eng', fallbackGroup: 'entertainment', ownCatalog: null },
  { code: 'UK', label: 'UK', language: 'eng', fallbackGroup: null, ownCatalog: null },
  { code: 'US', label: 'USA', language: 'eng', fallbackGroup: null, ownCatalog: null },
];

/**
 * Individual channels added from any country, by iptv-org channel ID (shown on
 * each channel page at https://iptv-org.github.io, e.g. "AlJazeera.qa"). They
 * join the catalogs matching their categories and appear under the
 * "International" region. They still pass the allowlist, denylist and health check.
 */
export interface ExtraChannelRule {
  readonly id: string;
  /** ISO 639-3 language a stream's feed must carry, or null for any language. */
  readonly language: string | null;
}

export const EXTRA_REGION_LABEL = 'International';

export const EXTRA_CHANNELS: readonly ExtraChannelRule[] = [
  // International English news
  { id: 'AlJazeera.qa', language: 'eng' },
  { id: 'DW.de', language: 'eng' },
  { id: 'France24.fr', language: 'eng' },
  { id: 'EuronewsEnglish.fr', language: 'eng' },
  { id: 'CBCNewsNetwork.ca', language: 'eng' },
  { id: 'ABCNews.au', language: 'eng' },
  { id: 'NHKWorldJapan.jp', language: 'eng' }, // only allowed stream is flagged geo-blocked
  { id: 'WION.in', language: 'eng' },
  { id: 'IndiaToday.in', language: 'eng' },
  { id: 'ArirangTV.kr', language: 'eng' },
  { id: 'CGTN.cn', language: 'eng' },
  { id: 'i24NEWSEnglishWorld.il', language: 'eng' },
  { id: 'AfricanewsEnglish.fr', language: 'eng' },
];

/**
 * Official broadcaster platforms. Channels mapped below get a "Watch on …"
 * entry that opens the platform in a browser (Stremio `externalUrl`). This is
 * how channels with no usable direct stream are still listed, and a fallback
 * for those that have one. Nothing is played through the addon for these.
 */
export interface OfficialPlatform {
  readonly name: string;
  readonly url: string;
  /** Shown under the entry, e.g. that an account may be needed. */
  readonly note: string | null;
}

const RTMKLIK: OfficialPlatform = { name: 'RTMKlik', url: 'https://rtmklik.rtm.gov.my/', note: null };
const MANA_MANA: OfficialPlatform = { name: 'MYTV Mana-Mana', url: 'https://www.mana2.my/live-tv', note: null };
const TONTON: OfficialPlatform = { name: 'Tonton', url: 'https://watch.tonton.com.my/', note: 'may require a free account' };

/**
 * iptv-org channel ID → official platform carrying it live for free.
 * Lineups are from the platforms' published channel lists (2024); check and
 * update when a platform changes its line-up. A mapped channel is listed even
 * without a direct stream. Every other filter (denylist, iptv-org's DMCA
 * blocklist, closed channels) still applies, which is why Astro's free sooka
 * channels are not here: Astro had them removed from iptv-org.
 */
export const OFFICIAL_WATCH_PAGES: Readonly<Record<string, OfficialPlatform>> = {
  // RTM
  'TV1.my': RTMKLIK,
  'TV2.my': RTMKLIK,
  'Okey.my': RTMKLIK,
  'BeritaRTM.my': RTMKLIK,
  'SukanPlus.my': RTMKLIK,
  'RTMParlimenDewanRakyat.my': RTMKLIK,
  // Media Prima
  'TV3.my': TONTON,
  '8TV.my': TONTON,
  'NTV7.my': TONTON,
  'TV9.my': TONTON,
  'DramaSangat.my': TONTON,
  // MYTV Mana-Mana
  'TVAlhijrah.my': MANA_MANA,
  'BernamaTV.my': MANA_MANA,
  'TVS.my': MANA_MANA,
  'TVIKIM.my': MANA_MANA,
  'SelangorTV.my': MANA_MANA,
};

/**
 * Restricts one region inside one catalog to a hand-picked, ranked list.
 * The first `max` channels in `ranked` that currently have a live stream are
 * shown, so entries beyond `max` act as backups. iptv-org has no popularity
 * data; the order is an editorial choice.
 */
export interface RegionCuration {
  readonly group: CategoryGroup;
  /** Region label, e.g. "USA". */
  readonly region: string;
  readonly max: number;
  /** iptv-org channel IDs in priority order. */
  readonly ranked: readonly string[];
}

/** Maximum US channels per catalog. Ranked entries past this are backups. */
const US_TOP_N = 15;

export const REGION_CURATIONS: readonly RegionCuration[] = [
  {
    group: 'sports',
    region: 'USA',
    max: US_TOP_N,
    ranked: [
      'NFLChannel.us',
      'MLB.us',
      'NHLNetwork.us',
      'PGATour.us',
      'TennisChannel.us',
      'CBSSportsHQ.us',
      'NBCSportsNOW.us',
      'CBSSportsGolazoNetwork.us',
      'FuboSportsNetwork.us',
      'ESPN8TheOcho.us',
      'Stadium.us',
      'beINSPORTSXTRA.us',
      'BellatorMMA.us',
      'PFLMMA.us',
      'WillowSports.us',
      // Backups:
      'SportsGrid.us',
      'DraftKingsNetwork.us',
      'RallyTV.us',
    ],
  },
  {
    group: 'news',
    region: 'USA',
    max: US_TOP_N,
    ranked: [
      'CBSNews247.us',
      'ABCNewsLive.us',
      'NBCNewsNOW.us',
      'LiveNOWfromFOX.us',
      'CNNInternational.us',
      'BloombergTV.us',
      'ReutersTV.us',
      'ScrippsNews.us',
      'NewsmaxTV.us',
      'YahooFinance.us',
      'TODAYAllDay.us',
      'USATODAY.us',
      'FoxWeather.us',
      'AccuWeatherNOW.us',
      'CheddarNews.us',
      // Backups:
      'Newsy.us',
      'WeatherNation.us',
      'BloombergOriginals.us',
    ],
  },
  {
    group: 'movies',
    region: 'USA',
    max: US_TOP_N,
    ranked: [
      'ParamountMovieChannel.us',
      'HallmarkMoviesMore.us',
      'MovieSphere.us',
      'PlutoTVActionMovies.us',
      'PlutoTVComedyMovies.us',
      'PlutoTVDramaMovies.us',
      'PlutoTVThrillers.us',
      'PlutoTVHorror.us',
      'PlutoTVRomance.us',
      'PlutoTVSciFi.us',
      'PlutoTVWesterns.us',
      'BETCinema.us',
      'GravitasMovies.us',
      'TheFilmDetective.us',
      '24HourFreeMovies.us',
      // Backups:
      'PlutoTVCrimeMovies.us',
      'FrightFlix.us',
      'ClassicMoviesChannel.us',
    ],
  },
  {
    group: 'entertainment',
    region: 'USA',
    max: US_TOP_N,
    ranked: [
      'ABC.us',
      'CBS.us',
      'NBC.us',
      'Fox.us',
      'ComedyCentral.us',
      'MeTV.us',
      'MTVPlutoTV.us',
      'EntertainmentTonight.us',
      'TMZ.us',
      'NCIS.us',
      'StarTrek.us',
      'TheWalkingDeadUniverse.us',
      'SouthPark.us',
      'Survivor.us',
      'ThePriceIsRight.us',
      // Backups:
      'Buzzr.us',
      'Comet.us',
      'IONTV.us', // only stream is flagged geo-blocked
    ],
  },
  {
    group: 'kids',
    region: 'USA',
    max: US_TOP_N,
    ranked: [
      'NickelodeonPlutoTV.us',
      'NickJrPlutoTV.us',
      'Nicktoons.us',
      'SpongeBobSquarePants.us',
      'PBSKids.us',
      'DoraTV.us',
      'PeppaPig.us',
      'BabySharkTV.us',
      'LEGOKidsTV.us',
      'SonicTV.us',
      'TransformersTV.us',
      'SmurfTV.us',
      'Crunchyroll.us',
      'RyanandFriends.us',
      'GarfieldandFriends.us',
      // Backups:
      'PlutoTVAnime.us',
      'KartoonChannel.us',
      'SuperSimpleSongs.us',
    ],
  },
];

/**
 * iptv-org mixes official streams with unauthorised restreams. Only streams
 * served from these hosts (exact match or subdomain) are kept. Raw IP hosts
 * are always rejected. Extend at runtime with EXTRA_ALLOWED_HOSTS.
 *
 * Generic CDNs (akamaized.net, cloudfront.net) are included because most
 * broadcasters and FAST services use them; that is also why the name
 * denylist below exists as a second layer.
 */
export const ALLOWED_HOST_SUFFIXES: readonly string[] = [
  // FAST / free OTT platforms and playout providers
  'jmp2.uk', // redirector for Samsung TV Plus, Pluto TV, Plex and Roku free channels
  'plex.tv',
  'samsungtvplus.com',
  'amagi.tv',
  'wurl.tv',
  'wurl.com',
  'tubi.video',
  'frequency.stream',
  'getpublica.com',
  'ottera.tv',
  'otteravision.com',
  'its-newid.net',
  'sofast.tv',
  'cinedigm.com',
  'simplestreamcdn.com',
  'transmit.live',
  'zype.com',
  'vgcdn.net',
  'uplynk.com',
  // Broadcaster-owned delivery
  'bbci.co.uk',
  's4c-cdn.co.uk',
  'cbsnews.com',
  'cbsivideo.com',
  'nbcuni.com',
  'bloomberg.com',
  'pbs.org',
  'pbskids.org',
  'sinclairstoryline.com',
  'field59.com',
  'ntdtv.com',
  // Video platforms and enterprise CDNs
  'brightcove.com',
  'jwplayer.com',
  'jwplive.com',
  'kaltura.com',
  'akamaized.net',
  'cloudfront.net',
  'live-video.net',
  // US public-access and government channels
  'cablecast.tv',
  'telvue.com',
  'swagit.com',
  'dc.gov',
  'ct-n.com',
];

/** AWS Elemental MediaTailor / MediaPackage endpoints (used by FAST channels). */
export const ALLOWED_HOST_PATTERNS: readonly RegExp[] = [
  /\.(?:mediatailor|mediapackage)\.[a-z0-9-]+\.amazonaws\.com$/,
];

/** Pay-TV brands that occasionally appear on allowed CDNs via unofficial uploads. */
export const DENIED_CHANNEL_NAME_PATTERNS: readonly RegExp[] = [
  /\bHBO\b/i,
  /\bCinemax\b/i,
  /\bSky (?:Sports|Cinema|Atlantic|Max|Showcase)\b/i,
  /\bTNT Sports\b/i,
  /\bStarPlus\b/i,
  /\bNBA TV\b/i,
  /\bAstro\b/i,
  /\bbeIN SPORTS\b(?! XTRA)/i,
];

export type CatalogDefinition =
  | {
      readonly kind: 'category';
      /** Equal to the category group, e.g. "sports". */
      readonly id: CategoryGroup;
      readonly name: string;
      readonly categories: ReadonlySet<string>;
      /** Regions offered in this catalog's genre filter. */
      readonly genreOptions: readonly string[];
    }
  | {
      readonly kind: 'region';
      readonly id: string;
      readonly name: string;
      /** Region label whose channels fill this catalog. */
      readonly region: string;
      readonly genreOptions: readonly string[];
    };

/** Everything that decides catalog membership, bundled for buildIndex. */
export interface CatalogPlan {
  readonly definitions: readonly CatalogDefinition[];
  readonly countries: readonly CountryRule[];
  readonly extras: readonly ExtraChannelRule[];
  /** Region labels in display/sort order; used as the genre filter options. */
  readonly regions: readonly string[];
  readonly curations: readonly RegionCuration[];
  readonly watchPages: ReadonlyMap<string, OfficialPlatform>;
}

export function buildCatalogPlan(
  countries: readonly CountryRule[] = COUNTRY_RULES,
  extras: readonly ExtraChannelRule[] = EXTRA_CHANNELS,
  curations: readonly RegionCuration[] = REGION_CURATIONS,
  watchPages: Readonly<Record<string, OfficialPlatform>> = OFFICIAL_WATCH_PAGES,
): CatalogPlan {
  for (const [id, platform] of Object.entries(watchPages)) {
    if (!platform.url.startsWith('https://')) throw new Error(`Watch page for "${id}" must be an https URL`);
  }
  const codes = countries.map((c) => c.code);
  const dupCountry = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dupCountry) throw new Error(`Duplicate country rule "${dupCountry}"`);
  const extraIds = extras.map((e) => e.id);
  const dupExtra = extraIds.find((id, i) => extraIds.indexOf(id) !== i);
  if (dupExtra) throw new Error(`Duplicate extra channel "${dupExtra}"`);

  const regions = [...countries.map((c) => c.label), ...(extras.length > 0 ? [EXTRA_REGION_LABEL] : [])];
  const curationKeys = new Set<string>();
  for (const c of curations) {
    if (!regions.includes(c.region)) throw new Error(`Curation region "${c.region}" is not a configured region`);
    if (!Number.isInteger(c.max) || c.max < 1) throw new Error(`Curation max must be a positive integer`);
    const key = `${c.group}/${c.region}`;
    if (curationKeys.has(key)) throw new Error(`Duplicate curation for ${key}`);
    curationKeys.add(key);
  }

  const ownRegions = new Set(countries.filter((c) => c.ownCatalog).map((c) => c.label));
  const sharedRegions = regions.filter((r) => !ownRegions.has(r));

  // Region catalogs first (local first), then the shared category catalogs.
  const regionCatalogs: CatalogDefinition[] = countries.flatMap((c) =>
    c.ownCatalog
      ? [{ kind: 'region' as const, id: c.ownCatalog.id, name: c.ownCatalog.name, region: c.label, genreOptions: [] }]
      : [],
  );
  const categoryCatalogs: CatalogDefinition[] = CATEGORY_GROUP_ORDER.map((group) => ({
    kind: 'category' as const,
    id: group,
    name: GROUP_LABELS[group],
    categories: new Set(CATEGORY_GROUPS[group]),
    genreOptions: sharedRegions,
  }));

  const definitions = [...regionCatalogs, ...categoryCatalogs];
  const ids = definitions.map((d) => d.id);
  const dupId = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupId) throw new Error(`Duplicate catalog id "${dupId}"`);
  for (const c of curations) {
    if (ownRegions.has(c.region)) throw new Error(`Curation region "${c.region}" has its own catalog`);
  }

  return { definitions, countries, extras, regions, curations, watchPages: new Map(Object.entries(watchPages)) };
}

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly iptvApiBase: string;
  /** Load iptv-org JSON from a local directory instead of the network. */
  readonly iptvDataDir: string | null;
  readonly refreshIntervalMs: number;
  readonly healthcheck: {
    readonly enabled: boolean;
    readonly concurrency: number;
    readonly timeoutMs: number;
  };
  readonly excludeGeoBlocked: boolean;
  readonly excludeNot247: boolean;
  readonly extraAllowedHosts: readonly string[];
}

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function hostListFromEnv(name: string): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return [];
  return raw.split(',').map((entry) => {
    const host = entry.trim().toLowerCase();
    if (!HOSTNAME_PATTERN.test(host)) throw new Error(`${name}: "${entry}" is not a valid hostname`);
    return host;
  });
}

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}"`);
  }
  return value;
}

function boolFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`${name} must be true/false, got "${raw}"`);
}

function httpsBaseFromEnv(name: string, fallback: string): string {
  const raw = process.env[name]?.trim() || fallback;
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error(`${name} must be an https URL`);
  return url.href.replace(/\/+$/, '');
}

export function loadConfig(): AppConfig {
  return {
    host: process.env.HOST?.trim() || '0.0.0.0',
    port: intFromEnv('PORT', 7000, 1, 65535),
    iptvApiBase: httpsBaseFromEnv('IPTV_API_BASE', 'https://iptv-org.github.io/api'),
    iptvDataDir: process.env.IPTV_DATA_DIR?.trim() || null,
    refreshIntervalMs: intFromEnv('REFRESH_INTERVAL_MINUTES', 360, 15, 10_080) * 60_000,
    healthcheck: {
      enabled: boolFromEnv('HEALTHCHECK_ENABLED', true),
      concurrency: intFromEnv('HEALTHCHECK_CONCURRENCY', 8, 1, 64),
      timeoutMs: intFromEnv('HEALTHCHECK_TIMEOUT_MS', 8000, 1000, 60_000),
    },
    excludeGeoBlocked: boolFromEnv('EXCLUDE_GEO_BLOCKED', false),
    excludeNot247: boolFromEnv('EXCLUDE_NOT_24_7', false),
    extraAllowedHosts: hostListFromEnv('EXTRA_ALLOWED_HOSTS'),
  };
}
