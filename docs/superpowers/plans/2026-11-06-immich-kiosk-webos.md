# Immich Kiosk webOS App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public LG webOS IPK that lets users configure any Immich Kiosk host and supplies a Glasshouse-compatible photo screensaver using that host's `/image` endpoint.

**Architecture:** A plain webOS web app provides a first-run settings/launcher UI and redirects to the configured Kiosk page. On the target webOS 10.3.1 TV, a small ES5 Luna service validates and persists `{kioskUrl, kioskPassword, intervalSeconds}` at `/media/developer/apps/usr/palm/services/com.mahalel.immichkiosk.service/config.json`, because the service jail's `/var/luna/preferences` is read-only while its installed service directory is writable. Glasshouse discovers `app/assets/screensaver-main.qml`; the QML saver reads that JSON file, fetches Kiosk images, applies slow randomized motion and cross-fades, and fades to black after a bounded stale period.

**Tech Stack:** Plain HTML/CSS/ES5 browser JavaScript, webOS `WebOSServiceBridge`, webOS `webos-service`, QtQuick QML 2.4, Node's built-in `node:test`, `ares-package` from `@webos-tools/cli` 3.2.3 or an equivalent installed webOS CLI.

**Spec:** `docs/superpowers/specs/2026-11-06-immich-kiosk-webos-design.md`

## Global Constraints

- Use `QtQuick 2.4` and `Eos.Window 0.1`; the screensaver window is exactly `1920×1080`.
- The screensaver declares `windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"`, `appId: "com.webos.app.screensaver"`, `visible: true`, and a black base color.
- The public IPK contains no user-specific host, password, Immich API key, or committed config file.
- Accept only `http:` and `https:` Kiosk URLs; self-signed HTTPS is not a first-version requirement.
- Kiosk album selection and ordering remain on the Kiosk server; the TV calls `GET /image` and does not call Immich directly.
- The QML saver uses no sound or video, makes no Glasshouse-private API calls, and treats network access as an expected Glasshouse-listed caution.
- Photos move slowly with randomized pan/zoom; transitions do not flash; a prolonged refresh failure fades to black instead of freezing a bright photo.
- Keep the service ES5-compatible and dependency-light for webOS; use Node built-ins for local tests.

## Review Focus

- **Unsupported or malformed Kiosk URL:** reject `file:`, `javascript:`, empty-host, whitespace-containing, and malformed values; the app must not navigate to them. Test in Task 1.
- **Password/query handling:** preserve an existing Kiosk query string and URL-encode the optional password without logging it. Test in Task 1 and Task 3.
- **Missing, corrupt, or partially written service state:** return safe defaults and use atomic replacement so the QML saver never parses a half-written JSON file. Test in Task 2.
- **Stalled or repeatedly failing image loads:** retain the current image only for the bounded grace period, then blacken the saver and retry. Static checks and device behavior are covered in Task 4.
- **Incorrect webOS/Glasshouse packaging:** keep app/service IDs, `screensaver-main.qml`, required QML markers, and separate app/service packaging aligned. Test in Task 5 and on the target TV.

---

### Task 1: Scaffold manifests and configuration validation

**Files:**
- Create: `app/appinfo.json`
- Create: `app/index.html` (minimal shell only; UI behavior is Task 3)
- Create: `app/assets/icon.png` (temporary valid PNG if final artwork is not ready)
- Create: `service/package.json`
- Create: `service/services.json`
- Create: `service/config.js`
- Create: `test/config.test.js`
- Create: `.gitignore`

**Interfaces:**
- Produces `service.DEFAULT_CONFIG` with `kioskUrl: ""`, `kioskPassword: ""`, and `intervalSeconds: 60`.
- Produces `service.normalizeConfig(input) -> Config`, returning a normalized safe config or throwing a validation error.
- Produces `service.validateConfig(input) -> {ok: boolean, config?: Config, error?: string}`.
- Produces `service.appendQuery(url, name, value) -> string`, preserving an existing query and URL-encoding the value.
- `app/appinfo.json` uses app ID `com.mahalel.immichkiosk`, type `web`, main `index.html`, title `Immich Kiosk`, and `vendorExtension.allowCrossDomain: true`.
- `service/services.json` registers `com.mahalel.immichkiosk.service`.

- [ ] **Step 1: Write failing validation tests**

Add tests named `rejectsUnsupportedSchemes`, `rejectsMissingHosts`, `normalizesTrailingSlashes`, `clampsIntervalToTenThrough3600`, `acceptsEmptyPassword`, and `appendsEncodedPasswordToExistingQuery`.

Assertions must cover:
- `http://kiosk.example/` and `https://kiosk.example/path` are accepted.
- `file:///tmp/x`, `javascript:alert(1)`, empty strings, whitespace-containing URLs, and URLs without a host are rejected.
- trailing slashes are removed only from the base URL; path/query content is retained.
- intervals below 10 become 10, intervals above 3600 become 3600, and a missing/non-numeric interval becomes 60.
- `appendQuery("https://kiosk.example/?theme=dark", "password", "a b&c")` produces a query containing `password=a%20b%26c` without dropping `theme=dark`.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test test/config.test.js`

Expected: FAIL because `service/config.js` and its exported functions do not exist yet.

- [ ] **Step 3: Implement `service/config.js`**

Use Node's standard `url` module plus explicit scheme/host/whitespace checks. Keep the module CommonJS and ES5-compatible. Normalize only the values the service owns; do not silently accept unsupported protocols.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `node --test test/config.test.js`

Expected: all validation and query-construction tests pass.

- [ ] **Step 5: Add the minimal manifests and ignore rules**

Set the app/service IDs exactly as above, make the app manifest point at `index.html`, and ignore `build/`, `node_modules/`, local config snapshots, and editor files. Do not add a real Kiosk URL or password.

- [ ] **Step 6: Commit the scaffold**

```sh
git add app service test .gitignore
git commit -m "feat: scaffold configurable webOS kiosk app"
```

### Task 2: Implement the persistent Luna configuration service

**Files:**
- Create: `service/config-store.js`
- Create: `service/service.js`
- Create: `test/config-store.test.js`
- Modify: `service/package.json` only if the service entry point needs to be declared

**Interfaces:**
- `service/config-store.js` exports `CONFIG_PATH = "/media/developer/apps/usr/palm/services/com.mahalel.immichkiosk.service/config.json"` for the verified webOS 10.3.1 target.
- `readConfig(filePath) -> Config` returns `DEFAULT_CONFIG` when the file is absent, invalid JSON, or invalid according to `validateConfig`.
- `writeConfig(filePath, config) -> void` writes normalized JSON through a same-directory temporary file and atomic rename; it does not log or return the password.
- Luna method `getConfig` responds with `{returnValue: true, config}`.
- Luna method `saveConfig` accepts `{kioskUrl, kioskPassword, intervalSeconds}` and responds with `{returnValue: true, config}` or `{returnValue: false, errorText}`.

- [ ] **Step 1: Write failing store tests**

Use a temporary directory/file path rather than the TV path. Add tests named `returnsDefaultsWhenStateIsMissing`, `returnsDefaultsWhenStateIsCorrupt`, `writesAndReadsNormalizedState`, `replacesStateAtomically`, and `doesNotPersistUnvalidatedValues`.

Assert that a saved config can be read back, invalid input is rejected before writing, the final file is valid JSON, and no temporary file remains after a successful write.

- [ ] **Step 2: Run the focused store tests and confirm they fail**

Run: `node --test test/config-store.test.js`

Expected: FAIL because `service/config-store.js` does not exist yet.

- [ ] **Step 3: Implement the store**

Use synchronous filesystem calls because service payloads are tiny and this keeps the Node 0.12/16 behavior predictable. Write a temporary sibling file with restrictive permissions, rename it over the final file, and never print config payloads.

- [ ] **Step 4: Run the focused store tests and confirm they pass**

Run: `node --test test/config-store.test.js`

Expected: all store tests pass.

- [ ] **Step 5: Implement `service/service.js`**

Construct `new Service("com.mahalel.immichkiosk.service")`, register `getConfig` and `saveConfig`, and use the store's exact `CONFIG_PATH`. Return structured errors for invalid input or filesystem failures. Keep the service free of HTTP listeners and root execution.

- [ ] **Step 6: Check service syntax and all unit tests**

Run:

```sh
node --check service/service.js
node --test test/*.test.js
```

Expected: syntax check succeeds and every test passes.

- [ ] **Step 7: Commit the service**

```sh
git add service test
git commit -m "feat: persist kiosk configuration through Luna service"
```

### Task 3: Build the configurable launcher/settings UI

**Files:**
- Modify: `app/index.html`
- Create: `app/app.js`
- Create: `app/styles.css`
- Create: `test/app-static.test.js`

**Interfaces:**
- `app/app.js` calls Luna service `luna://com.mahalel.immichkiosk.service/getConfig` and `/saveConfig` through `WebOSServiceBridge`.
- The DOM contains a first-run/settings form with IDs `kiosk-url`, `kiosk-password`, `interval-seconds`, `save-settings`, and `cancel-settings`.
- The launcher contains `open-kiosk` and `edit-settings` controls.
- The app never hard-codes `kiosk.maha.nz`; users enter their own host.

- [ ] **Step 1: Write static UI tests**

Add tests named `containsRequiredWebOSServiceId`, `containsConfigurationFields`, `containsLauncherActions`, and `containsNoPersonalHostOrImmichKey`. Read the HTML/JS as text and assert required IDs, the service name, and absence of `kiosk.maha.nz`, `immich_api_key`, and `x-api-key`.

- [ ] **Step 2: Run the static UI tests and confirm they fail**

Run: `node --test test/app-static.test.js`

Expected: FAIL because the UI files do not contain the required markup.

- [ ] **Step 3: Implement the shell and styles**

Use plain HTML and CSS compatible with the target webOS 10 engine: a black background, large high-contrast labels, large buttons, and obvious focus states. Keep the settings form usable with the Magic Remote and on-screen keyboard.

- [ ] **Step 4: Implement the Luna client and screen state machine**

Use a single callback-based `callService(method, payload, callback)` helper. On launch, call `getConfig`; show settings when `kioskUrl` is empty, otherwise show the launcher. Saving calls `saveConfig`, then returns to the launcher. Opening Kiosk builds the saved URL with the optional encoded `password` query and uses `window.location.replace`.

Render all service errors with `textContent`; do not include the password or full URL in diagnostics. If `WebOSServiceBridge` is missing, show a clear installation/runtime error instead of silently failing.

- [ ] **Step 5: Run the static UI tests and all unit tests**

Run: `node --test test/*.test.js`

Expected: all tests pass.

- [ ] **Step 6: Commit the launcher**

```sh
git add app test/app-static.test.js
git commit -m "feat: add configurable kiosk launcher"
```

### Task 4: Implement the Glasshouse QML photo screensaver

**Files:**
- Create: `app/assets/screensaver-main.qml`
- Create: `test/screensaver-static.test.js`

**Interfaces and fixed values:**
- Config file URL: `file:///media/developer/apps/usr/palm/services/com.mahalel.immichkiosk.service/config.json`.
- Image endpoint: `<kioskUrl>/image`.
- Default interval: 60 seconds; service-normalized range: 10–3600 seconds.
- Two image layers; one-second cross-fade; image load timeout: 15 seconds; stale limit: two missed refreshes.
- Motion refresh: approximately 30 updates per second, with random seed/phase, slow pan/zoom, and a conservative black overlay.

- [ ] **Step 1: Write static QML tests**

Add tests named `hasGlasshouseWindowHeader`, `usesOnlyCompatibleImports`, `loadsSharedConfigPath`, `requestsKioskImages`, `disablesImageCache`, `hasTwoImageLayers`, `hasStaleFailurePath`, and `doesNotUseSoundOrVideo`.

Assert the exact window type/app ID/size, imports, config path, `/image`, `cache: false`, two image IDs, timeout/stale constants, and absence of `QtMultimedia`, `Audio`, `Video`, `MediaPlayer`, and unresolved `__TVWEB_` placeholders.

- [ ] **Step 2: Run the static QML tests and confirm they fail**

Run: `node --test test/screensaver-static.test.js`

Expected: FAIL because `app/assets/screensaver-main.qml` does not exist.

- [ ] **Step 3: Implement config loading and URL construction in QML**

On completion, load the service snapshot using `XMLHttpRequest`, parse and validate the required fields, and remain black with a retry timer if the file is missing or invalid. Append a changing nonce to each `/image` request and append the encoded Kiosk password without logging it.

- [ ] **Step 4: Implement the two-layer image pipeline**

Use asynchronous, non-cached `Image` items. Load the next image into the hidden layer, switch visibility only after `Image.Loaded`, then cross-fade the layers. A failed or timed-out load must not immediately replace the visible image.

- [ ] **Step 5: Implement OLED-safe motion and stale handling**

Drive a slow pan/zoom from a randomized phase/seed at roughly 30 Hz. Keep motion subtle and avoid flashes. Count failed/empty/timeout refreshes; after two missed refreshes, fade all photo opacity to zero and leave the base black until a successful image arrives. Retry at a bounded interval.

- [ ] **Step 6: Run static QML tests and all unit tests**

Run: `node --test test/*.test.js`

Expected: all tests pass.

- [ ] **Step 7: Commit the screensaver**

```sh
git add app/assets/screensaver-main.qml test/screensaver-static.test.js
git commit -m "feat: add Glasshouse Immich photo screensaver"
```

### Task 5: Package, document, and verify on the target TV

**Files:**
- Create: `Makefile`
- Create: `README.md`
- Create: `test/package-static.test.js`
- Modify: `.gitignore` if build outputs need additional exclusions

**Interfaces:**
- `make test` runs `node --test test/*.test.js`.
- `make package` runs tests and packages `app/` plus `service/` using `$(ARES)` (default `ares-package`) into `build/`.
- `make clean` removes only `build/`.
- Optional `make install DEVICE=lg-tv` and `make launch DEVICE=lg-tv` wrap the corresponding `ares-*` commands without embedding credentials.

- [ ] **Step 1: Write package/static tests**

Add tests named `hasMatchingAppAndServiceIds`, `hasScreensaverEntryPoint`, `hasNoUserConfig`, `hasNoImmichApiKey`, and `hasPackageDocumentation`. Assert that the manifests agree, the QML exists, no `app/assets/config.json` or real host is present, the service only names the intended persistent state path, and README contains first-run setup plus Glasshouse selection instructions.

- [ ] **Step 2: Run package/static tests and confirm they fail**

Run: `node --test test/package-static.test.js`

Expected: FAIL until the Makefile and README are present and all package assertions are satisfied.

- [ ] **Step 3: Implement the Makefile**

Use separate `app/` and `service/` package inputs: `$(ARES) app service -o build/ -n`. Do not package `build/`, local state, or test fixtures. Keep `ARES` overridable for `npx`/local CLI installations.

- [ ] **Step 4: Write README installation and configuration instructions**

Document:
- required webOS/Homebrew Channel/Glasshouse setup;
- `npm`/Node built-in test command;
- installing the webOS CLI 3.2.3 if `ares-package` is unavailable;
- installing and launching the IPK;
- entering a Kiosk host such as `https://kiosk.maha.nz/` without making it a default in code;
- configuring albums/order on the Kiosk server;
- selecting the installed-app saver in Glasshouse;
- the network/password and OLED behavior caveats;
- how to restore LG's saver if testing fails.

- [ ] **Step 5: Run all local verification**

Run:

```sh
make test
make package ARES=ares-package
unzip -l build/*.ipk
```

Expected: all Node tests pass, packaging succeeds when the CLI is installed, and the IPK contains the app/service payload but no local config or secret.

- [ ] **Step 6: Install and verify the app on the target TV**

Using the configured `ares` device or an equivalent Homebrew installation path:

```sh
ares-install build/*.ipk
ares-launch com.mahalel.immichkiosk
```

On the TV:
- save `https://kiosk.maha.nz/` in the first-run form;
- relaunch the app and confirm the launcher opens the configured Kiosk URL;
- change the interval to a short test value only if needed, then restore the desired value.

- [ ] **Step 7: Verify the Glasshouse catalog and live saver**

From the TV or its SSH shell, query Glasshouse's local API and confirm the installed-app entry is present as `app-com-mahalel-immichkiosk`, available, and marked with the network caution. Select it in Glasshouse, start it, and verify:
- a Kiosk image loads;
- the image slowly moves rather than remaining fixed;
- a later image cross-fades in;
- a temporary Kiosk failure does not immediately blank the current image;
- a prolonged failure eventually fades to black;
- a remote key dismisses the saver;
- LG's saver can be selected again afterward.

- [ ] **Step 8: Record target verification and inspect the final diff**

Run `git status --short`, review `git diff --stat`, and ensure no IPK, config snapshot, host password, or generated build directory is tracked.

- [ ] **Step 9: Commit packaging and documentation**

```sh
git add Makefile README.md test .gitignore
git commit -m "docs: package and verify webOS kiosk app"
```
