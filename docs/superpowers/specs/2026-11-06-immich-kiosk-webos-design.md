# Immich Kiosk webOS app design

## Intent

Provide a small LG webOS app that makes an existing Immich Kiosk instance easy to launch from the TV, and a Glasshouse-compatible screensaver that displays the same Kiosk-selected photos while the TV is idle.

The TV already has the two important pieces: Homebrew Channel for installing the app and Glasshouse for selecting custom screensavers. Immich Kiosk remains the source of truth for album selection, random ordering, image processing, and Immich authentication.

## Goals

- Install one public IPK that appears as an ordinary webOS app.
- Configure an arbitrary Immich Kiosk host from the TV on first launch, with an optional Kiosk password and slideshow interval.
- Launch the configured Immich Kiosk URL full-screen from the TV.
- Provide an `assets/screensaver-main.qml` companion that Glasshouse discovers as an installed-app screensaver.
- Fetch images through Immich Kiosk's `/image` endpoint, so the TV does not need an Immich API key or a second Immich client.
- Keep the screensaver usable on older rooted TVs supported by Glasshouse by using `QtQuick 2.4`, `Eos.Window 0.1`, a fixed 1920×1080 window, and simple QML.
- Keep failures safe: a failed image request must not replace a currently displayed image with an error page or frozen bright frame.

## Non-goals

- Reimplement Immich album browsing, authentication, search, or metadata handling.
- Fork or substantially reuse the React/Enact UI from Immich TV.
- Add a native album picker to the TV app. Albums remain configured in Immich Kiosk.
- Make the normal app itself take over LG's idle-screen policy. Glasshouse owns the screensaver selection and lifecycle.
- Add a cloud account or phone-pairing flow in the first version.

## Anti-goals

- Do not embed an Immich API key in the app.
- Do not hard-code one Kiosk host into the published package.
- Do not make the screen saver depend on Glasshouse's private API or modify Glasshouse.
- Do not use a modern QML import, shader, video player, or heavy JavaScript runtime when a pair of `Image` items and a `Timer` are sufficient.
- Do not ship real network addresses or passwords in Git.

## Constraints discovered during reconnaissance

- Glasshouse lists an installed app as a screensaver when its application directory contains `assets/screensaver-main.qml` (or `assets/screensaver.qml`). It stages only that QML as the screen saver; the QML must load other app state by an absolute path.
- Glasshouse permits network access for added screensavers but labels it as a caution. This app will therefore be shown as reaching the network.
- Glasshouse's documented compatible baseline is `import QtQuick 2.4` plus `import Eos.Window 0.1`, with a 1920×1080 screensaver window. The QML must declare the screensaver window type and app ID exactly as documented.
- Glasshouse's screensaver design guidance matters for this photo use-case: content should move slowly across the panel, avoid a fixed center, start from a randomized position, remain dark enough for long OLED runs, avoid flashes/sound, and fail to black rather than freeze a bright frame. Glasshouse's own poweroff-after setting remains responsible for ending a long-running saver.
- The target TV was inspected over SSH: LG OLED48C46LA.ANRQLJD, webOS 10.3.1, firmware 33.31.68, Glasshouse 0.139.0. Glasshouse reports custom screensavers available and writable; its current mode is the built-in `user-pigs` saver. The documented installed-app path exists at `/media/developer/apps/usr/palm/applications`.
- This project targets that TV first. The QML remains on the QtQuick 2.4 baseline, while the normal web app may assume the webOS 10 web engine. HTTP and publicly trusted HTTPS Kiosk URLs are in scope; self-signed HTTPS is not a first-version requirement.
- Browser `localStorage` is not shared with the separate QML screensaver process. A small ES5 webOS Luna service will therefore own the saved configuration and persist it in service preferences; the normal app writes it through Luna and the QML saver reads the service-owned JSON snapshot from the TV filesystem.
- Immich Kiosk exposes `GET /image`, which selects and processes an asset using its configured sources. Its `albums` and `album_order` configuration therefore remains on the Kiosk server. Kiosk also accepts its optional frontend password through the `password` query parameter.
- The existing Immich TV project is MIT-licensed and demonstrates Enact/webOS packaging, remote focus, and image URL handling. Its direct Immich API client is not needed here.

## Approaches considered

1. **Glasshouse-only QML saver:** smallest implementation, but no normal webOS app and no convenient launcher/preview.
2. **Thin webOS app plus QML saver:** chosen. It gives the TV an app tile and a real Glasshouse-selectable saver while reusing Kiosk as the backend.
3. **Fork Immich TV:** rejected for this goal because it duplicates Kiosk and creates a much larger direct-Immich client.

## Chosen design

### Package layout

The repository will contain only the files needed to build and validate one webOS package. The app payload lives under `app/` so the service payload can be packaged separately:

```text
app/
  appinfo.json
  index.html
  app.js
  styles.css
  assets/
    screensaver-main.qml
    icon.png
service/
  package.json
  services.json
  config.js
  config-store.js
  service.js
Makefile
README.md
test/
  ...small static/config checks...
```

The application ID will be `com.mahalel.immichkiosk` unless the builder finds a webOS packaging constraint requiring a different globally unique ID.

`appinfo.json` will declare a web app whose main document is `index.html`, with cross-domain access enabled for the Kiosk URL.

### Configuration

The published IPK contains no user-specific host or password. A small webOS service, `com.mahalel.immichkiosk.service`, owns the configuration and exposes two Luna methods:

- `getConfig` — returns the saved values or safe defaults;
- `saveConfig` — validates and atomically persists the new values.

The service stores its JSON state under a persistent service-preferences path such as `/var/luna/preferences/com.mahalel.immichkiosk/config.json`. The exact writable path will be verified on the target TV before implementation is considered complete.

```json
{
  "kioskUrl": "",
  "kioskPassword": "",
  "intervalSeconds": 60
}
```

The URL must be `http:` or `https:`. The interval is clamped to a reasonable range, for example 10–3600 seconds. The password is optional, is never logged, and is sent as Kiosk's `password` query parameter. It is not an Immich API key.

The normal web app uses `WebOSServiceBridge` to read and save the config. The QML saver reads the service's JSON snapshot with `XMLHttpRequest` using a `file://` URL. This avoids pretending that browser `localStorage` is shared with the separate QML process.

### Normal app flow

1. webOS launches `index.html`.
2. The page calls the configuration service.
3. If no host is configured, it shows a first-run form with Kiosk URL, optional password, and interval fields. The form uses normal webOS HTML inputs so the TV's on-screen keyboard can edit the URL.
4. If a host is configured, the launcher shows **Open Kiosk** and **Settings**. Opening Kiosk redirects the top-level webview to the saved URL, adding `password` when configured.
5. Saving settings writes the shared service config and returns to the launcher. The Kiosk page supplies its existing slideshow and remote-facing UI.
6. If configuration or Kiosk loading fails, the local page shows a short error with the configured host omitted from any secret-bearing diagnostic.

There is no iframe, proxy, Immich API client, or duplicated Kiosk UI.

### Glasshouse screensaver flow

1. Glasshouse discovers `assets/screensaver-main.qml` and lists it as an installed-app screensaver.
2. After the user selects it in Glasshouse, Glasshouse stages the QML and launches it through `com.webos.app.screensaver`.
3. QML loads the shared config snapshot from the service-preferences path.
4. It requests `GET <kioskUrl>/image` with a cache-busting query value and the optional Kiosk password.
5. Two full-screen `Image` items alternate. A new image is only made visible after it has loaded successfully, then the old image cross-fades away.
6. A timer requests the next image at `intervalSeconds` (default 60 seconds). `cache: false` and a changing query value prevent the previous JPEG from being reused.
7. Any remote key is handled by the TV/Glasshouse screensaver lifecycle and dismisses the saver. The QML code does not intercept keys.

The QML will use a black background, `PreserveAspectCrop`, asynchronous image loading, and no sound or video. Each visible photo will receive a slow, subtle randomized pan/zoom over its dwell period so no pixel pattern remains fixed; the transition will cross-fade without flashes. A fixed dark overlay will keep the average brightness conservative for an OLED panel. It will not call Glasshouse's private APIs or try to keep the TV's normal screensaver alive.

### Failure behavior

- Missing or invalid config: stay black and retry periodically.
- Kiosk unavailable: keep showing the last successful image during a short bounded grace period; after two missed refreshes (or an equivalent stale limit), fade to black and retry.
- Failed image decode/load: do not change the visible image immediately, but count the failure toward the stale limit.
- Empty Kiosk result: treat it as a failed refresh and retry.
- A malformed URL or unsupported protocol is rejected by the local config check before use.

### Security and privacy

- Only the Kiosk URL and optional Kiosk password are stored on the TV.
- No Immich API token is copied into this repository or sent directly by the app.
- The password may appear in the TV app's local config and in the Kiosk request URL; this is acceptable only for a trusted home network. The README will warn that rooted-TV users should prefer a Kiosk instance protected by network access controls or omit the Kiosk password where appropriate.
- No new cloud service, analytics, telemetry, or remote control endpoint is introduced.

## Verification

The implementation is complete only when all of these are demonstrated:

1. A local static/config test validates URL and interval validation, required app manifest/service fields, and required screensaver QML markers.
2. `ares-package` (or the repository's equivalent package command) produces a public IPK with no user-specific host or password.
3. The IPK installs on the rooted TV through Homebrew Channel or `ares-install`.
4. First launch shows the settings form; saving `https://kiosk.maha.nz/` persists it, and relaunching opens the configured Kiosk page. The TV remote can operate the existing Kiosk UI.
5. Glasshouse's Screensaver tab lists the app-provided saver and marks the network caution.
6. Selecting and starting the saver displays a Kiosk image, slowly moves it, changes to another image after the configured interval, and eventually fades to black during a prolonged Kiosk outage.
7. A remote key dismisses the saver and the TV returns to the previous app.

## Builder decisions left open

- Exact icon artwork and the final app display title.
- Whether the first cross-fade duration should be one or two seconds.
- The exact `ares-package` invocation and service package layout.
- The smallest static test harness that runs without adding a dependency.
- The exact persistent service-preferences path and the QML filesystem URL for it, to be verified on the target TV.
- A bounded image-load timeout and retry interval, provided the visible-image failure behavior stays as specified.
