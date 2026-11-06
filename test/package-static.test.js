'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');

var appInfo = JSON.parse(fs.readFileSync('app/appinfo.json', 'utf8'));
var services = JSON.parse(fs.readFileSync('service/services.json', 'utf8'));
var appSource = fs.readFileSync('app/index.html', 'utf8') + fs.readFileSync('app/app.js', 'utf8') + fs.readFileSync('app/assets/screensaver-main.qml', 'utf8');
var serviceSource = fs.readFileSync('service/config-store.js', 'utf8') + fs.readFileSync('service/service.js', 'utf8');

test('hasMatchingAppAndServiceIds', function () {
  assert.equal(appInfo.id, 'com.mahalel.immichkiosk');
  assert.equal(services.id, 'com.mahalel.immichkiosk.service');
  assert.equal(services.services[0].name, services.id);
});

test('hasScreensaverEntryPoint', function () {
  assert.equal(fs.existsSync('app/assets/screensaver-main.qml'), true);
  assert.match(appSource, /_WEBOS_WINDOW_TYPE_SCREENSAVER/);
});

test('hasNoUserConfig', function () {
  assert.equal(fs.existsSync('app/assets/config.json'), false);
  assert.doesNotMatch(appSource + '\n' + serviceSource, /kiosk\.maha\.nz/);
});

test('hasNoImmichApiKey', function () {
  assert.doesNotMatch(appSource + '\n' + serviceSource, /immich_api_key|x-api-key/i);
  assert.match(serviceSource, /com\.mahalel\.immichkiosk\.service\/config\.json/);
});

test('hasPackageDocumentation', function () {
  assert.equal(fs.existsSync('README.md'), true);
  var readme = fs.readFileSync('README.md', 'utf8');
  assert.match(readme, /first[- ]run/i);
  assert.match(readme, /Glasshouse/i);
  assert.match(readme, /screensaver/i);
});
