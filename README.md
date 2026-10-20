# Nuvio Live TV Addon

A Stremio-protocol addon that gives Nuvio 12 live TV catalogs. The channels come from the
[iptv-org](https://github.com/iptv-org/api) public stream index, filtered down to official
broadcaster and FAST (free ad-supported) sources.

## Catalogs

| Catalog | Rule |
|---|---|
| Malaysia All Channels | Country `MY`, any language, any category |
| Singapore English | Country `SG`, English feeds, any category |
| UK Sports / News / Movies / Entertainment / Kids | Country `UK`, English feeds |
| USA Sports / News / Movies / Entertainment / Kids | Country `US`, English feeds |

Category groups map to iptv-org category IDs in `src/config.ts` (`CATEGORY_GROUPS`):

- **Sports:** `sports`
- **News:** `news`, `business`, `weather`
- **Movies:** `movies`, `classic`
- **Entertainment:** `entertainment`, `general`, `series`, `comedy`, `lifestyle`
- **Kids:** `kids`, `animation`, `family`

Channels with no category in iptv-org only appear in the two "all" catalogs (Malaysia and Singapore).

## Source filtering

iptv-org mixes official streams with unauthorised restreams. For example, HBO Asia, Sky Sports F1 and
CinemaWorld appear there via raw IPs and proxy hosts. The addon applies four filters:

1. **Stream host allowlist** (`ALLOWED_HOST_SUFFIXES` in `src/config.ts`). It covers FAST platforms
   (Samsung TV Plus, Pluto, Plex, Roku via `jmp2.uk`; Amagi; Wurl; Tubi), broadcaster CDNs (BBC, CBS,
   PBS…), video platforms, and AWS MediaTailor/MediaPackage. Raw IP hosts are always rejected.
2. **Pay-TV name denylist** (`DENIED_CHANNEL_NAME_PATTERNS`). This catches pay brands that slip onto
   generic CDNs.
3. **Upstream exclusions.** The iptv-org DMCA/NSFW blocklist, NSFW channels and closed channels are dropped.
4. **Health check.** Dead streams are hidden after each refresh.

This reduces piracy risk a lot but doesn't eliminate it. `akamaized.net` and `cloudfront.net` are shared
CDNs. Review what shows up, and add patterns to the denylist if something looks wrong.

## Run locally

```bash
npm ci
npm test          # build + 25 tests
npm start         # http://localhost:7000/manifest.json
```

Node 22+ is required. There are no runtime dependencies: the HTTP layer uses `node:http`.

## Deploy (Docker + Nginx)

```bash
docker compose up -d --build
```

The compose file binds to `127.0.0.1:7000`. Put it behind Nginx with HTTPS, because Nuvio needs a
public HTTPS URL:

```nginx
server {
    listen 443 ssl http2;
    server_name livetv.example.com;
    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:7000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Install in Nuvio

In Nuvio, go to Settings → Content & discovery → Addons, paste `https://livetv.example.com/manifest.json`,
and install. The catalogs appear as rows on the home and discover screens.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `7000` / `0.0.0.0` | Listen address |
| `REFRESH_INTERVAL_MINUTES` | `360` | Re-download iptv-org data (15–10080) |
| `HEALTHCHECK_ENABLED` | `true` | Probe streams after each refresh |
| `HEALTHCHECK_CONCURRENCY` | `8` | Parallel probes (1–64) |
| `HEALTHCHECK_TIMEOUT_MS` | `8000` | Per-probe timeout |
| `EXCLUDE_GEO_BLOCKED` | `false` | Drop streams iptv-org labels `Geo-blocked` |
| `EXCLUDE_NOT_24_7` | `false` | Drop streams labelled `Not 24/7` |
| `EXTRA_ALLOWED_HOSTS` | — | Comma-separated hostnames to add to the allowlist |
| `IPTV_API_BASE` | `https://iptv-org.github.io/api` | Upstream base URL (https only) |
| `IPTV_DATA_DIR` | — | Load the iptv-org JSON from a local folder instead |

`GET /health` reports the last refresh and the health-check counts.

## Known limitations

- **Geo-blocking.** Many US FAST and BBC streams only play from the US or UK. From Malaysia, expect a
  share of the US and UK channels to fail without a VPN. The health check runs from the server's
  location, so it can't detect this. A `403` is kept as "unknown" rather than "dead".
- **Thin UK/SG catalogs.** Premium channels (Sky, TNT Sports, HBO, Astro) have no free legal stream,
  so they don't appear.
- **Malaysia.** TV1, TV2 and TV3 only survive when iptv-org lists an official RTM or Tonton CDN URL for them.

## Layout

```
src/
  config.ts            catalogs, category groups, allow/deny lists, env parsing
  iptv/                iptv-org types, validation, loader (remote or local)
  catalog/build.ts     pure dataset → index transform
  catalog/policy.ts    stream host + channel name policy
  health/              SSRF-safe stream prober and checker
  addon/protocol.ts    manifest / catalog / meta / stream responses
  server.ts            node:http router (CORS, validation, caching headers)
  state.ts             refresh lifecycle (keeps last good index on failure)
  index.ts             bootstrap
```
