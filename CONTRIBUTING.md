# Contributing

Thanks for helping keep 2017 Samsung TVs usable.

This is an **unofficial community project**. It is not the official Nuvio app and it is not affiliated with NuvioMedia. Please do not report issues with this app to NuvioMedia, and do not send PRs for it to their repositories.

## Before you start

- **Tizen 3.0 is the hard constraint.** The app must run on Chromium 47. If a change needs a modern browser feature, it does not belong here.
- **ES5 only in `src/js/`.** `npm run check-es5` must pass. No `const`/`let`, arrow functions, template literals, `async`/`await`, spread, classes or `fetch`.
- **No new runtime dependencies.** This ships as plain script tags inside a 500 KB widget. No bundlers, frameworks, or npm packages at runtime.
- **No content.** Do not add addon URLs that host copyrighted media, credentials, debrid keys, or bundled subtitles.

## Reporting a bug

Open an issue and include:

- App version (Settings → Data & About)
- TV model and Tizen version
- Firmware version if known
- Install method (release WGT, local build, installer)
- Exact steps to reproduce
- Expected vs actual behaviour
- Screenshots or a short video for visual/focus bugs
- Logs if the app crashes or shows a black screen

One issue per problem. Vague reports ("streams don't work") cannot be fixed — include the provider name and the exact message from **Plugins → Plugin Test**.

## Pull requests

Small, focused fixes are merged quickly. Please:

1. Open an issue first for anything larger than a one-file bug fix.
2. Keep the diff minimal — no drive-by refactors, reformatting, or dependency bumps.
3. Run the gates:

   ```bash
   npm run check-es5
   npm test
   npm run build
   ```

4. Test on a real TV when the change affects playback, focus, AVPlay, or Tizen APIs. Say what you tested on. Desktop Chromium is acceptable for pure UI/logic changes.
5. Never commit `certs/`, `*.p12`, `*.key`, `*.cer`, signed `.wgt` files, tokens, or personal IP addresses.

### Focus and navigation changes

Focus bugs are the most common regressions on this platform. A focus PR must explain:

- Where focus was before, and where it jumped
- Whether the cause was `element.focus()`, a re-render, or scroll math
- How you verified it (which screen, which direction, how many steps)

### Playback changes

Playback touches AVPlay lifecycle and is high risk. Include the stream type (MP4/HLS), codec, container, whether it used AVPlay or HTML5, and whether audio/subtitle selection still works after the change.

## Code style

- ES5, two-space indent, single quotes, semicolons.
- One global namespace per file (`Util`, `Store`, `Api`, `FocusMgr`, …), no globals beyond those.
- Prefer explicit `var` and plain functions over clever abstractions.
- Comments should explain *why*, especially around Tizen quirks.

## Translations

UI strings live in `src/js/03-i18n.js`. Keep keys identical across all languages. Arabic is RTL — verify the layout mirrored correctly (`#app.rtl`) before submitting.

## License

By contributing you agree that your work is licensed under [GPL-3.0](LICENSE).
