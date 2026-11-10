# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow the app's `config.xml`.

## [1.0.19] — 2026-11-10

First public release.

### Added
- Apple TV–style interface: dark translucent surfaces, rounded poster cards, white focus pill, vertical icon rail with focus tooltips.
- Movies / Series sections with headings and a divider on Home, Search and Library.
- Separate movie and series catalogs per addon (previously movie catalogs could consume every slot).
- Preferred audio-language filter for the stream list, with a per-title "all languages" toggle.
- App-rendered external subtitles that work over AVPlay and follow seeks.
- Audio-track picker with verification and staged fallbacks.
- On-device scraper runtime: repo manager, sandbox, ES2015→ES5 transform, `cheerio`/`crypto-js`/`Buffer` shims, Plugin Test.
- 5 UI languages including Arabic with full RTL mirroring.
- 4 profiles, resume checkpoints, Next Episode, optional Trakt sync.

### Fixed
- Focus no longer snaps the page to the top of a poster row; scrolling is row-aware and stage-scale corrected.
- Focus is preserved across panel re-renders (detail, settings, plugins, player track menu).
- Native `element.focus()` removed because Tizen scrolled after the app's own scroll code.
- AVPlay playback is visible: page surfaces become transparent and the UI is hidden during playback.
- Seek no longer clamps to 0 when duration is not yet known.

### Known limitations
- No torrent/P2P on the TV; direct URLs or a LAN resolver only.
- Tizen 3.0 / Chromium 47 only.
