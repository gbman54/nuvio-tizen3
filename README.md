<div align="center">

<img src="assets/logo.png" width="120" alt="Nuvio Lite" />

# Nuvio Lite for Tizen 3.0

**An unofficial Nuvio client for 2017 Samsung TVs — Tizen 3.0 / Chromium 47.**

Vanilla ES5, no framework, no bundler at runtime, under 500 KB packaged.

[![Tizen 3.0](https://img.shields.io/badge/Tizen-3.0-1428A0?logo=samsung&logoColor=white)](#compatibility)
[![Chromium 47](https://img.shields.io/badge/Chromium-47-4285F4?logo=googlechrome&logoColor=white)](#why-es5)
[![ES5](https://img.shields.io/badge/JavaScript-ES5-F7DF1E?logo=javascript&logoColor=black)](#why-es5)
[![CI](https://github.com/gbman54/nuvio-tizen3/actions/workflows/ci.yml/badge.svg)](https://github.com/gbman54/nuvio-tizen3/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

</div>

> **Not affiliated with NuvioMedia.** This is a community project. "Nuvio" is used only to describe compatibility with the Nuvio ecosystem. The official Nuvio apps are at [github.com/NuvioMedia](https://github.com/NuvioMedia).

---

## Why this exists

The official [NuvioTVSmart](https://github.com/NuvioMedia/NuvioTVSmart) targets **Tizen 4.0+ (Chromium 56)**. Samsung's 2017 UHD lineup — including the **UA55MU7000** this was built and tested on — ships **Tizen 3.0 with Chromium 47**, which is missing most modern JavaScript and CSS features the official app relies on.

Nuvio Lite is a from-scratch client for that hardware:

- **ES5 only.** No arrow functions, `const`/`let`, `async`, `Promise` syntax, spread, or classes in app code.
- **No `fetch`, no `grid`, no `gap`, no `aspect-ratio`.** XHR, inline-block and float layout throughout.
- **Runs in ~1 GB RAM** with a single spatial focus manager and no virtual DOM.
- **No torrent engine on the TV.** Direct HTTP/HTTPS/HLS sources, or magnets resolved by a LAN companion (Stremio server / TorrServer).

## Features

- **Apple TV–style UI** — dark translucent surfaces, rounded poster cards, white focus pill, left icon rail.
- **Stremio addons** — add any `manifest.json`, browse catalogs, search, metadata, streams. Cinemeta seeded by default.
- **On-device scrapers** — install community Nuvio provider repos, run them in a sandbox on the TV, no server required.
- **Playback** — AVPlay primary with an HTML5 fallback, seek/pause/resume, Next Episode, 10-second resume checkpoints.
- **Audio tracks** — pick a track, with a preferred-language filter that hides streams explicitly labelled in other languages (MULTI/dual-audio always allowed, toggle per title).
- **Subtitles** — embedded tracks plus app-rendered external subtitles (VTT downloaded once, converted on device, drawn above the AVPlay video plane, stays in sync while seeking).
- **5 UI languages** — English, العربية (full RTL), Français, Español, Türkçe.
- **Profiles** — 4 independent profiles with their own library, history and settings.
- **Optional Trakt** device-code sync.

## Screenshots

| Home | Detail | Settings |
|---|---|---|
| ![Home](docs/screenshots/home.jpg) | ![Detail](docs/screenshots/detail.jpg) | ![Settings](docs/screenshots/settings.jpg) |

| Plugins | Streams |
|---|---|
| ![Plugins](docs/screenshots/plugins.jpg) | ![Streams](docs/screenshots/streams.jpg) |

## Compatibility

| | |
|---|---|
| **Tested device** | Samsung UA55MU7000 (2017), Tizen 3.0, Chromium 47 |
| **Target** | Samsung Tizen 3.0 (2017) and newer |
| **Resolution** | 1920×1080 UI, scaled for 1280×720 panels |
| **Input** | D-pad remote only; platform IME is never used |
| **Package size** | ~315 KB source, limit 500 KB |

Other 2017 models on the same Tizen 3.0 firmware should work. Tizen 2.3/2.4 (2015–2016) is **not** supported — the app needs `webapis.avplay` and modern-enough DOM primitives.

## Install

### From a release (recommended)

1. On the TV: **Settings → General → System Manager → Other Settings → Developer Mode = ON**, set *Host PC IP* to your computer's LAN address, then reboot the TV.
2. Download the latest `.wgt` from [Releases](../../releases).
3. Install with Tizen Studio's `sdb` (retail firmware restricts normal shell commands):

```bash
sdb connect <TV_IP>:26101
sdb -s <TV_IP>:26101 push "Nuvio Lite.wgt" /home/owner/share/tmp/sdk_tools/tmp/nuvio.wgt
sdb -s <TV_IP>:26101 shell 0 vd_appinstall nuvio12345.nuviolite /home/owner/share/tmp/sdk_tools/tmp/nuvio.wgt
tizen run -p nuvio12345.nuviolite -s <TV_IP>:26101
```

Or use the helper:

```bash
npm run install:tv -- --ip=<TV_IP> --wgt="Nuvio Lite.wgt"
```

> **Signing:** release builds are signed with the **Tizen public distributor** profile. On this firmware a Samsung author/distributor chain is rejected (`install failed[118]`, stalls at `installing[22]`) even for a 5 KB test app, while the public distributor installs fine. The `VD_APPINSTALL` path above is the only working install route on retail TVs.

### Build and install from source

Requirements: Node.js ≥ 14, Tizen Studio CLI (`tizen`, `sdb`), and a signing profile.

```bash
git clone https://github.com/gbman54/nuvio-tizen3.git
cd nuvio-tizen3

npm run check-es5      # ES5 gate — must pass
npm test               # unit tests
npm run build          # size report

# Stage only what belongs in the widget
mkdir -p build-out
cp index.html config.xml icon.png icon_launcher.png build-out/
cp -r src assets build-out/

tizen package -t wgt -s <PROFILE> -- build-out
```

Creating the public-distributor profile (the author alias **must be 10 characters**; shorter app-id prefixes are rejected by the TV):

```bash
export AUTHOR_ID=nuvio12345
export NUVIO_CERT_PASS='<your-password>'

tizen certificate -a $AUTHOR_ID -p "$NUVIO_CERT_PASS" -c US -s California \
  -ct "Los Angeles" -o Nuvio -u Dev -n "Nuvio Lite" -e dev@example.com -f $AUTHOR_ID

SDK=~/tizen-studio/tools/certificate-generator/certificates/distributor/sdk-public
tizen security-profiles add -n NuvioTV \
  -a ~/tizen-studio-data/keystore/author/$AUTHOR_ID.p12 -p "$NUVIO_CERT_PASS" \
  -c "$SDK/tizen-distributor-ca.cer" -d "$SDK/tizen-distributor-signer.p12" \
  -dp tizenpkcs12passfordsigner
```

Then run `node scripts/setup-tv.js --ip=<TV_IP>` to do certificate → package → install → launch in one step.

## First run

1. **Addons** — Settings → Addons. Cinemeta is seeded; add any Stremio addon manifest URL.
2. **Scrapers** — Plugins → add a provider repo manifest. Known-working:
   ```
   https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json
   https://raw.githubusercontent.com/phisher98/nuvio-providers/refs/heads/main/manifest.json
   ```
3. **Subtitles** — add an OpenSubtitles-style Stremio addon in Settings → Addons.
4. **Languages** — Settings → Languages: preferred audio and subtitle languages, plus "hide other audio languages" for the stream list.

## Project layout

```
index.html                Script tags in load order; stage + OSD roots
config.xml                Tizen widget manifest, privileges, CSP
src/css/app.css           Layout + tvOS theme layer (later rules override)
src/js/00-polyfill.js     Promise/Array/Object/String polyfills for M47
src/js/01-util.js         DOM helpers, stream-language parsing, VTT→SRT
src/js/02-storage.js      localStorage schema v1, per-profile settings
src/js/03-i18n.js         EN/AR/FR/ES/TR strings, RTL switch
src/js/04-http.js         XHR + timeout + one retry
src/js/05-api.js          Stremio client (manifest/catalog/meta/stream/subtitles)
src/js/06-resolver.js     Debrid vs LAN adapters
src/js/07-focus.js        Single spatial D-pad focus manager
src/js/08-keyboard.js     On-screen QWERTY + Arabic keyboard, symbols page
src/js/09-views.js        Home/Detail/Search/Library/Settings/Streams/Plugins UI
src/js/10-player.js       AVPlay + HTML5, OSD, tracks, app-rendered subtitles
src/js/11-trakt.js        Optional Trakt device-code sync
src/js/12-app.js          Key handling, stage scaling, Tizen keys, bootstrap
src/js/13-plugins.js      Scraper runtime: sandbox, transform, shims, repo manager
scripts/                  check-es5, build, package, install-tv
docs/                     Screenshots and notes
```

## Why ES5

The TV's Chromium 47 predates most of ES2015. `scripts/check-es5.js` parses every app file and rejects forbidden syntax before packaging, so a modern-looking edit can never ship and white-screen the TV. Runtime constraints this project respects:

| Constraint | Why |
|---|---|
| No `fetch`, `Promise` syntax, `async/await` | Not in Chromium 47 |
| No CSS `grid`, `gap`, `aspect-ratio` | Not supported / buggy |
| No Web Workers, WebAssembly, `tizen.filesystem` for web widgets | Unavailable to plain Tizen 3.0 widgets |
| AVPlay, not `<video>` | Hardware decoding; HTML5 is only a fallback |
| XHR + localStorage | Only reliable storage/network primitives |

## How the hard parts work

**Focus manager.** One spatial manager owns D-pad movement. It never calls `element.focus()`, because Tizen's native focus scroll runs after the app's scroll code and snapped the page to the top of a poster row. Scrolling is row-aware (whole row, 22 px gap above the title) and converts screen pixels to layout pixels using the stage scale.

**AVPlay.** `webapis.avplay` is a singleton, not a constructor. Audio tracks must be applied in `PLAYING` state using `AVPlayStreamInfo.index`, then verified with `getCurrentStreamInfo()` with staged fallbacks. AVPlay draws on a video plane *below* the web layer, so during playback `html`, `body` and `#stage` are made transparent, `#app` is hidden, and `PLAYER_DISPLAY_MODE_FULL_SCREEN` is set.

**External subtitles.** AVPlay's external-subtitle path never worked on this firmware. Instead the app downloads the VTT once, converts it to SRT, parses cues, and draws them in a web overlay above the video plane — so they work over AVPlay, follow seeks, and never reload the stream.

**Scraper sandbox.** Provider code runs in `new Function` with only `fetch` (XHR-backed), `console`, timers, `atob`/`btoa`, `Buffer`/`TextDecoder`/`URLSearchParams`, a DOMParser-backed mini `cheerio`, and a `crypto-js` shim (MD5, SHA-256, HMAC, AES-CBC). Runs are serialized, capped at 8 seconds, and a failing provider can never crash the app. ES2015+ syntax is transformed to ES5 on first run and cached; unsupported syntax fails with an explicit message.

## Known limitations

- No torrent/P2P on the TV. Direct URLs only, unless you run a LAN resolver.
- No WebAssembly, no Workers, no Node plugins, no platform IME.
- AVPlay subtitle size/colour settings are best-effort; app-rendered subtitles honour them fully.
- Cloudflare / JS-challenge hosts cannot be scraped.
- Some streams need `Referer`/`User-Agent`; AVPlay can receive them, HTML5 cannot.
- Trakt requires your own client ID.
- No content, addons, credentials, or signing keys are bundled.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `sdb: serial number wrong` | `sdb kill-server && sdb start-server`, then `sdb connect <TV_IP>:26101` two or three times |
| `install failed[118]` | Stop at 22% means the certificate chain was rejected — use the public distributor profile |
| `sdb shell` prints `closed` | Expected on retail firmware; only `shell 0 <whitelisted-command>` works |
| Black screen on launch | Check the JS console with `sdb shell 0 wascmd ...`; the ES5 gate should have caught syntax errors |
| Launcher icon still a blue tile | Reboot the TV once; Tizen caches launcher icons aggressively |
| Provider fails | Plugins → Plugin Test with a numeric TMDB ID; it shows the exact error and timing |

## Contributing

Bug reports and focused fixes are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

The short version: open an issue with the TV model, Tizen version, app version and reproduction steps. Keep PRs small, run `npm run check-es5 && npm test`, and never commit certificates, keys, tokens or personal IP addresses.

## Security

See [SECURITY.md](SECURITY.md). Do not open public issues for security problems.

## License

[GNU General Public License v3.0](LICENSE).

This project is an independent community client. It is not affiliated with, endorsed by, or supported by NuvioMedia. Nuvio and related marks belong to their respective owners. No media content is provided or hosted by this project.
