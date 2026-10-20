/**
 * Minimal HTTP transport for the Stremio addon protocol, built on node:http
 * so the runtime has zero third-party dependencies.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  buildManifest,
  catalogResponse,
  CONTENT_TYPE,
  metaResponse,
  parseExtra,
  streamResponse,
} from './addon/protocol.js';
import type { AddonState } from './state.js';
import { errorMessage, log } from './util/log.js';

const CATALOG_RE = /^\/catalog\/([^/]+)\/([^/]+?)(?:\/([^/]+))?\.json$/;
const META_RE = /^\/meta\/([^/]+)\/([^/]+)\.json$/;
const STREAM_RE = /^\/stream\/([^/]+)\/([^/]+)\.json$/;
const MAX_PATH_LENGTH = 1024;

const BASE_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': '*',
  'x-content-type-options': 'nosniff',
} as const;

interface JsonResult {
  readonly status: number;
  readonly body: unknown;
  /** Seconds clients and proxies may cache the response. */
  readonly maxAge: number;
}

const notFound: JsonResult = { status: 404, body: { error: 'not found' }, maxAge: 0 };
const notReady: JsonResult = { status: 503, body: { error: 'index not loaded yet' }, maxAge: 0 };

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function route(path: string, state: AddonState, version: string): JsonResult {
  if (path === '/' || path === '/manifest.json') {
    return { status: 200, body: buildManifest(state.definitions, version), maxAge: 3600 };
  }
  if (path === '/health') {
    return { status: 200, body: { refresh: state.status, streams: state.health.summary }, maxAge: 0 };
  }

  const index = state.index;
  let m: RegExpExecArray | null;

  if ((m = CATALOG_RE.exec(path))) {
    if (m[1] !== CONTENT_TYPE) return notFound;
    if (!index) return notReady;
    const catalogId = decodeSegment(m[2] ?? '');
    const extraSegment = m[3] === undefined ? undefined : decodeSegment(m[3]);
    if (catalogId === null || extraSegment === null) return notFound;
    const body = catalogResponse(index, state.health, catalogId, parseExtra(extraSegment));
    return body ? { status: 200, body, maxAge: 1800 } : notFound;
  }

  if ((m = META_RE.exec(path))) {
    if (m[1] !== CONTENT_TYPE) return notFound;
    if (!index) return notReady;
    const id = decodeSegment(m[2] ?? '');
    const body = id ? metaResponse(index, id) : null;
    return body ? { status: 200, body, maxAge: 3600 } : notFound;
  }

  if ((m = STREAM_RE.exec(path))) {
    if (m[1] !== CONTENT_TYPE) return notFound;
    if (!index) return notReady;
    const id = decodeSegment(m[2] ?? '');
    const body = id ? streamResponse(index, state.health, id) : null;
    return body ? { status: 200, body, maxAge: 600 } : notFound;
  }

  return notFound;
}

function send(req: IncomingMessage, res: ServerResponse, result: JsonResult): void {
  const payload = JSON.stringify(result.body);
  res.writeHead(result.status, {
    ...BASE_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': result.maxAge > 0 ? `public, max-age=${result.maxAge}` : 'no-store',
  });
  res.end(req.method === 'HEAD' ? undefined : payload);
}

export function createAddonServer(state: AddonState, version: string): Server {
  return createServer((req, res) => {
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
      send(req, res, route(path, state, version));
    } catch (err) {
      log('error', 'request failed', { url: req.url, error: errorMessage(err) });
      if (!res.headersSent) send(req, res, { status: 500, body: { error: 'internal error' }, maxAge: 0 });
      else res.destroy();
    }
  });
}
