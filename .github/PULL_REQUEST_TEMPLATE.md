## What changed

<!-- One or two sentences. Link the issue if there is one: Fixes #123 -->

## Type

- [ ] Bug fix (focus, layout, crash, playback)
- [ ] Compatibility fix for Chromium 47 / Tizen 3.0
- [ ] Localization
- [ ] Documentation
- [ ] Other (explain)

## Why

<!-- What was broken or missing? What is the user-visible effect? -->

## How tested

- Device / platform:
- Engine: AVPlay / HTML5 / desktop browser
- Steps performed:
- Result:

## Checklist

- [ ] `npm run check-es5` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No ES2015+ syntax added to `src/js/`
- [ ] No new runtime dependencies
- [ ] No certificates, keys, tokens, signed `.wgt`, or personal IPs committed
- [ ] Focus/navigation verified with the D-pad if the change affects layout
- [ ] Playback verified on a real TV if the change affects AVPlay
- [ ] Screenshots/video attached for visual changes
