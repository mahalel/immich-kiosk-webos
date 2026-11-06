'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var test = require('node:test');
var store = require('../service/config-store');

function withTempFile(callback) {
  var directory = fs.mkdtempSync(path.join(os.tmpdir(), 'immich-kiosk-'));
  var filePath = path.join(directory, 'config.json');
  try {
    callback(filePath, directory);
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
}

test('returnsDefaultsWhenStateIsMissing', function () {
  withTempFile(function (filePath) {
    assert.deepEqual(store.readConfig(filePath), store.DEFAULT_CONFIG);
  });
});

test('returnsDefaultsWhenStateIsCorrupt', function () {
  withTempFile(function (filePath) {
    fs.writeFileSync(filePath, '{not json', 'utf8');
    assert.deepEqual(store.readConfig(filePath), store.DEFAULT_CONFIG);
  });
});

test('writesAndReadsNormalizedState', function () {
  withTempFile(function (filePath) {
    store.writeConfig(filePath, {
      kioskUrl: 'https://kiosk.example///',
      kioskPassword: 'secret',
      intervalSeconds: 2
    });
    assert.deepEqual(store.readConfig(filePath), {
      kioskUrl: 'https://kiosk.example',
      kioskPassword: 'secret',
      intervalSeconds: 10
    });
  });
});

test('replacesStateAtomically', function () {
  withTempFile(function (filePath, directory) {
    store.writeConfig(filePath, {
      kioskUrl: 'https://old.example',
      kioskPassword: '',
      intervalSeconds: 60
    });
    store.writeConfig(filePath, {
      kioskUrl: 'https://new.example',
      kioskPassword: '',
      intervalSeconds: 60
    });
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).kioskUrl, 'https://new.example');
    assert.deepEqual(fs.readdirSync(directory), ['config.json']);
  });
});

test('doesNotPersistUnvalidatedValues', function () {
  withTempFile(function (filePath) {
    store.writeConfig(filePath, {
      kioskUrl: 'https://old.example',
      kioskPassword: '',
      intervalSeconds: 60
    });
    assert.throws(function () {
      store.writeConfig(filePath, {kioskUrl: 'file:///tmp/nope'});
    }, /Kiosk URL/);
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).kioskUrl, 'https://old.example');
  });
});
