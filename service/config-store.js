'use strict';

var fs = require('fs');
var config = require('./config');

var CONFIG_PATH = '/var/luna/preferences/com.mahalel.immichkiosk.json';

function defaults() {
  return {
    kioskUrl: config.DEFAULT_CONFIG.kioskUrl,
    kioskPassword: config.DEFAULT_CONFIG.kioskPassword,
    intervalSeconds: config.DEFAULT_CONFIG.intervalSeconds
  };
}

function readConfig(filePath) {
  var raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return defaults();
  }

  try {
    var parsed = JSON.parse(raw);
    var result = config.validateConfig(parsed);
    return result.ok ? result.config : defaults();
  } catch (error) {
    return defaults();
  }
}

function writeConfig(filePath, value) {
  var result = config.validateConfig(value);
  if (!result.ok) throw new Error(result.error);

  var temporaryPath = filePath + '.tmp-' + process.pid + '-' + Date.now();
  var data = JSON.stringify(result.config) + '\n';

  try {
    fs.writeFileSync(temporaryPath, data, {encoding: 'utf8', mode: 384});
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch (cleanupError) {}
    throw error;
  }

}

module.exports = {
  CONFIG_PATH: CONFIG_PATH,
  DEFAULT_CONFIG: config.DEFAULT_CONFIG,
  readConfig: readConfig,
  writeConfig: writeConfig
};
