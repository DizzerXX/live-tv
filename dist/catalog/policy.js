/**
 * Decides which upstream streams and channels are acceptable sources.
 */
import { isIP } from 'node:net';
import { ALLOWED_HOST_PATTERNS, ALLOWED_HOST_SUFFIXES, DENIED_CHANNEL_NAME_PATTERNS, } from '../config.js';
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
function matchesSuffix(host, suffix) {
    return host === suffix || host.endsWith(`.${suffix}`);
}
export function createSourcePolicy(extraAllowedHosts = []) {
    const suffixes = [...ALLOWED_HOST_SUFFIXES, ...extraAllowedHosts].map((s) => s.toLowerCase());
    return {
        isAllowedStreamUrl(raw) {
            let url;
            try {
                url = new URL(raw);
            }
            catch {
                return false;
            }
            if (!ALLOWED_SCHEMES.has(url.protocol))
                return false;
            if (url.username || url.password)
                return false;
            const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
            if (isIP(host) !== 0)
                return false;
            return suffixes.some((s) => matchesSuffix(host, s)) || ALLOWED_HOST_PATTERNS.some((p) => p.test(host));
        },
        isDeniedChannelName(name) {
            return DENIED_CHANNEL_NAME_PATTERNS.some((p) => p.test(name));
        },
    };
}
//# sourceMappingURL=policy.js.map