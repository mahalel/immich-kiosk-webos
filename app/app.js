'use strict';

(function () {
  var SERVICE = 'com.mahalel.immichkiosk.service';
  var currentConfig = null;
  var bridge = null;

  function element(id) {
    return document.getElementById(id);
  }

  function showError(message) {
    element('error-message').textContent = message || '';
  }

  function showPanel(id) {
    ['loading-panel', 'settings-panel', 'launcher-panel'].forEach(function (panelId) {
      var panel = element(panelId);
      panel.className = panelId === id ? 'panel' : 'panel hidden';
    });
  }

  function callService(method, payload, callback) {
    if (typeof window.WebOSServiceBridge !== 'function') {
      callback(new Error('webOS service bridge is unavailable'));
      return;
    }

    bridge = new window.WebOSServiceBridge();
    bridge.onservicecallback = function (raw) {
      var response;
      try {
        response = JSON.parse(raw);
      } catch (error) {
        callback(new Error('The configuration service returned invalid data'));
        return;
      }
      if (!response.returnValue) {
        callback(new Error(response.errorText || 'The configuration service failed'));
        return;
      }
      callback(null, response);
    };
    bridge.call('luna://' + SERVICE + '/' + method, JSON.stringify(payload || {}));
  }

  function appendQuery(url, name, value) {
    if (!value) return url;
    var hashIndex = url.indexOf('#');
    var hash = hashIndex === -1 ? '' : url.slice(hashIndex);
    var base = hashIndex === -1 ? url : url.slice(0, hashIndex);
    var separator = base.indexOf('?') === -1 ? '?' : '';
    if (separator === '' && base.charAt(base.length - 1) !== '?' && base.charAt(base.length - 1) !== '&') separator = '&';
    return base + separator + encodeURIComponent(name) + '=' + encodeURIComponent(value) + hash;
  }

  function fillSettings(config) {
    element('kiosk-url').value = config.kioskUrl || '';
    element('kiosk-password').value = config.kioskPassword || '';
    element('interval-seconds').value = config.intervalSeconds || 60;
  }

  function showSettings(config) {
    fillSettings(config || {kioskUrl: '', kioskPassword: '', intervalSeconds: 60});
    element('cancel-settings').style.display = currentConfig && currentConfig.kioskUrl ? '' : 'none';
    showPanel('settings-panel');
  }

  function showLauncher(config) {
    currentConfig = config;
    element('launcher-message').textContent = 'Your Kiosk server is ready.';
    showPanel('launcher-panel');
  }

  function loadConfig() {
    showError('');
    showPanel('loading-panel');
    callService('getConfig', {}, function (error, response) {
      if (error) {
        showError(error.message);
        showSettings({kioskUrl: '', kioskPassword: '', intervalSeconds: 60});
        return;
      }
      if (!response.config || !response.config.kioskUrl) {
        showSettings(response.config);
      } else {
        showLauncher(response.config);
      }
    });
  }

  function saveSettings(event) {
    event.preventDefault();
    showError('');
    var payload = {
      kioskUrl: element('kiosk-url').value,
      kioskPassword: element('kiosk-password').value,
      intervalSeconds: element('interval-seconds').value
    };
    callService('saveConfig', payload, function (error, response) {
      if (error) {
        showError(error.message);
        return;
      }
      showLauncher(response.config);
    });
  }

  function openKiosk() {
    if (!currentConfig || !currentConfig.kioskUrl) {
      showSettings(currentConfig);
      return;
    }
    window.location.replace(appendQuery(currentConfig.kioskUrl, 'password', currentConfig.kioskPassword));
  }

  function init() {
    element('settings-form').addEventListener('submit', saveSettings);
    element('open-kiosk').addEventListener('click', openKiosk);
    element('edit-settings').addEventListener('click', function () {
      showError('');
      showSettings(currentConfig);
    });
    element('cancel-settings').addEventListener('click', function () {
      if (currentConfig && currentConfig.kioskUrl) showLauncher(currentConfig);
    });
    loadConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
