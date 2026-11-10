# Releasing

The app version lives in **two** places. `scripts/build.js` fails if they disagree.

1. `config.xml` → `<widget ... version="1.0.19">`
2. `src/js/09-views.js` → the About string (`' 1.0.19 · Tizen 3.0 ...'`)
3. `package.json` → `"version"` (convenience only)
4. `CHANGELOG.md` → add a section

```bash
npm run check-es5
npm test
npm run build          # also verifies version parity
```

## Package

```bash
rm -rf build-out
mkdir -p build-out
cp index.html config.xml icon.png icon_launcher.png build-out/
cp -r src assets build-out/
tizen package -t wgt -s <PROFILE> -- build-out
```

Only these files belong in the widget. `build-out/` is git-ignored.

## Verify on hardware

Install on a real Tizen 3.0 TV and run [TEST-CHECKLIST.md](../TEST-CHECKLIST.md). Do not tag a release that has not been launched on a TV.

## Publish

```bash
git tag -a v1.0.19 -m "Nuvio Lite 1.0.19"
git push origin main --tags
```

Create the GitHub release from the tag, attach the signed `Nuvio Lite.wgt`, and paste the CHANGELOG section as the release notes.

## Signing

- Release WGTs use the **Tizen public distributor** profile. Never commit the author keystore or password.
- The author alias must be exactly 10 characters (`nuvio12345`), otherwise the TV rejects the app id.
- If you rotate certificates, bump the app version so the TV does not reuse the cached widget.

## After publishing

- Confirm the CI badge is green on `main`.
- Check the release asset downloads and installs from a clean TV (uninstall first).
- Keep `README.md` compatibility notes current — the whole point of this project is the Tizen 3.0 / Chromium 47 boundary.
