/**
 * Single-stream liveness probe. Sends a GET, reads only the status line,
 * then drops the connection.
 */
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { isPublicAddress, safeLookup } from './safe-lookup.js';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
/**
 * 401/403/429/451 usually mean "blocked from where the server is" (geo or
 * rate limiting), not "dead", so they stay visible.
 */
export function classifyStatus(status) {
    if (status >= 200 && status < 400)
        return 'alive';
    if ([401, 403, 429, 451].includes(status))
        return 'unknown';
    return 'dead';
}
export function probeStream(stream, timeoutMs) {
    let url;
    try {
        url = new URL(stream.url);
    }
    catch {
        return Promise.resolve('dead');
    }
    const request = url.protocol === 'https:' ? httpsRequest : url.protocol === 'http:' ? httpRequest : null;
    if (!request)
        return Promise.resolve('dead');
    // Node skips the custom `lookup` for IP-literal hosts, so check those here.
    const literal = url.hostname.replace(/^\[|\]$/g, '');
    const family = isIP(literal);
    if (family !== 0 && !isPublicAddress(literal, family))
        return Promise.resolve('dead');
    const headers = {
        'user-agent': stream.userAgent ?? DEFAULT_USER_AGENT,
        accept: '*/*',
    };
    if (stream.referrer)
        headers.referer = stream.referrer;
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            req.destroy();
            resolve(result);
        };
        const req = request(url, { method: 'GET', headers, lookup: safeLookup, timeout: timeoutMs }, (res) => {
            finish(classifyStatus(res.statusCode ?? 0));
            res.destroy();
        });
        req.on('timeout', () => finish('dead'));
        req.on('error', () => finish('dead'));
        req.end();
    });
}
//# sourceMappingURL=probe.js.map