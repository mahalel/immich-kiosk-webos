'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');
var config = require('../service/config');

test('usesNodeCompatibleUrlParser', function () {
  var source = fs.readFileSync('service/config.js', 'utf8');
  assert.doesNotMatch(source, /require\('url'\)\.URL/);
  assert.match(source, /url\.URL/);
  assert.match(source, /url\.parse/);
});

test('rejectsUnsupportedSchemes', function () {
  assert.equal(config.validateConfig({ kioskUrl: 'file:///tmp/x' }).ok, false);
  assert.equal(config.validateConfig({ kioskUrl: 'javascript:alert(1)' }).ok, false);
  assert.equal(config.validateConfig({ kioskUrl: '  https://kiosk.example/  ' }).ok, false);
});

test('rejectsMissingHosts', function () {
  assert.equal(config.validateConfig({ kioskUrl: '' }).ok, false);
  assert.equal(config.validateConfig({ kioskUrl: 'https://' }).ok, false);
  assert.equal(config.validateConfig({ kioskUrl: 'https:///path' }).ok, false);
});

test('normalizesTrailingSlashes', function () {
  assert.equal(
    config.normalizeConfig({ kioskUrl: 'https://kiosk.example///', intervalSeconds: 60 }).kioskUrl,
    'https://kiosk.example'
  );
  assert.equal(
    config.normalizeConfig({ kioskUrl: 'https://kiosk.example/path///?album=family', intervalSeconds: 60 }).kioskUrl,
    'https://kiosk.example/path///?album=family'
  );
});

test('clampsIntervalToTenThrough3600', function () {
  assert.equal(config.normalizeConfig({ kioskUrl: 'https://kiosk.example', intervalSeconds: 1 }).intervalSeconds, 10);
  assert.equal(config.normalizeConfig({ kioskUrl: 'https://kiosk.example', intervalSeconds: 9999 }).intervalSeconds, 3600);
  assert.equal(config.normalizeConfig({ kioskUrl: 'https://kiosk.example' }).intervalSeconds, 60);
  assert.equal(config.normalizeConfig({ kioskUrl: 'https://kiosk.example', intervalSeconds: 'not-a-number' }).intervalSeconds, 60);
});

test('acceptsEmptyPassword', function () {
  var result = config.validateConfig({ kioskUrl: 'https://kiosk.example', kioskPassword: '' });
  assert.equal(result.ok, true);
  assert.equal(result.config.kioskPassword, '');
});

test('appendsEncodedPasswordToExistingQuery', function () {
  var result = config.appendQuery('https://kiosk.example/?theme=dark', 'password', 'a b&c');
  assert.match(result, /theme=dark/);
  assert.match(result, /password=a%20b%26c/);
});
