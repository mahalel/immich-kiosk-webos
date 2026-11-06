'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');

var html = fs.readFileSync('app/index.html', 'utf8');
var script = fs.readFileSync('app/app.js', 'utf8');
var styles = fs.readFileSync('app/styles.css', 'utf8');
var source = html + '\n' + script + '\n' + styles;

test('containsRequiredWebOSServiceId', function () {
  assert.match(script, /com\.mahalel\.immichkiosk\.service/);
  assert.match(script, /getConfig/);
  assert.match(script, /saveConfig/);
  assert.match(script, /WebOSServiceBridge/);
});

test('containsConfigurationFields', function () {
  ['kiosk-url', 'kiosk-password', 'interval-seconds', 'save-settings', 'cancel-settings'].forEach(function (id) {
    assert.match(html, new RegExp('id="' + id + '"'));
  });
});

test('usesFifteenSecondDefault', function () {
  assert.match(html, /id="interval-seconds"[^>]+value="15"/);
  assert.match(script, /intervalSeconds: 15/);
});

test('containsLauncherActions', function () {
  assert.match(html, /id="open-kiosk"/);
  assert.match(html, /id="edit-settings"/);
});

test('containsNoPersonalHostOrImmichKey', function () {
  assert.doesNotMatch(source, /kiosk\.maha\.nz/);
  assert.doesNotMatch(source, /immich_api_key/i);
  assert.doesNotMatch(source, /x-api-key/i);
});
