/* App bootstrap: input handling, debug overlay, scaling, Tizen keys */
(function () {
  'use strict';
  var KEY = { BACK: 10009, ENTER: 13, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40 };
  var debugOn = false;
  var debugBuf = [];
  var colorSeq = [];
  var COLOR_SEQ_TARGET = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'];
  // Debug overlay toggle also via: Back,Back,Back quickly
  var backTimes = [];

  function scaleStage() {
    var stage = document.getElementById('stage');
    var w = window.innerWidth || 1920, h = window.innerHeight || 1080;
    var s = Math.min(w / 1920, h / 1080);
    if (s <= 0) s = 1;
    stage.style.webkitTransform = 'scale(' + s + ')';
    stage.style.transform = 'scale(' + s + ')';
    stage.style.width = '1920px'; stage.style.height = '1080px';
  }
  window.addEventListener('resize', scaleStage);

  function logDebug(msg) {
    var line = '[' + new Date().toTimeString().slice(0, 8) + '] ' + msg;
    debugBuf.push(line);
    if (debugBuf.length > 100) debugBuf.shift();
    if (debugOn) {
      var d = document.getElementById('debug');
      d.textContent = debugBuf.join('\n');
    }
  }
  window.onerror = function (msg, src, line, col, err) {
    logDebug('ERROR: ' + msg + ' @ ' + src + ':' + line + ':' + col);
    if (!debugOn) toggleDebug(true);
    return false;
  };
  function toggleDebug(force) {
    debugOn = force != null ? force : !debugOn;
    var d = document.getElementById('debug');
    d.className = debugOn ? '' : 'hidden';
    if (debugOn) d.textContent = debugBuf.join('\n') || 'debug on';
  }
  try {
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('MediaPlay');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('MediaPause');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('MediaPlayPause');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('MediaStop');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('MediaFastForward');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('MediaRewind');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('ColorF0Red');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('ColorF1Green');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('ColorF2Yellow');
    tizen.tvinputdevice && tizen.tvinputdevice.registerKey && tizen.tvinputdevice.registerKey('ColorF3Blue');
  } catch (e) { /* not on Tizen */ }

  function keyName(e) {
    if (e.key) {
      if (e.key === 'ArrowLeft') return 'left';
      if (e.key === 'ArrowRight') return 'right';
      if (e.key === 'ArrowUp') return 'up';
      if (e.key === 'ArrowDown') return 'down';
      if (e.key === 'Enter') return 'enter';
      if (e.key === 'Escape' || e.key === 'Backspace') return 'back';
      if (e.key === ' ' || e.key === 'Spacebar') return 'space';
    }
    var c = e.keyCode || e.which;
    if (c === 37) return 'left';
    if (c === 38) return 'up';
    if (c === 39) return 'right';
    if (c === 40) return 'down';
    if (c === 13) return 'enter';
    if (c === 10009) return 'back';
    if (c === 32) return 'space';
    if (c === 8) return 'back';
    // Tizen media keys
    if (c === 10252 || c === 415) return 'playpause'; // MediaPlayPause variants
    if (c === 10253 || c === 19) return 'play';
    if (c === 10254 || c === 20) return 'pause';
    if (c === 10251) return 'stop';
    if (c === 10250) return 'ff';
    if (c === 10249) return 'rw';
    if (c === 403) return 'ColorF0Red';
    if (c === 404) return 'ColorF1Green';
    if (c === 405) return 'ColorF2Yellow';
    if (c === 406) return 'ColorF3Blue';
    return null;
  }

  function handleBack() {
    // player open -> stop
    if (Player.isActive()) {
      Player.stop();
      // return to streams/detail view that launched it
      var ss = Views.getStream();
      if (ss && ss.type) Views.renderStreams(ss.type, ss.id, ss.videoId, ss.meta);
      else Views.renderHome();
      return;
    }
    // dialog open -> close
    if (document.getElementById('dialog-root').innerHTML) { Views.closeDialog(); return; }
    // keyboard visible? go home
    var current = document.querySelector('.kb-host:not(.hidden)');
    // simple: go home on back from non-home, exit dialog on home
    var isHome = !!document.querySelector('.top-btn.top-active') && document.querySelector('.top-active') && document.querySelector('.top-active').getAttribute('data-focus-id') === 'top-home';
    // fallback: check if home hero exists
    if (document.querySelector('.hero')) {
      Views.showDialog(I18n.t('exit'), '', [ { label: I18n.t('yes') }, { label: I18n.t('no') } ], function (idx) {
        if (idx === 0) exitApp();
      });
    } else {
      Views.renderHome();
    }
  }
  function exitApp() {
    try {
      if (window.tizen && tizen.application && tizen.application.getCurrentApplication) {
        tizen.application.getCurrentApplication().exit();
        return;
      }
    } catch (e) {}
    // browser dev fallback
    Views.toast('exit() not available in browser dev mode');
  }

  document.addEventListener('keydown', function (e) {
    var name = keyName(e);
    // color sequence debug toggle
    if (name && name.indexOf('ColorF') === 0) {
      colorSeq.push(name);
      if (colorSeq.length > 4) colorSeq.shift();
      if (colorSeq.join(',') === COLOR_SEQ_TARGET.join(',')) { toggleDebug(); colorSeq = []; e.preventDefault(); return; }
    }
    if (name === 'back') {
      // triple-back debug toggle
      var now = Date.now();
      backTimes.push(now);
      backTimes = backTimes.filter(function (t) { return now - t < 1500; });
      if (backTimes.length >= 3 && !Player.isActive()) { toggleDebug(); backTimes = []; e.preventDefault(); return; }
    }
    if (Player.isActive()) {
      var menuOpen = Player.isTrackMenuOpen && Player.isTrackMenuOpen();
      if (menuOpen) {
        if (name === 'back') { e.preventDefault(); Player.closeTrackMenu(); return; }
        if (name === 'up' || name === 'down' || name === 'left' || name === 'right') {
          e.preventDefault(); FocusMgr.move(name); return;
        }
        if (name === 'enter') {
          var mel = FocusMgr.getFocus();
          var mact = mel && mel.getAttribute ? mel.getAttribute('data-action') : null;
          if (mact && mact.indexOf('osd-') === 0) { e.preventDefault(); Views.onAction(mact, mel); return; }
          e.preventDefault(); Player.closeTrackMenu(); return;
        }
        return;
      }
      if (name === 'back') { e.preventDefault(); handleBack(); return; }
      if (name === 'enter') {
        var fel = FocusMgr.getFocus();
        var fact = fel && fel.getAttribute ? fel.getAttribute('data-action') : null;
        if (fact && fact.indexOf('osd-') === 0) { e.preventDefault(); Views.onAction(fact, fel); return; }
      }
      if (name === 'enter' || name === 'playpause' || name === 'play' || name === 'pause') { e.preventDefault(); Player.togglePlay(); return; }
      if (name === 'left') { e.preventDefault(); if (e.repeat) Player.seekAccumulate(-1); else Player.seekBy(-10); return; }
      if (name === 'right') { e.preventDefault(); if (e.repeat) Player.seekAccumulate(1); else Player.seekBy(10); return; }
      if (name === 'ff') { e.preventDefault(); Player.seekBy(30); return; }
      if (name === 'rw') { e.preventDefault(); Player.seekBy(-30); return; }
      if (name === 'stop') { e.preventDefault(); handleBack(); return; }
      if (name === 'up' || name === 'down') {
        e.preventDefault();
        Player.showOSD();
        Player.focusControl(name === 'up' ? -1 : 1);
        return;
      }
      return;
    }
    if (!name) return;
    if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
      e.preventDefault(); FocusMgr.move(name); return;
    }
    if (name === 'enter') {
      var el = FocusMgr.getFocus();
      if (!el) { FocusMgr.focusFirst(); return; }
      var action = el.getAttribute('data-action');
      if (action && Kb.handleAction && Kb.handleAction(action, el)) { e.preventDefault(); return; }
      if (action && Views.onAction(action, el)) { e.preventDefault(); return; }
      try { el.click(); } catch (err) {}
      e.preventDefault(); return;
    }
    if (name === 'back') { e.preventDefault(); handleBack(); return; }
    if (name === 'playpause' || name === 'play' || name === 'pause') { /* ignore outside player */ return; }
  });

  // Ensure the built-in subtitle addon exists in the current profile
  try {
    var SUB_ADDON = 'https://opensubtitlesv3-pro.dexter21767.com/eyJsYW5ncyI6WyJhcmFiaWMiXSwic291cmNlIjoiYWxsIiwiYWlUcmFuc2xhdGVkIjp0cnVlLCJhdXRvQWRqdXN0bWVudCI6ZmFsc2V9/manifest.json';
    var prof0 = Store.profile();
    var hasSub = false;
    for (var ai = 0; ai < prof0.addons.length; ai++) if (prof0.addons[ai].url === SUB_ADDON) hasSub = true;
    if (!hasSub) {
      prof0.addons.push({ url: SUB_ADDON, enabled: true, manifest: null, addedAt: Date.now() });
      Store.save();
    }
  } catch (eSub) {}

  // Boot (deep-link support for testing: ?view=search|settings|library|plugins|detail&type=..&id=..)
  I18n.applyDir();
  scaleStage();
  var qs = location.search || '';
  var vm = qs.match(/[?&]view=([a-z]+)/);
  if (vm) {
    var v = vm[1];
    if (v === 'search') Views.renderSearch();
    else if (v === 'settings') Views.renderSettings();
    else if (v === 'library') Views.renderLibrary();
    else if (v === 'plugins') Views.renderPluginTest();
    else if (v === 'detail') {
      var tm = qs.match(/[?&]type=([a-z]+)/), im = qs.match(/[?&]id=([^&]+)/);
      Views.renderDetail(tm ? tm[1] : 'movie', im ? decodeURIComponent(im[1]) : 'tt0111161');
    } else Views.renderHome();
  } else Views.renderHome();
  logDebug('Nuvio Lite boot, engine=' + (window.webapis ? 'tizen' : 'browser'));
})();
