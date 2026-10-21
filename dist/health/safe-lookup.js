/**
 * DNS lookup that refuses private, loopback, link-local and other
 * non-public addresses. Stream URLs come from third-party data, so the
 * health checker must not be usable to reach the host's internal network.
 *
 * Validation happens inside the socket's own lookup step, so the address
 * that is checked is the address that is connected to (no DNS-rebinding gap).
 */
import { lookup as dnsLookup } from 'node:dns';
import { BlockList } from 'node:net';
const blocked = new BlockList();
for (const [net, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
]) {
    blocked.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
    // IPv4-mapped addresses (::ffff:a.b.c.d) are matched against the IPv4 rules
    // by BlockList itself; an explicit ::ffff:0:0/96 rule would block all IPv4.
    ['::', 127], // unspecified + loopback
    ['64:ff9b::', 96], // NAT64
    ['fc00::', 7], // unique local
    ['fe80::', 10], // link-local
    ['ff00::', 8], // multicast
    ['2001:db8::', 32], // documentation
]) {
    blocked.addSubnet(net, prefix, 'ipv6');
}
export function isPublicAddress(address, family) {
    return !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}
export class BlockedAddressError extends Error {
    constructor(hostname) {
        super(`Refusing to connect to non-public address for ${hostname}`);
        this.name = 'BlockedAddressError';
    }
}
export const safeLookup = (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) {
            callback(err, '', 0);
            return;
        }
        const first = addresses[0];
        if (!first || addresses.some((a) => !isPublicAddress(a.address, a.family))) {
            callback(new BlockedAddressError(hostname), '', 0);
            return;
        }
        if (options.all) {
            callback(null, addresses);
        }
        else {
            callback(null, first.address, first.family);
        }
    });
};
//# sourceMappingURL=safe-lookup.js.map