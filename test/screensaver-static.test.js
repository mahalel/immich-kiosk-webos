'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');

var qml = fs.readFileSync('app/assets/screensaver-main.qml', 'utf8');

test('hasGlasshouseWindowHeader', function () {
  assert.match(qml, /import QtQuick 2\.4/);
  assert.match(qml, /import Eos\.Window 0\.1/);
  assert.match(qml, /windowType:\s*"_WEBOS_WINDOW_TYPE_SCREENSAVER"/);
  assert.match(qml, /appId:\s*"com\.webos\.app\.screensaver"/);
  assert.match(qml, /width:\s*1920/);
  assert.match(qml, /height:\s*1080/);
});

test('usesOnlyCompatibleImports', function () {
  assert.doesNotMatch(qml, /import QtQuick (?!2\.4\b)/);
  assert.doesNotMatch(qml, /import QtMultimedia/);
});

test('loadsSharedConfigPath', function () {
  assert.match(qml, /file:\/\/\/media\/developer\/apps\/usr\/palm\/services\/com\.mahalel\.immichkiosk\.service\/config\.json/);
  assert.match(qml, /XMLHttpRequest/);
});

test('requestsKioskImages', function () {
  assert.match(qml, /\/image/);
  assert.match(qml, /encodeURIComponent/);
  assert.match(qml, /nonce/);
});

test('disablesImageCache', function () {
  assert.match(qml, /cache:\s*false/);
  assert.match(qml, /asynchronous:\s*true/);
});

test('hasTwoImageLayers', function () {
  assert.match(qml, /id:\s*imageA/);
  assert.match(qml, /id:\s*imageB/);
  assert.match(qml, /Image\.PreserveAspectFit/);
  assert.match(qml, /Image\.Ready/);
  assert.doesNotMatch(qml, /Image\.Loaded/);
  assert.doesNotMatch(qml, /Image\.PreserveAspectCrop/);
  assert.doesNotMatch(qml, /width: win\.width \*/);
  assert.doesNotMatch(qml, /height: win\.height \*/);
  assert.match(qml, /NumberAnimation\s*\{\s*duration:\s*1000/);
});

test('usesFifteenSecondDefault', function () {
  assert.match(qml, /property int intervalSeconds: 15/);
  assert.match(qml, /intervalSeconds = 15/);
});

test('hasStaleFailurePath', function () {
  assert.match(qml, /MAX_MISSED_REFRESHES\s*:\s*2/);
  assert.match(qml, /IMAGE_TIMEOUT_MS\s*:\s*15000/);
  assert.match(qml, /hasImage\s*=\s*false/);
});

test('doesNotUseSoundOrVideo', function () {
  assert.doesNotMatch(qml, /\bAudio\b|\bVideo\b|\bMediaPlayer\b|SoundEffect/);
  assert.doesNotMatch(qml, /__TVWEB_/);
});
