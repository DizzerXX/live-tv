/**
 * Static catalog definitions and runtime configuration.
 *
 * Catalog membership is driven by iptv-org category IDs. Edit
 * CATEGORY_GROUPS or COUNTRY_RULES to change what each catalog contains.
 */
/** iptv-org category IDs that make up each group. */
export const CATEGORY_GROUPS = {
    sports: ['sports'],
    news: ['news', 'business', 'weather'],
    movies: ['movies', 'classic'],
    entertainment: ['entertainment', 'general', 'series', 'comedy', 'lifestyle'],
    kids: ['kids', 'animation', 'family'],
};
const GROUP_LABELS = {
    sports: 'Sports',
    news: 'News',
    movies: 'Movies',
    entertainment: 'Entertainment',
    kids: 'Kids',
};
export const COUNTRY_RULES = [
    { code: 'MY', label: 'Malaysia', language: null, groups: 'all' },
    { code: 'SG', label: 'Singapore', language: 'eng', groups: 'all' },
    {
        code: 'UK',
        label: 'UK',
        language: 'eng',
        groups: ['sports', 'news', 'movies', 'entertainment', 'kids'],
    },
    {
        code: 'US',
        label: 'USA',
        language: 'eng',
        groups: ['sports', 'news', 'movies', 'entertainment', 'kids'],
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
export const ALLOWED_HOST_SUFFIXES = [
    // FAST / free OTT platforms and playout providers
    'jmp2.uk', // redirector for Samsung TV Plus, Pluto TV, Plex and Roku free channels
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
export const ALLOWED_HOST_PATTERNS = [
    /\.(?:mediatailor|mediapackage)\.[a-z0-9-]+\.amazonaws\.com$/,
];
/** Pay-TV brands that occasionally appear on allowed CDNs via unofficial uploads. */
export const DENIED_CHANNEL_NAME_PATTERNS = [
    /\bHBO\b/i,
    /\bCinemax\b/i,
    /\bSky (?:Sports|Cinema|Atlantic|Max|Showcase)\b/i,
    /\bTNT Sports\b/i,
    /\bStarPlus\b/i,
    /\bNBA TV\b/i,
    /\bAstro\b/i,
    /\bbeIN SPORTS\b(?! XTRA)/i,
];
export function buildCatalogDefinitions(rules = COUNTRY_RULES) {
    return rules.flatMap((rule) => {
        const prefix = rule.code.toLowerCase();
        if (rule.groups === 'all') {
            const suffix = rule.language === 'eng' ? 'English' : 'All Channels';
            return [{ id: `${prefix}-all`, name: `${rule.label} ${suffix}`, country: rule, categories: null }];
        }
        return rule.groups.map((group) => ({
            id: `${prefix}-${group}`,
            name: `${rule.label} ${GROUP_LABELS[group]}`,
            country: rule,
            categories: new Set(CATEGORY_GROUPS[group]),
        }));
    });
}
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
function hostListFromEnv(name) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return [];
    return raw.split(',').map((entry) => {
        const host = entry.trim().toLowerCase();
        if (!HOSTNAME_PATTERN.test(host))
            throw new Error(`${name}: "${entry}" is not a valid hostname`);
        return host;
    });
}
function intFromEnv(name, fallback, min, max) {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '')
        return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}"`);
    }
    return value;
}
function boolFromEnv(name, fallback) {
    const raw = process.env[name]?.trim().toLowerCase();
    if (raw === undefined || raw === '')
        return fallback;
    if (raw === 'true' || raw === '1')
        return true;
    if (raw === 'false' || raw === '0')
        return false;
    throw new Error(`${name} must be true/false, got "${raw}"`);
}
function httpsBaseFromEnv(name, fallback) {
    const raw = process.env[name]?.trim() || fallback;
    const url = new URL(raw);
    if (url.protocol !== 'https:')
        throw new Error(`${name} must be an https URL`);
    return url.href.replace(/\/+$/, '');
}
export function loadConfig() {
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
//# sourceMappingURL=config.js.map