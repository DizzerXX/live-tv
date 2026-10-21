/**
 * Loads the iptv-org dataset from the public API or a local directory.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseBlocklist, parseChannels, parseFeeds, parseLogos, parseStreams } from './parse.js';
const FILES = ['channels', 'feeds', 'streams', 'logos', 'blocklist'];
/** Upper bound per file; the largest (feeds/channels) is ~8 MB today. */
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;
async function fetchJson(url) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'application/json' },
    });
    if (!res.ok)
        throw new Error(`GET ${url} failed: HTTP ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_FILE_BYTES)
        throw new Error(`GET ${url}: response too large (${declared} bytes)`);
    const text = await res.text();
    if (text.length > MAX_FILE_BYTES)
        throw new Error(`GET ${url}: response too large`);
    return JSON.parse(text);
}
async function readJson(path) {
    return JSON.parse(await readFile(path, 'utf8'));
}
function assemble(raw) {
    return {
        channels: parseChannels(raw.channels),
        feeds: parseFeeds(raw.feeds),
        streams: parseStreams(raw.streams),
        logos: parseLogos(raw.logos),
        blocklist: parseBlocklist(raw.blocklist),
    };
}
async function loadAll(read) {
    const entries = await Promise.all(FILES.map(async (f) => [f, await read(f)]));
    return assemble(Object.fromEntries(entries));
}
export function remoteSource(baseUrl) {
    return {
        description: baseUrl,
        load: () => loadAll((f) => fetchJson(`${baseUrl}/${f}.json`)),
    };
}
export function localSource(dir) {
    return {
        description: `local:${dir}`,
        load: () => loadAll((f) => readJson(join(dir, `${f}.json`))),
    };
}
//# sourceMappingURL=source.js.map