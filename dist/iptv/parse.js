const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
const optStr = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
const strArray = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
function parseArray(raw, label, parseItem) {
    if (!Array.isArray(raw))
        throw new Error(`iptv-org ${label}: expected a JSON array`);
    const out = [];
    for (const item of raw) {
        if (!isRecord(item))
            continue;
        const parsed = parseItem(item);
        if (parsed !== null)
            out.push(parsed);
    }
    return out;
}
export const parseChannels = (raw) => parseArray(raw, 'channels', (r) => {
    const id = str(r.id);
    const name = str(r.name);
    const country = str(r.country);
    if (!id || !name || !country)
        return null;
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
export const parseFeeds = (raw) => parseArray(raw, 'feeds', (r) => {
    const channel = str(r.channel);
    const id = str(r.id);
    if (!channel || !id)
        return null;
    return { channel, id, is_main: r.is_main === true, languages: strArray(r.languages) };
});
export const parseStreams = (raw) => parseArray(raw, 'streams', (r) => {
    const url = str(r.url);
    if (!url)
        return null;
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
export const parseLogos = (raw) => parseArray(raw, 'logos', (r) => {
    const channel = str(r.channel);
    const url = str(r.url);
    if (!channel || !url)
        return null;
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
export const parseBlocklist = (raw) => parseArray(raw, 'blocklist', (r) => {
    const channel = str(r.channel);
    if (!channel)
        return null;
    return { channel, reason: str(r.reason) ?? 'unknown' };
});
//# sourceMappingURL=parse.js.map