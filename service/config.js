'use strict';

var URL = require('url').URL;

var DEFAULT_CONFIG = {
  kioskUrl: '',
  kioskPassword: '',
  intervalSeconds: 60
};

function parseKioskUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || /\s/.test(value)) {
    throw new Error('Kiosk URL must be a non-empty URL without whitespace');
  }
  if (!/^https?:\/\/[^\/?#]/i.test(value)) {
    throw new Error('Kiosk URL must include a host');
  }

  var parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error('Kiosk URL is invalid');
  }

  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
    throw new Error('Kiosk URL must use http or https and include a host');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Kiosk URL must not include credentials');
  }

  var pathname = parsed.pathname;
  if (pathname === '/' || /^\/+$/ .test(pathname)) pathname = '';
  return parsed.protocol + '//' + parsed.host + pathname + parsed.search + parsed.hash;
}

function normalizeInterval(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_CONFIG.intervalSeconds;
  var number = Number(value);
  if (!isFinite(number) || isNaN(number)) return DEFAULT_CONFIG.intervalSeconds;
  number = Math.round(number);
  return Math.max(10, Math.min(3600, number));
}

function normalizeConfig(input) {
  input = input || {};
  var kioskUrl = parseKioskUrl(input.kioskUrl);
  var kioskPassword = input.kioskPassword === undefined || input.kioskPassword === null ? '' : input.kioskPassword;
  if (typeof kioskPassword !== 'string') throw new Error('Kiosk password must be a string');

  return {
    kioskUrl: kioskUrl,
    kioskPassword: kioskPassword,
    intervalSeconds: normalizeInterval(input.intervalSeconds)
  };
}

function validateConfig(input) {
  try {
    return {ok: true, config: normalizeConfig(input)};
  } catch (error) {
    return {ok: false, error: error.message};
  }
}

function appendQuery(url, name, value) {
  if (value === undefined || value === null || value === '') return url;

  var hashIndex = url.indexOf('#');
  var hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  var base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  var separator = base.indexOf('?') === -1 ? '?' : '';
  if (separator === '' && base.charAt(base.length - 1) !== '?' && base.charAt(base.length - 1) !== '&') separator = '&';
  return base + separator + encodeURIComponent(name) + '=' + encodeURIComponent(value) + hash;
}

module.exports = {
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  normalizeConfig: normalizeConfig,
  validateConfig: validateConfig,
  appendQuery: appendQuery
};
