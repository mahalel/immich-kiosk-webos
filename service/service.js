'use strict';
/* eslint-disable no-var -- webOS 4 services may run on Node 0.12 */

var Service = require('webos-service');
var store = require('./config-store');

var service = new Service('com.mahalel.immichkiosk.service');

function failure(message, error) {
  return {
    returnValue: false,
    errorText: message + (error && error.message ? ': ' + error.message : '')
  };
}

service.register('getConfig', function (message) {
  try {
    message.respond({returnValue: true, config: store.readConfig(store.CONFIG_PATH)});
  } catch (error) {
    message.respond(failure('Could not read configuration', error));
  }
});

service.register('saveConfig', function (message) {
  try {
    store.writeConfig(store.CONFIG_PATH, message.payload || {});
    message.respond({returnValue: true, config: store.readConfig(store.CONFIG_PATH)});
  } catch (error) {
    message.respond(failure('Could not save configuration', error));
  }
});
