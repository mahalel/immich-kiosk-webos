import QtQuick 2.4
import Eos.Window 0.1

WebOSWindow {
    id: win

    width: 1920
    height: 1080
    windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"
    appId: "com.webos.app.screensaver"
    title: "Screen Saver"
    visible: true
    color: "black"

    property string configFileUrl: "file:///media/developer/apps/usr/palm/services/com.mahalel.immichkiosk.service/config.json"
    property string kioskUrl: ""
    property string kioskPassword: ""
    property int intervalSeconds: 60
    property bool configReady: false
    property bool hasImage: false
    property int activeLayer: 0
    property int pendingLayer: -1
    property int missedRefreshes: 0
    property int imageNonce: 0
    property real motionTime: Math.random() * 1000
    property real motionSeedX: Math.random() * 6.283185
    property real motionSeedY: Math.random() * 6.283185
    property real motionSeedZoom: Math.random() * 6.283185
    property int maxMissedRefreshes: 2
    property int imageTimeoutMs: 15000

    // MAX_MISSED_REFRESHES: 2
    // IMAGE_TIMEOUT_MS: 15000

    function appendQuery(url, name, value) {
        if (value === undefined || value === null || value === "") return url;
        var hashIndex = url.indexOf("#");
        var hash = hashIndex === -1 ? "" : url.slice(hashIndex);
        var base = hashIndex === -1 ? url : url.slice(0, hashIndex);
        var separator = base.indexOf("?") === -1 ? "?" : "";
        if (separator === "" && base.charAt(base.length - 1) !== "?" && base.charAt(base.length - 1) !== "&") separator = "&";
        return base + separator + encodeURIComponent(name) + "=" + encodeURIComponent(value) + hash;
    }

    function appendPath(url, path) {
        var hashIndex = url.indexOf("#");
        var hash = hashIndex === -1 ? "" : url.slice(hashIndex);
        var withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
        var queryIndex = withoutHash.indexOf("?");
        var query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex);
        var base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
        while (base.length > 0 && base.charAt(base.length - 1) === "/") base = base.slice(0, base.length - 1);
        return base + path + query + hash;
    }

    function validConfig(parsed) {
        if (!parsed || typeof parsed.kioskUrl !== "string") return false;
        if (/\s/.test(parsed.kioskUrl) || !/^https?:\/\/[^\/?#]/i.test(parsed.kioskUrl)) return false;
        if (parsed.kioskPassword !== undefined && typeof parsed.kioskPassword !== "string") return false;
        return true;
    }

    function applyConfig(parsed) {
        if (!validConfig(parsed)) return false;
        kioskUrl = parsed.kioskUrl;
        kioskPassword = parsed.kioskPassword || "";
        intervalSeconds = Number(parsed.intervalSeconds);
        if (!isFinite(intervalSeconds) || isNaN(intervalSeconds)) intervalSeconds = 60;
        intervalSeconds = Math.round(intervalSeconds);
        intervalSeconds = Math.max(10, Math.min(3600, intervalSeconds));
        configReady = true;
        configRetry.stop();
        requestImage();
        return true;
    }

    function loadConfig() {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status !== 0 && xhr.status !== 200) {
                configRetry.start();
                return;
            }
            try {
                if (!applyConfig(JSON.parse(xhr.responseText))) configRetry.start();
            } catch (error) {
                configRetry.start();
            }
        };
        try {
            xhr.open("GET", configFileUrl);
            xhr.send();
        } catch (error) {
            configRetry.start();
        }
    }

    function imageUrl() {
        var url = appendPath(kioskUrl, "/image");
        url = appendQuery(url, "password", kioskPassword);
        imageNonce += 1;
        return appendQuery(url, "kiosk_nonce", "" + imageNonce);
    }

    function requestImage() {
        if (!configReady || pendingLayer !== -1) return;
        var layer = hasImage ? 1 - activeLayer : 0;
        pendingLayer = layer;
        if (layer === 0) {
            imageA.source = "";
            imageA.source = imageUrl();
        } else {
            imageB.source = "";
            imageB.source = imageUrl();
        }
        imageTimeout.interval = imageTimeoutMs;
        imageTimeout.start();
    }

    function imageLoaded(layer) {
        if (pendingLayer !== layer) return;
        pendingLayer = -1;
        imageTimeout.stop();
        retryTimer.stop();
        missedRefreshes = 0;
        hasImage = true;
        activeLayer = layer;
        slideTimer.interval = intervalSeconds * 1000;
        slideTimer.start();
    }

    function imageFailed(layer) {
        if (pendingLayer !== layer) return;
        pendingLayer = -1;
        imageTimeout.stop();
        missedRefreshes += 1;
        if (missedRefreshes >= maxMissedRefreshes) hasImage = false;
        retryTimer.start();
    }

    function imageTimedOut() {
        if (pendingLayer === -1) return;
        imageFailed(pendingLayer);
    }

    Item {
        id: layerA
        anchors.fill: parent
        opacity: win.hasImage && win.activeLayer === 0 ? 1 : 0
        clip: true
        Behavior on opacity { NumberAnimation { duration: 1000; easing.type: Easing.InOutQuad } }

        Image {
            id: imageA
            width: win.width * (1.08 + 0.04 * (0.5 + 0.5 * Math.sin(win.motionTime * 0.025 + win.motionSeedZoom)))
            height: win.height * (1.08 + 0.04 * (0.5 + 0.5 * Math.sin(win.motionTime * 0.025 + win.motionSeedZoom)))
            x: (win.width - width) * (0.5 + 0.5 * Math.sin(win.motionTime * 0.031 + win.motionSeedX))
            y: (win.height - height) * (0.5 + 0.5 * Math.sin(win.motionTime * 0.027 + win.motionSeedY))
            asynchronous: true
            cache: false
            fillMode: Image.PreserveAspectCrop
            smooth: true
            onStatusChanged: {
                if (status === Image.Ready) win.imageLoaded(0);
                else if (status === Image.Error) win.imageFailed(0);
            }
        }
    }

    Item {
        id: layerB
        anchors.fill: parent
        opacity: win.hasImage && win.activeLayer === 1 ? 1 : 0
        clip: true
        Behavior on opacity { NumberAnimation { duration: 1000; easing.type: Easing.InOutQuad } }

        Image {
            id: imageB
            width: win.width * (1.08 + 0.04 * (0.5 + 0.5 * Math.sin(win.motionTime * 0.025 + win.motionSeedZoom)))
            height: win.height * (1.08 + 0.04 * (0.5 + 0.5 * Math.sin(win.motionTime * 0.025 + win.motionSeedZoom)))
            x: (win.width - width) * (0.5 + 0.5 * Math.sin(win.motionTime * 0.031 + win.motionSeedX))
            y: (win.height - height) * (0.5 + 0.5 * Math.sin(win.motionTime * 0.027 + win.motionSeedY))
            asynchronous: true
            cache: false
            fillMode: Image.PreserveAspectCrop
            smooth: true
            onStatusChanged: {
                if (status === Image.Ready) win.imageLoaded(1);
                else if (status === Image.Error) win.imageFailed(1);
            }
        }
    }

    Rectangle {
        anchors.fill: parent
        color: "black"
        opacity: 0.18
    }

    Timer {
        id: motionTimer
        interval: 33
        running: true
        repeat: true
        onTriggered: win.motionTime += 0.033
    }

    Timer {
        id: slideTimer
        repeat: false
        onTriggered: win.requestImage()
    }

    Timer {
        id: retryTimer
        interval: 15000
        repeat: false
        onTriggered: win.requestImage()
    }

    Timer {
        id: imageTimeout
        interval: 15000
        repeat: false
        onTriggered: win.imageTimedOut()
    }

    Timer {
        id: configRetry
        interval: 30000
        repeat: false
        onTriggered: win.loadConfig()
    }

    Component.onCompleted: win.loadConfig()
}
