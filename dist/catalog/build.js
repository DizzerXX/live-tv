/** Formats Android image loaders render reliably; SVG is used only as a last resort. */
const RASTER_FORMATS = new Set(['PNG', 'JPEG', 'WebP']);
const feedKey = (channel, feed) => `${channel}\u0000${feed}`;
function isClosed(channel, now) {
    if (!channel.closed)
        return false;
    const closedAt = Date.parse(channel.closed);
    return Number.isFinite(closedAt) && closedAt <= now.getTime();
}
function qualityRank(quality) {
    const match = quality ? /^(\d+)/.exec(quality) : null;
    return match?.[1] ? Number(match[1]) : 0;
}
function compareStreams(a, b) {
    if (a.geoBlocked !== b.geoBlocked)
        return a.geoBlocked ? 1 : -1;
    if (a.not247 !== b.not247)
        return a.not247 ? 1 : -1;
    return qualityRank(b.quality) - qualityRank(a.quality);
}
function logoScore(logo) {
    let score = 0;
    if (logo.in_use)
        score += 1000;
    if (logo.feed === null)
        score += 500;
    if (logo.format && RASTER_FORMATS.has(logo.format))
        score += 250;
    const longest = Math.max(logo.width, logo.height);
    const shortest = Math.min(logo.width, logo.height);
    if (longest > 0)
        score += Math.round((shortest / longest) * 100); // prefer near-square
    score += Math.min(longest, 1000) / 100; // tie-break on resolution
    return score;
}
function pickLogos(logos) {
    const best = new Map();
    for (const logo of logos) {
        if (!logo.url.startsWith('https://'))
            continue;
        const current = best.get(logo.channel);
        if (!current || logoScore(logo) > logoScore(current))
            best.set(logo.channel, logo);
    }
    return new Map([...best].map(([channel, logo]) => [channel, logo.url]));
}
function toStreamEntry(s) {
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
export function buildIndex(dataset, definitions, options) {
    const countries = new Map(definitions.map((d) => [d.country.code, d.country]));
    const blocked = new Set(dataset.blocklist.map((b) => b.channel));
    const eligible = new Map();
    for (const ch of dataset.channels) {
        if (!countries.has(ch.country))
            continue;
        if (ch.is_nsfw || blocked.has(ch.id) || isClosed(ch, options.now))
            continue;
        if (options.policy.isDeniedChannelName(ch.name))
            continue;
        eligible.set(ch.id, ch);
    }
    const feedLanguages = new Map();
    const mainFeed = new Map();
    for (const feed of dataset.feeds) {
        if (!eligible.has(feed.channel))
            continue;
        feedLanguages.set(feedKey(feed.channel, feed.id), feed.languages);
        if (feed.is_main)
            mainFeed.set(feed.channel, feed.id);
    }
    const streamsByChannel = new Map();
    const seenUrls = new Set();
    for (const s of dataset.streams) {
        if (!s.channel)
            continue;
        const channel = eligible.get(s.channel);
        if (!channel || seenUrls.has(s.url) || !options.policy.isAllowedStreamUrl(s.url))
            continue;
        const entry = toStreamEntry(s);
        if (options.excludeGeoBlocked && entry.geoBlocked)
            continue;
        if (options.excludeNot247 && entry.not247)
            continue;
        const requiredLanguage = countries.get(channel.country)?.language ?? null;
        if (requiredLanguage) {
            const feedId = s.feed ?? mainFeed.get(channel.id);
            const languages = feedId ? feedLanguages.get(feedKey(channel.id, feedId)) : undefined;
            // Unknown language is excluded: guessing would leak non-English feeds into English catalogs.
            if (!languages?.includes(requiredLanguage))
                continue;
        }
        seenUrls.add(s.url);
        const list = streamsByChannel.get(channel.id) ?? [];
        list.push(entry);
        streamsByChannel.set(channel.id, list);
    }
    const logos = pickLogos(dataset.logos);
    const byId = new Map();
    for (const [id, streams] of streamsByChannel) {
        const ch = eligible.get(id);
        if (!ch)
            continue;
        byId.set(id, {
            id,
            name: ch.name,
            country: ch.country,
            categories: ch.categories,
            logo: logos.get(id) ?? null,
            website: ch.website,
            streams: streams.sort(compareStreams),
        });
    }
    const sorted = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const byCatalog = new Map();
    for (const def of definitions) {
        byCatalog.set(def.id, sorted.filter((ch) => ch.country === def.country.code &&
            (def.categories === null || ch.categories.some((c) => def.categories?.has(c)))));
    }
    return { definitions, byCatalog, byId };
}
//# sourceMappingURL=build.js.map