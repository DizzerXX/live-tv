/**
 * Minimal HTTP transport for the Stremio addon protocol, built on node:http
 * so the runtime has zero third-party dependencies.
 */
import { createServer } from 'node:http';
import { buildManifest, catalogResponse, CONTENT_TYPE, metaResponse, parseExtra, streamResponse, } from './addon/protocol.js';
import { errorMessage, log } from './util/log.js';
const CATALOG_RE = /^\/catalog\/([^/]+)\/([^/]+?)(?:\/([^/]+))?\.json$/;
const META_RE = /^\/meta\/([^/]+)\/([^/]+)\.json$/;
const STREAM_RE = /^\/stream\/([^/]+)\/([^/]+)\.json$/;
const MAX_PATH_LENGTH = 1024;
/** How long a data request may wait for the initial load after a cold start. */
const FIRST_LOAD_WAIT_MS = 25_000;
const DATA_PATH_RE = /^\/(?:catalog|meta|stream)\//;
const BASE_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': '*',
    'x-content-type-options': 'nosniff',
};
const notFound = { status: 404, body: { error: 'not found' }, maxAge: 0 };
const notReady = { status: 503, body: { error: 'index not loaded yet' }, maxAge: 0 };
function decodeSegment(segment) {
    try {
        return decodeURIComponent(segment);
    }
    catch {
        return null;
    }
}
function route(path, state, version) {
    if (path === '/' || path === '/manifest.json') {
        return { status: 200, body: buildManifest(state.definitions, version), maxAge: 3600 };
    }
    if (path === '/health') {
        return { status: 200, body: { refresh: state.status, streams: state.health.summary }, maxAge: 0 };
    }
    const index = state.index;
    let m;
    if ((m = CATALOG_RE.exec(path))) {
        if (m[1] !== CONTENT_TYPE)
            return notFound;
        if (!index)
            return notReady;
        const catalogId = decodeSegment(m[2] ?? '');
        const extraSegment = m[3] === undefined ? undefined : decodeSegment(m[3]);
        if (catalogId === null || extraSegment === null)
            return notFound;
        const body = catalogResponse(index, state.health, catalogId, parseExtra(extraSegment));
        return body ? { status: 200, body, maxAge: 1800 } : notFound;
    }
    if ((m = META_RE.exec(path))) {
        if (m[1] !== CONTENT_TYPE)
            return notFound;
        if (!index)
            return notReady;
        const id = decodeSegment(m[2] ?? '');
        const body = id ? metaResponse(index, id) : null;
        return body ? { status: 200, body, maxAge: 3600 } : notFound;
    }
    if ((m = STREAM_RE.exec(path))) {
        if (m[1] !== CONTENT_TYPE)
            return notFound;
        if (!index)
            return notReady;
        const id = decodeSegment(m[2] ?? '');
        const body = id ? streamResponse(index, state.health, id) : null;
        return body ? { status: 200, body, maxAge: 600 } : notFound;
    }
    return notFound;
}
function send(req, res, result) {
    const payload = JSON.stringify(result.body);
    res.writeHead(result.status, {
        ...BASE_HEADERS,
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(payload),
        'cache-control': result.maxAge > 0 ? `public, max-age=${result.maxAge}` : 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : payload);
}
export function createAddonServer(state, version) {
    return createServer(async (req, res) => {
        try {
            if (req.method === 'OPTIONS') {
                res.writeHead(204, BASE_HEADERS);
                res.end();
                return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                send(req, res, { status: 405, body: { error: 'method not allowed' }, maxAge: 0 });
                return;
            }
            const rawUrl = req.url ?? '/';
            if (rawUrl.length > MAX_PATH_LENGTH) {
                send(req, res, { status: 414, body: { error: 'uri too long' }, maxAge: 0 });
                return;
            }
            const path = new URL(rawUrl, 'http://localhost').pathname;
            if (!state.index && DATA_PATH_RE.test(path)) {
                await state.waitForFirstLoad(FIRST_LOAD_WAIT_MS);
                if (res.destroyed)
                    return; // client gave up while waiting
            }
            send(req, res, route(path, state, version));
        }
        catch (err) {
            log('error', 'request failed', { url: req.url, error: errorMessage(err) });
            if (!res.headersSent)
                send(req, res, { status: 500, body: { error: 'internal error' }, maxAge: 0 });
            else
                res.destroy();
        }
    });
}
//# sourceMappingURL=server.js.map