# Nuvio Lite — On-TV Test Checklist (Tizen 3.0, 2017 model)

Run on a real 2017 TV via Developer Mode + signed WGT (see README). Check each box; note failures with the debug overlay (Red→Green→Yellow→Blue).

## Setup
- [ ] App launches from Apps, Home shows Cinemeta rows (Popular movies/series) within ~10 s.
- [ ] Left rail: Home / Search / Library / Plugins / Settings all focusable; focus tooltip shows the item name; profile icon visible at the bottom.
- [ ] 1280×720 TV: UI scales correctly, no clipped text.

## Navigation (D-pad)
- [ ] Arrows move focus across poster rows; focus ring 4px+, no focus loss at row edges.
- [ ] Enter opens detail; Back returns to the exact row/card focused before.
- [ ] Back on Home shows “Exit?” dialog; “Yes” exits app (returns to Hub).
- [ ] Media keys registered (no crash); Color keys don’t crash.

## Search / Keyboard
- [ ] Search: type query → debounced results grouped Movies / Series.
- [ ] Keyboard layout toggle QWERTY ↔ Arabic works; RTL flips layout; Backspace/Space/Clear work.
- [ ] Add addon: type/paste manifest URL → saved, appears in Settings → Addons, persists after restart.

## Detail / Library
- [ ] Detail shows backdrop, title, year/runtime, genres, cast, description.
- [ ] Series: season selector + episode list; selecting an episode opens stream picker.
- [ ] Mark watched toggles; Add/Remove library works; Library view lists items.

## Playback (MP4 + HLS)
- [ ] Play via AVPlay (auto engine): video plays, OSD shows progress/time.
- [ ] Pause/resume (Enter / MediaPlayPause), ±10s seek, hold Right to accumulate ±30/±60s.
- [ ] HTML5 fallback: set Settings → Player engine = HTML5 → MP4 plays; HLS plays if TV supports it natively.
- [ ] Audio/subtitle track menu opens; selecting a track applies (AVPlay `setSelectTrack`).
- [ ] External subtitle loads (addon `subtitles` → app-rendered overlay above AVPlay; HTML5 uses `<track>`).
- [ ] Buffering indicator appears on slow network; no freeze.
- [ ] At end of episode: “Next episode” dialog appears.

## Resume / History
- [ ] Exit mid-playback → Home “Continue Watching” lists title with position.
- [ ] Re-play same title → resume prompt/position restored within ~5 s.
- [ ] Position saved every ~10 s (kill app, relaunch, position still there).

## Resolver / Torrents
- [ ] Debrid mode: torrent-only addon rows show “Unsupported on this TV: set up a resolver…” — no empty picker.
- [ ] LAN mode: enter `http://<server>:<port>` → *Test connection* reports Connected.
- [ ] Torrserver: torrent stream resolves to `/stream/{hash}/{index}` and plays.
- [ ] Stremio-server: torrent stream resolves via `/stream/...` proxy and plays.
- [ ] Unreachable server → clear error, app never blanks.

## Profiles / Settings / Trakt
- [ ] Create 2nd profile → separate library/history; switch back → data intact.
- [ ] UI language Arabic → RTL layout, strings translated; back to English restores LTR.
- [ ] Subtitle size/color, preferred audio/subtitle language persist.
- [ ] Trakt (optional): device code + URL shown, approval polls, login persists; logout clears.

## Stability (30 min)
- [ ] Browse/search for 30 min: no crash, no blank screen, memory stable (rows virtualized to ≤40 cards).
- [ ] Airplane/Wi-Fi off mid-browse → user-visible error + Retry, never blank.
- [ ] All network calls time out ≤8 s (streams), ≤6 s (resolver test).
