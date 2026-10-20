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

## Run from GitHub (no Docker)

Requires Node.js 22+ and git, **installed system-wide** (NodeSource, `dnf module`, or distro
packages). An nvm install under `/root` or `/home` is invisible to the hardened service.

**Quick test (one line, nothing to clone):**

```bash
PORT=7000 npx -y github:<you>/nuvio-live-tv-addon
```

npm clones the repo, runs the TypeScript build (`prepare` script) and starts the server. npx caches
the build, so use `npx clear-npx-cache` or add `#<commit>` to the spec to pick up new commits.

**Server install (systemd, auto-restart, survives reboots):**

```bash
git clone https://github.com/<you>/nuvio-live-tv-addon.git /tmp/nuvio-live-tv-addon
sudo REPO_URL=https://github.com/<you>/nuvio-live-tv-addon.git \
  bash /tmp/nuvio-live-tv-addon/deploy/install.sh
```

The script:

- clones to `/opt/nuvio-live-tv-addon`, builds, and prunes dev dependencies;
- creates a `nuvio-live-tv` system user;
- writes config to `/etc/nuvio-live-tv/env` (from `.env.example`, only on first install);
- installs and starts the hardened `nuvio-live-tv` systemd unit.

To update, run the same command again. It pulls the latest `main`, rebuilds and restarts. For a
private repo, use an SSH URL or a deploy key in `REPO_URL`.

```bash
systemctl status nuvio-live-tv
journalctl -u nuvio-live-tv -f        # JSON logs
sudoedit /etc/nuvio-live-tv/env && sudo systemctl restart nuvio-live-tv
```

**Manual run (for development):** `npm ci && cp .env.example .env && npm run start:env`.

## Deploy on Render (free plan)

`render.yaml` is a Render Blueprint. It sets up a free Node web service in Singapore, with Node 24,
the build and start commands, `/health` as the health check, and memory-safe settings.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, connect GitHub, pick the repo, then **Apply**.
3. Wait for the first deploy, then open `https://<service>.onrender.com/manifest.json` to check it.
4. In Nuvio, install `https://<service>.onrender.com/manifest.json`.

Free-plan behaviour:

- **Spin-down.** The service sleeps after 15 minutes without traffic, and waking takes about a minute.
  Requests that arrive during startup wait up to 25 seconds for the channel data instead of failing.
- **Keeping it awake.** An external pinger on `/health` every 10 minutes keeps it awake. One service
  running all month uses about 744 of the 750 free hours per workspace, so nothing else on the free
  plan in that workspace can also run 24/7.
- **Bandwidth.** Video never passes through Render; Nuvio pulls streams straight from the broadcaster
  CDNs. The addon only serves small JSON responses.

## Deploy with Docker (alternative)

```bash
docker compose up -d --build
```

## HTTPS via Nginx

Both setups listen on `127.0.0.1:7000`. Nuvio needs a public HTTPS URL, so proxy it through Nginx:

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
  index.ts             bootstrap (also the npx bin entry)
deploy/
  install.sh           clone/update + build + systemd install (idempotent)
  nuvio-live-tv.service  hardened systemd unit
```
