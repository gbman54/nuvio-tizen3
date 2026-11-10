/* Trakt sync (optional, separate module). Device-code flow. No-ops without client ID. */
var Trakt = (function () {
  'use strict';
  var API = 'https://api.trakt.tv';
  var TIMEOUT = 8000;
  function settings() { return Store.settings(); }
  function token() { return settings().trakt && settings().trakt.token; }
  // Start device-code flow. cb(err, {user_code, verification_url, device_code, expires_in, interval})
  function startDevice(clientId, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    xhr.open('POST', API + '/oauth/device/code', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = TIMEOUT;
    xhr.ontimeout = function () { if (!done) { done = true; cb(new Error('timeout')); } };
    xhr.onerror = function () { if (!done) { done = true; cb(new Error('network')); } };
    xhr.onload = function () {
      if (done) return; done = true;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { cb(null, JSON.parse(xhr.responseText)); } catch (e) { cb(e); }
      } else cb(new Error('http ' + xhr.status));
    };
    xhr.send(JSON.stringify({ client_id: clientId }));
  }
  function pollToken(clientId, deviceCode, intervalSec, onStatus, cb) {
    var interval = (intervalSec || 5) * 1000;
    var elapsed = 0, max = 10 * 60 * 1000;
    var stopped = false;
    function tick() {
      if (stopped) return;
      if (elapsed > max) { cb(new Error('expired')); return; }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/oauth/device/token', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = TIMEOUT;
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var body = JSON.parse(xhr.responseText);
            var s = settings();
            s.trakt = s.trakt || {}; s.trakt.token = body.access_token; s.trakt.refresh = body.refresh_token;
            Store.save();
            // fetch username
            xhr2(body.access_token);
          } catch (e) { schedule(); }
        } else if (xhr.status === 400) { schedule(); }
        else schedule();
      };
      xhr.onerror = schedule;
      xhr.ontimeout = schedule;
      xhr.send(JSON.stringify({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: clientId, device_code: deviceCode }));
      function schedule() { elapsed += interval; if (onStatus) onStatus('waiting'); setTimeout(tick, interval); }
    }
    tick();
    function xhr2(tok) {
      var x = new XMLHttpRequest();
      x.open('GET', API + '/users/settings', true);
      x.setRequestHeader('Authorization', 'Bearer ' + tok);
      x.setRequestHeader('trakt-api-version', '2');
      x.onload = function () {
        try { var b = JSON.parse(x.responseText); var s = settings(); s.trakt.username = (b.user && b.user.username) || ''; Store.save(); } catch (e) {}
        cb(null, tok);
      };
      x.onerror = function () { cb(null, tok); };
      x.send();
    }
    return { stop: function () { stopped = true; } };
  }
  function logout() {
    var s = settings(); s.trakt = { token: null, refresh: null, username: '' }; Store.save();
  }
  // Scrobble: fire-and-forget POST /scrobbles/{start|pause|stop}
  function scrobble(session, pos, dur, action) {
    var tok = token();
    if (!tok) return;
    var body = { movie: null, show: null, episode: null, progress: dur > 0 ? Math.round((pos / dur) * 100) : 0, status: action || 'pause' };
    // Trakt needs ids; we only have Stremio ids (tt...). Send imdb id.
    var imdb = /^tt/.test(session.id) ? session.id : null;
    if (session.type === 'movie') body.movie = { ids: { imdb: imdb } };
    else if (session.type === 'series') {
      var m = session.videoId.match(/:(\d+):(\d+)$/);
      body.show = { ids: { imdb: imdb } };
      if (m) body.episode = { ids: { imdb: imdb }, season: parseInt(m[1], 10), number: parseInt(m[2], 10) };
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/scrobbles/' + (action || 'pause'), true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + tok);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('trakt-api-version', '2');
    xhr.timeout = TIMEOUT;
    xhr.send(JSON.stringify(body));
  }
  function syncWatched() {
    // Push watched flags for movies/series with tt ids (best-effort)
    var tok = token();
    if (!tok) return;
    var watched = Store.profile().watched || {};
    var items = [];
    Object.keys(watched).forEach(function (k) {
      var parts = k.split(':');
      if (parts[0] === 'movie' && /^tt/.test(parts[1])) items.push({ ids: { imdb: parts[1] } });
    });
    if (!items.length) return;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/sync/history', true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + tok);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('trakt-api-version', '2');
    xhr.timeout = TIMEOUT;
    xhr.send(JSON.stringify({ movies: items }));
  }
  // Render into settings host
  function render(host) {
    host.innerHTML = '';
    var s = settings();
    var t = I18n.t;
    if (token()) {
      host.appendChild(Util.el('div', 'detail-sub', '✓ ' + (s.trakt.username || 'Trakt')));
      var out = Util.el('button', 'btn focusable', t('traktLogout'));
      out.setAttribute('data-focus-id', 'trakt-logout');
      out.setAttribute('type', 'button');
      out.onclick = function () { logout(); render(host); };
      host.appendChild(out);
      var sync = Util.el('button', 'btn focusable', 'Sync watched');
      sync.setAttribute('data-focus-id', 'trakt-sync');
      sync.setAttribute('type', 'button');
      sync.onclick = function () { syncWatched(); Views.toast('Sync sent'); };
      host.appendChild(sync);
      return;
    }
    var label = Util.el('span', 'setting-label', t('traktClientId'));
    host.appendChild(label);
    var inp = document.createElement('input');
    inp.className = 'setting-input focusable';
    inp.setAttribute('data-focus-id', 'trakt-client-id');
    inp.value = s.traktClientId || '';
    inp.setAttribute('readonly', 'readonly');
    host.appendChild(inp);
    var open = Util.el('button', 'btn focusable', '⌨');
    open.setAttribute('data-focus-id', 'trakt-open');
    open.setAttribute('type', 'button');
    host.appendChild(open);
    var status = Util.el('div', 'detail-sub', '');
    host.appendChild(status);
    var login = Util.el('button', 'btn focusable', t('traktLogin'));
    login.setAttribute('data-focus-id', 'trakt-login');
    login.setAttribute('type', 'button');
    host.appendChild(login);
    // keyboard host appended by settings page is .kb-host; reuse pattern: create local host
    var kbHost = Util.el('div', 'kb-host hidden');
    host.appendChild(kbHost);
    open.onclick = function () {
      kbHost.classList.remove('hidden');
      Kb.render(kbHost, { initial: inp.value, idPrefix: 'trakt-kb', onInput: function () {}, onDone: function (v) { kbHost.classList.add('hidden'); inp.value = v; Store.setSetting('traktClientId', v); FocusMgr.focusFirst(); } });
      FocusMgr.focusFirst();
    };
    login.onclick = function () {
      var cid = inp.value.trim();
      if (!cid) { status.textContent = t('invalidUrl'); return; }
      status.textContent = t('loading');
      startDevice(cid, function (err, dc) {
        if (err) { status.textContent = t('errorNetwork'); return; }
        status.textContent = t('traktCode') + ': ' + dc.verification_url + ' · ' + dc.user_code + ' · ' + t('traktWaiting');
        pollToken(cid, dc.device_code, dc.interval || 5, function (st) { status.textContent = t('traktWaiting'); }, function (err2) {
          if (err2) { status.textContent = t('errorNetwork'); return; }
          render(host);
        });
      });
    };
  }
  return { startDevice: startDevice, pollToken: pollToken, logout: logout, scrobble: scrobble, syncWatched: syncWatched, render: render };
})();
