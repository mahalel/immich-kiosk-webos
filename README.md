# Immich Kiosk for LG webOS

A small webOS launcher and Glasshouse screensaver for an existing [Immich Kiosk](https://github.com/damongolding/immich-kiosk) instance.

This app does not talk to Immich directly. It opens your Kiosk server and asks that server's `/image` endpoint for screensaver photos. Configure albums and ordering on the Kiosk server, not on the TV.

## What it does

- First-run setup on the TV for any Kiosk URL.
- Optional Kiosk password and photo interval.
- Full-screen launch of the configured Kiosk page.
- Glasshouse-compatible screensaver that shows complete photos with black letterboxing when needed and cross-fades between them.
- Temporary network failures keep the last photo briefly; prolonged failures fade to black and retry.
- No cloud service, analytics, or credentials in the published package.

The optional Kiosk password is stored in the TV's local service state and sent as Kiosk's `password` query parameter. Treat a rooted TV and its installed IPK as trusted local devices.

## Requirements

- LG webOS TV with Homebrew Channel/root access.
- Glasshouse installed and custom screensavers enabled.
- An Immich Kiosk server reachable from the TV over HTTP or HTTPS.
- Node.js for tests and the webOS CLI for packaging.

The first target is an LG OLED48C46LA running webOS 10.3.1 with Glasshouse 0.139.0. The screensaver deliberately uses the older `QtQuick 2.4` / `Eos.Window 0.1` baseline.

## Build

Install the webOS CLI if `ares-package` is not already available. Pin the CLI version used by the existing Immich TV project:

```sh
npm install --global @webos-tools/cli@3.2.3
```

Run the tests:

```sh
make test
```

Build a public IPK:

```sh
make package
```

The package contains the app and its Luna service. It does **not** contain a Kiosk host, password, local config file, or Immich credential. `build/` is ignored by Git.

To use a different CLI executable:

```sh
make package ARES="npx --yes @webos-tools/cli@3.2.3 ares-package"
```

## Install and configure

With the TV registered as `lg-tv` in the webOS CLI:

```sh
make install DEVICE=lg-tv
make launch DEVICE=lg-tv
```

Alternatively, install the generated IPK through Homebrew Channel or with `ares-install`.

On the **first launch**:

1. Enter your Immich Kiosk URL, for example `https://kiosk.maha.nz/`.
2. Enter the Kiosk password only if your Kiosk instance requires it.
3. Set the photo interval in seconds. The default is 15 seconds; values are limited to 10–3600 seconds.
4. Select **Save settings**, then **Open Kiosk**.

The app saves settings through `com.mahalel.immichkiosk.service` beside the installed service:

```text
/media/developer/apps/usr/palm/services/com.mahalel.immichkiosk.service/config.json
```

The QML screensaver reads the same file, so changing settings in the app changes the screensaver's source without rebuilding the IPK.

## Select the Glasshouse screensaver

After installing the app:

1. Open Glasshouse's **Screen savers** tab.
2. Find **Immich Kiosk** under installed-app screensavers.
3. Select it and press **Start screen saver** to test it.
4. Leave it selected to use it as the TV's idle screensaver.

Glasshouse will report that this saver reaches the network. That is expected: it loads photos from your Kiosk server.

The saver uses a black base, a conservative dark overlay, complete-photo fitting, and one-second cross-fades. Portrait or non-16:9 photos may have black letterboxing rather than being cropped. This does not replace LG's panel-care features. Use Glasshouse's **Poweroff after** setting if the TV should eventually enter standby.

If testing goes wrong, select **LG default** in Glasshouse's screensaver tab before troubleshooting. The Glasshouse screensaver files can also be inspected over SSH; do not delete the active saver while it is running.

## Network and TLS notes

- The TV must be able to resolve and reach the configured Kiosk host.
- HTTP and HTTPS with a certificate trusted by the TV are supported.
- Self-signed HTTPS certificates are not a first-version target; use a trusted certificate or HTTP on a trusted home network.
- Kiosk's own configuration controls albums, ordering, image processing, and its optional password.

## Development checks

```sh
make test
node --check app/app.js
node --check service/service.js
```

Glasshouse's QML compatibility check can be run against the screensaver source with a checkout of Glasshouse:

```sh
node - <<'NODE'
var fs = require('fs');
var qmlcheck = require('/tmp/glasshouse-research/server/lib/qmlcheck');
var qml = fs.readFileSync('app/assets/screensaver-main.qml', 'utf8');
console.log(qmlcheck.problem(qml, 'screensaver-main.qml', 10) || 'QML compatibility checks passed');
console.log(qmlcheck.reaches(qml));
NODE
```

The public package intentionally has no user-specific configuration. Do not commit an IPK containing your private password.
