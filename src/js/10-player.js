/* Dual-engine player: AVPlay (Samsung) + HTML5 fallback.
   OSD with seek accumulation, audio/subtitle track menus, external subtitles,
   resume/history and clean teardown between titles. ES5. */
var Player = (function () {
  'use strict';
  var avplay = null;
  var engineUsed = null;
  var videoEl = null;
  var session = null;
  var osd = { visible: false, hideTimer: null, pos: 0, dur: 0, playing: false, buffering: false, pinned: false };
  var seekAccum = { dir: 0, count: 0, timer: null, pendingSec: 0 };
  var tracks = { audio: [], subtitle: [], audioSel: null, subSel: null, appliedAudio: false, appliedSub: false };
  var extSubs = [];          // {url, lang, addon}
  var extSubsLoading = false;
  var extSubsLoaded = false;
  var saveTimer = null;
  var audioAddHandler = null;
  var sessionToken = 0;
  var onExit = null;
  var trackMenuOpen = false;
  var menuReq = 0;
  var lastAvError = '';
  var audioDiag = '';
  var subCues = [];          // [{start,end,text}] rendered by the app over AVPlay/HTML5
  var subOverlay = null;
  var subLastText = '';
  var subCueIdx = 0;
  var trackListSig = '';

  function dbg(msg) { try { console.log('[NUVIO_AUDIO] ' + msg); } catch (e) {} }
  var LANG = { en: 'English', ar: 'العربية', fr: 'Français', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', tr: 'Türkçe', hi: 'हिन्दी', ja: '日本語', ko: '한국어', zh: '中文', ru: 'Русский', nl: 'Nederlands', pl: 'Polski', sv: 'Svenska', da: 'Dansk', no: 'Norsk', fi: 'Suomi', el: 'Ελληνικά', he: 'עברית', fa: 'فارسی', ur: 'اردو', id: 'Indonesia', ms: 'Melayu', th: 'ไทย', vi: 'Tiếng Việt', uk: 'Українська', cs: 'Čeština', ro: 'Română', hu: 'Magyar' };
  var LANG3 = { eng: 'en', ara: 'ar', fra: 'fr', fre: 'fr', spa: 'es', tur: 'tr', deu: 'de', ger: 'de', hin: 'hi', ita: 'it', jpn: 'ja', kor: 'ko', chi: 'zh', zho: 'zh', rus: 'ru', por: 'pt', nld: 'nl', dut: 'nl', pol: 'pl', swe: 'sv', dan: 'da', nor: 'no', fin: 'fi', ell: 'el', gre: 'el', heb: 'he', fas: 'fa', per: 'fa', urd: 'ur', ind: 'id', in: 'id', msa: 'ms', may: 'ms', tha: 'th', vie: 'vi', ukr: 'uk', ces: 'cs', cze: 'cs', ron: 'ro', rum: 'ro', hun: 'hu', iw: 'he', mo: 'ro' };
  function normLang(code) {
    var c = String(code || '').toLowerCase().split(/[-_]/)[0];
    return LANG3[c] || c;
  }
  function langName(code) {
    var c = normLang(code);
    return LANG[c] || (code ? String(code).toUpperCase() : 'Unknown');
  }
  function hasAvplay() {
    try { return !!(window.webapis && window.webapis.avplay); } catch (e) { return false; }
  }
  function createAvplay() {
    // On Tizen, webapis.avplay IS the player singleton. There is no AVPlay constructor;
    // "new webapis.avplay.AVPlay()" throws, which silently forced every stream to HTML5.
    try { return (window.webapis && window.webapis.avplay) ? window.webapis.avplay : null; } catch (e) { return null; }
  }
  function resetState() {
    osd.pos = 0; osd.dur = 0; osd.playing = false; osd.buffering = false; osd.pinned = false;
    tracks.audio = []; tracks.subtitle = []; tracks.audioSel = null; tracks.subSel = null; tracks.appliedAudio = false; tracks.appliedSub = false; tracks.lastLoad = 0;
    extSubs = []; extSubsLoading = false; extSubsLoaded = false;
    seekAccum.pendingSec = 0; seekAccum.count = 0;
    trackMenuOpen = false;
  }

  /* ---------------- public entry ---------------- */
  function play(opts, exitCb) {
    var wasActive = !!engineUsed;
    if (wasActive) stop(true);
    sessionToken++;
    var token = sessionToken;
    session = opts || {};
    onExit = exitCb || null;
    lastAvError = '';
    var keepCues = (opts && opts.isRestart && opts.subCues) ? opts.subCues : [];
    resetState();
    subCues = keepCues;
    subLastText = '';
    subCueIdx = 0;
    try {
      document.body.className += ' player-active';
      document.documentElement.className += ' player-active';
    } catch (e) {}
    buildOSD();
    loadExternalSubtitles();
    // AVPlay close is async on some 2017 firmwares: give it a moment before re-open
    setTimeout(function () {
      if (token !== sessionToken) return;
      var pref = session.forceEngine || Store.settings().playerEngine;
      dbg('play pref=' + pref + ' hasAvplay=' + hasAvplay() + ' url=' + String(session.url || '').split('?')[0]);
      var tryAv = pref === 'avplay' || pref === 'auto';
      if (tryAv && hasAvplay()) {
        playAvplay(token, session, function () {
          if (token !== sessionToken) return;
          if (Views.toast) Views.toast('AVPlay failed: ' + (lastAvError || 'unknown') + ' — HTML5 fallback');
          playHtml5(token, session);
        });
      } else {
        playHtml5(token, session);
      }
    }, wasActive ? 400 : 0);
  }

  /* ---------------- AVPlay ---------------- */
  function applyHeaders(headers) {
    var keys = headers ? Object.keys(headers) : [];
    if (!keys.length) return '';
    if (!avplay || typeof avplay.setStreamingProperty !== 'function') return 'may not play on this TV';
    var ok = true;
    for (var i = 0; i < keys.length; i++) {
      try { avplay.setStreamingProperty('HTTP_HEADER', keys[i] + ': ' + headers[keys[i]]); }
      catch (e) { ok = false; }
    }
    return ok ? '' : 'may not play on this TV';
  }
  function playAvplay(token, opts, fallback) {
    engineUsed = 'avplay';
    avplay = createAvplay();
    if (!avplay) { fallback(); return; }
    var div = document.createElement('div');
    div.id = 'avplay-div';
    div.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px;background:transparent;z-index:1';
    document.body.appendChild(div);
    var done = false;
    function fail() {
      if (done || token !== sessionToken) return;
      done = true;
      dbg('avplay fail lastError=' + lastAvError);
      teardownAvplay(); removeDiv(div);
      fallback();
    }
    try {
      try { if (avplay.setDisplayMethod) avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN'); } catch (eDisp) {}
      dbg('avplay open');
      avplay.open(opts.url);
      // streaming properties (HTTP headers) are only valid after open() and before prepare()
      if (session) session.headersNote = applyHeaders(opts.headers);
      // external subtitle path must be set before prepare on Samsung TVs
      if (opts.subtitleUrl && avplay.setExternalSubtitlePath) {
        // AVPlay needs a local filesystem path, not a file:// URI or a remote URL.
        var subPath = String(opts.subtitleUrl).replace(/^file:\/\//i, '');
        try { avplay.setExternalSubtitlePath(subPath); } catch (subErr) {
          dbg('setExternalSubtitlePath err ' + (subErr && subErr.message));
        }
      }
      avplay.setDisplayRect(0, 0, 1920, 1080);
      avplay.setListener({
        onbufferingstart: function () { if (token !== sessionToken) return; osd.buffering = true; updateOSD(); },
        onbufferingprogress: function () {},
        onbufferingcomplete: function () {
          if (token !== sessionToken) return;
          osd.buffering = false; osd.playing = true; updateOSD();
          if (session && (session.forceAudioIndex != null || session.audioVerifyLang) && !session.audioConfirmed) {
            tracks.appliedAudio = false;
            loadTracks();
          }
        },
        oncurrentplaytime: function (ms) {
          if (token !== sessionToken) return;
          osd.pos = ms / 1000;
          if (!trackMenuOpen && (!tracks.appliedAudio || !tracks.appliedSub)) {
            var nowTs = Date.now();
            if (!tracks.lastLoad || nowTs - tracks.lastLoad > 3000) {
              tracks.lastLoad = nowTs;
              loadTracks();
              applyPreferredTracks();
            }
          }
          updateOSD();
        },
        onduration: function (ms) { if (token !== sessionToken) return; osd.dur = ms / 1000; updateOSD(); },
        onstreamcompleted: function () { if (token !== sessionToken) return; handleEnded(); },
        onerror: function (err) {
          lastAvError = 'play error ' + (err && (err.message || err.code || err.name) || 'unknown');
          dbg('avplay onerror ' + lastAvError);
          fail();
        },
        onsubtitlestreamchanged: function (idx) { tracks.subSel = idx; },
        onsubtitlechange: function () {}
      });
      avplay.prepareAsync(function () {
        if (done || token !== sessionToken) { teardownAvplay(); removeDiv(div); return; }
        dbg('avplay prepared');
        var saved = (opts.startPos != null ? opts.startPos : savedPos());
        // Audio track selection is only valid while PLAYING, so play() must come first.
        try { avplay.play(); } catch (e) {}
        osd.playing = true;
        if (opts.subtitleUrl) {
          tracks.appliedSub = true;
          tracks.subSel = 'ext';
          try { if (avplay.setSilentSubtitle) avplay.setSilentSubtitle(false); } catch (eSil) {}
        }
        // Seek FIRST: seeking can reset the active audio track, so audio is applied afterwards.
        if (saved > 10) { try { avplay.seekTo(saved * 1000); } catch (e) {} }
        tracks.appliedAudio = false;
        loadTracks();
        done = true;
        startSaveTimer();
        showOSD();
        if (Views.toast) Views.toast('Engine: AVPlay');
        // Re-apply the wanted audio while the stream settles (resume seek / buffering can reset it).
        var reapplyTimes = [700, 1500, 2600];
        for (var ri = 0; ri < reapplyTimes.length; ri++) {
          setTimeout((function (idx) {
            return function () {
              if (token !== sessionToken || engineUsed !== 'avplay') return;
              if (session && session.audioConfirmed) return;
              if (session && (session.forceAudioIndex != null || session.audioVerifyLang)) {
                reapplyChosenAudio(idx);
              } else {
                tracks.appliedAudio = false;
                loadTracks();
                if (idx === 0) verifyPreferredAudio();
              }
            };
          })(ri), reapplyTimes[ri]);
        }
        setTimeout(function () {
          if (token === sessionToken && engineUsed === 'avplay') verifyForcedAudio();
        }, 4200);
      }, function (err) {
        lastAvError = 'prepare error ' + (err && (err.message || err.code || err.name) || 'unknown');
        dbg('avplay prepare failed ' + lastAvError);
        fail();
      });
    } catch (e) {
      lastAvError = 'open error ' + (e && (e.message || e.name) || 'unknown');
      dbg('avplay open exception ' + lastAvError);
      fail();
    }
  }
  // AVPlay returns extra_info as a JSON string (sometimes already parsed).
  function trackExtra(t) {
    var ex = t.extra_info || t.extraInfo || null;
    if (typeof ex === 'string') {
      try { ex = JSON.parse(ex); } catch (e) { ex = null; }
    }
    return (ex && typeof ex === 'object') ? ex : {};
  }
  function normalizeTracks(info) {
    var audio = [], subs = [];
    for (var i = 0; i < info.length; i++) {
      var t = info[i] || {};
      var ex = trackExtra(t);
      var type = String(t.type || ex.type || '').toUpperCase();
      var idx = (t.index != null) ? t.index : i;
      // AVPlay's setSelectTrack() expects the AVPlayStreamInfo index, not a stream_id.
      var id = idx;
      var rec = {
        id: id, index: idx,
        language: t.language || t.lang || t.language_code || ex.language || ex.lang || ex.track_lang || ex.language_code || '',
        codec: t.codec_type || t.codec || t.fourCC || t.codecType || ex.codec || ex.codec_type || ex.fourCC || ex.fourcc || '',
        channels: t.channel || t.channels || t.channel_count || ex.channels || ex.channel || ex.channel_count || '',
        sampleRate: ex.sample_rate || ex.sampleRate || '',
        bitrate: ex.bit_rate || ex.bitrate || ''
      };
      if (type === 'AUDIO') audio.push(rec);
      else if (type === 'TEXT' || type === 'SUBTITLE') subs.push(rec);
    }
    return { audio: audio, subtitle: subs };
  }
  function setTrackApplied(kind, track) {
    if (!avplay || !avplay.setSelectTrack) return false;
    var ok = false;
    try { avplay.setSelectTrack(kind, track.id); ok = true; } catch (e) { dbg('setSelectTrack(' + kind + ',' + track.id + ') err ' + (e && e.message)); }
    if (!ok) {
      try { avplay.setSelectTrack(kind, track.index); ok = true; } catch (e2) { dbg('setSelectTrack(' + kind + ',' + track.index + ') err ' + (e2 && e2.message)); }
    }
    audioDiag = 'set ' + kind + ' id=' + track.id + ' ' + (ok ? 'ok' : 'FAILED');
    dbg('setSelectTrack(' + kind + ') id=' + track.id + ' index=' + track.index + ' ok=' + ok);
    return ok;
  }
  // HTML5 track APIs are optional; Tizen exposes them on some firmware/models.
  function html5AudioList() {
    var list = [];
    if (!videoEl || !videoEl.audioTracks) return list;
    try {
      var at = videoEl.audioTracks;
      for (var i = 0; i < at.length; i++) {
        var a = at[i] || {};
        list.push({
          id: i, index: i,
          language: a.language || a.lang || '',
          label: a.label || a.language || '',
          codec: '', channels: '', enabled: !!a.enabled
        });
      }
    } catch (e) {}
    return list;
  }
  function setHtml5Audio(track) {
    if (!videoEl || !videoEl.audioTracks) return false;
    try {
      var at = videoEl.audioTracks;
      for (var i = 0; i < at.length; i++) at[i].enabled = (String(i) === String(track.id));
      return at.length > 0;
    } catch (e) { return false; }
  }
  function loadHtml5Tracks() {
    var list = html5AudioList();
    dbg('html5 audioTracks=' + list.length + ' ' + JSON.stringify(list).slice(0, 600));
    if (list.length) {
      tracks.audio = list;
      for (var i = 0; i < list.length; i++) if (list[i].enabled) tracks.audioSel = list[i].id;
      applyPreferredTracks();
      updateTrackButton();
      if (trackMenuOpen) renderTrackMenu();
    }
  }
  function tracksSignature() {
    var parts = [], i;
    for (i = 0; i < tracks.audio.length; i++) parts.push('a' + tracks.audio[i].index + ':' + tracks.audio[i].language);
    for (i = 0; i < tracks.subtitle.length; i++) parts.push('t' + tracks.subtitle[i].index + ':' + tracks.subtitle[i].language);
    return parts.join('|');
  }
  function loadTracks() {
    if (engineUsed === 'html5') { loadHtml5Tracks(); return; }
    if (!avplay || !avplay.getTotalTrackInfo) return;
    try {
      var info = avplay.getTotalTrackInfo() || [];
      dbg('totalTrackInfo ' + JSON.stringify(info).slice(0, 1600));
      var norm = normalizeTracks(info);
      if (norm.audio.length) tracks.audio = norm.audio;
      if (norm.subtitle.length) tracks.subtitle = norm.subtitle;
      dbg('audioTracks ' + JSON.stringify(norm.audio).slice(0, 900));
      // No embedded subtitles: there is nothing to auto-select, stop the retry loop.
      if (!norm.subtitle.length) tracks.appliedSub = true;
      var nsig = tracksSignature();
      var changed = nsig !== trackListSig;
      trackListSig = nsig;
      applyPreferredTracks();
      updateTrackButton();
      // Never rebuild the open menu unless the track list actually changed;
      // rebuilding reset focus to the first row and made navigation snap upwards.
      if (trackMenuOpen && changed) renderTrackMenu();
    } catch (e) { dbg('loadTracks err ' + (e && e.message)); }
  }
  function applyPreferredTracks() {
    var s = Store.settings();
    if (!tracks.appliedAudio && tracks.audio.length) {
      // A reopen keeps the exact track the user picked. Language is more stable than an index
      // because a reopened stream can enumerate its tracks differently.
      if (session && (session.forceAudioIndex != null || session.audioVerifyLang)) {
        var wantF = session.audioVerifyLang || normLang(s.audioLang || '');
        var forced = null, fi;
        if (wantF && wantF !== 'original') {
          for (fi = 0; fi < tracks.audio.length; fi++) {
            var fl = normLang(tracks.audio[fi].language);
            if (fl && (fl.indexOf(wantF) === 0 || wantF.indexOf(fl) === 0)) { forced = tracks.audio[fi]; break; }
          }
        }
        if (!forced && session.forceAudioIndex != null) {
          for (fi = 0; fi < tracks.audio.length; fi++) {
            if (String(tracks.audio[fi].index) === String(session.forceAudioIndex)) { forced = tracks.audio[fi]; break; }
          }
        }
        dbg('applyPreferred want=' + wantF + ' forceIdx=' + session.forceAudioIndex + ' forced=' + (forced ? (forced.language + '#' + forced.index) : 'none'));
        if (forced) {
          var fok = engineUsed === 'html5' ? setHtml5Audio(forced) : setTrackApplied('AUDIO', forced);
          if (fok) {
            tracks.audioSel = forced.id;
            tracks.appliedAudio = true;
          }
        }
      }
      var wantA = String(s.audioLang || 'en').toLowerCase();
      if (tracks.appliedAudio) {
        // forced track already applied
      } else if (wantA === 'original') {
        tracks.appliedAudio = true;
      } else {
        var hadMatch = false;
        for (var i = 0; i < tracks.audio.length; i++) {
          var l = normLang(tracks.audio[i].language);
          if (l && (l.indexOf(wantA) === 0 || wantA.indexOf(l) === 0)) {
            hadMatch = true;
            var applied = engineUsed === 'html5' ? setHtml5Audio(tracks.audio[i]) : setTrackApplied('AUDIO', tracks.audio[i]);
            if (applied) {
              tracks.audioSel = tracks.audio[i].id;
              tracks.appliedAudio = true;
              break;
            }
          }
        }
        // No matching language: stop retrying. A failed match is retried while playback starts.
        if (!tracks.appliedAudio && !hadMatch) tracks.appliedAudio = true;
      }
    }
    var wantS = String(s.subLang || 'off').toLowerCase();
    if (wantS === 'off') tracks.appliedSub = true;
    if (!tracks.appliedSub && tracks.subtitle.length && wantS !== 'off') {
      for (var j = 0; j < tracks.subtitle.length; j++) {
        var sl = normLang(tracks.subtitle[j].language);
        if (sl && (sl.indexOf(wantS) === 0 || wantS.indexOf(sl) === 0)) {
          if (setTrackApplied('TEXT', tracks.subtitle[j])) {
            tracks.subSel = tracks.subtitle[j].id;
            tracks.appliedSub = true;
            try { if (avplay.setSilentSubtitle) avplay.setSilentSubtitle(false); } catch (e) {}
            break;
          }
        }
      }
    }
  }
  function teardownAvplay() {
    if (!avplay) return;
    try { if (avplay.stop) avplay.stop(); } catch (e) {}
    try { if (avplay.close) avplay.close(); } catch (e) {}
    avplay = null;
  }
  function removeDiv(d) { if (d && d.parentNode) d.parentNode.removeChild(d); }

  /* ---------------- HTML5 ---------------- */
  function playHtml5(token, opts) {
    teardownAvplay();
    engineUsed = 'html5';
    dbg('html5 start url=' + String(opts.url || '').split('?')[0]);
    videoEl = document.getElementById('html5video');
    videoEl.onloadedmetadata = null; videoEl.ontimeupdate = null; videoEl.onwaiting = null;
    videoEl.onplaying = null; videoEl.onended = null; videoEl.onerror = null;
    videoEl.onloadeddata = null; videoEl.oncanplay = null;
    videoEl.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px;background:#000;z-index:1';
    videoEl.style.display = 'block';
    try { videoEl.pause(); } catch (e) {}
    try { videoEl.removeAttribute('src'); videoEl.load(); } catch (e) {}
    if (opts.headers && Object.keys(opts.headers).length && session) session.headersNote = 'may not play on this TV';
    videoEl.src = opts.url;
    if (opts.subtitleUrl) {
      try {
        var st = document.createElement('track');
        st.kind = 'subtitles'; st.label = langName(Store.settings().subLang); st.srclang = Store.settings().subLang || 'en';
        st.src = opts.subtitleUrl; st.id = 'ext-' + Date.now(); videoEl.appendChild(st);
        setTimeout(function () { try { for (var ti = 0; ti < videoEl.textTracks.length; ti++) videoEl.textTracks[ti].mode = 'showing'; } catch (e) {} }, 500);
      } catch (e) {}
    }
    videoEl.onloadedmetadata = function () {
      if (token !== sessionToken) return;
      osd.dur = videoEl.duration || 0;
      var saved = (opts.startPos != null ? opts.startPos : savedPos());
      if (saved > 10) { try { videoEl.currentTime = saved; } catch (e) {} }
      var p = videoEl.play();
      if (p && p['catch']) p['catch'](function () {});
      osd.playing = true; updateOSD();
      // Track lists can appear after metadata or only once decoding starts.
      loadHtml5Tracks();
      setTimeout(function () { if (token === sessionToken) loadHtml5Tracks(); }, 800);
      setTimeout(function () { if (token === sessionToken) loadHtml5Tracks(); }, 2500);
    };
    videoEl.onloadeddata = function () { if (token === sessionToken) loadHtml5Tracks(); };
    videoEl.oncanplay = function () { if (token === sessionToken) loadHtml5Tracks(); };
    function onAudioAdd() { if (token === sessionToken) loadHtml5Tracks(); }
    try {
      if (videoEl.audioTracks && videoEl.audioTracks.addEventListener) {
        audioAddHandler = onAudioAdd;
        videoEl.audioTracks.addEventListener('addtrack', onAudioAdd);
      }
    } catch (e) {}
    videoEl.ontimeupdate = function () { if (token !== sessionToken) return; osd.pos = videoEl.currentTime; updateOSD(); };
    videoEl.onwaiting = function () { if (token !== sessionToken) return; osd.buffering = true; updateOSD(); };
    videoEl.onplaying = function () { if (token !== sessionToken) return; osd.buffering = false; osd.playing = true; updateOSD(); };
    videoEl.onended = function () { if (token === sessionToken) handleEnded(); };
    videoEl.onerror = function () { if (token === sessionToken) showError('Playback error (' + (videoEl.error && videoEl.error.code) + ')'); };
    startSaveTimer();
    showOSD();
    updateTrackButton();
    if (!lastAvError && Views.toast) Views.toast('Engine: HTML5');
  }

  /* ---------------- history ---------------- */
  function savedPos() {
    if (!session) return 0;
    var h = Store.profile().history[session.type + ':' + session.videoId];
    return h ? (h.pos || 0) : 0;
  }
  function savePos() {
    if (!session) return;
    var key = session.type + ':' + session.videoId;
    var prof = Store.profile();
    prof.history[key] = {
      pos: Math.floor(osd.pos), dur: Math.floor(osd.dur || 0), ts: Date.now(),
      title: session.title || session.id, poster: session.poster || '',
      type: session.type, id: session.id, videoId: session.videoId
    };
    if (osd.dur > 0 && osd.pos / osd.dur > 0.95) prof.watched[session.type + ':' + session.id] = true;
    if (window.Trakt && Trakt.scrobble) Trakt.scrobble(session, osd.pos, osd.dur);
    Store.save();
  }
  function startSaveTimer() { stopSaveTimer(); saveTimer = setInterval(savePos, 10000); }
  function stopSaveTimer() { if (saveTimer) { clearInterval(saveTimer); saveTimer = null; } }
  function handleEnded() {
    savePos();
    osd.playing = false; updateOSD();
    var m = Views.getDetail && Views.getDetail().meta;
    var ss = Views.getStream && Views.getStream();
    if (m && m.type === 'series' && m.videos && ss) {
      var vids = m.videos.slice().sort(function (a, b) {
        if (a.season !== b.season) return a.season - b.season;
        return (a.episode || 0) - (b.episode || 0);
      });
      var cur = -1, i;
      for (i = 0; i < vids.length; i++) if (vids[i].id === ss.videoId) cur = i;
      if (cur >= 0 && cur < vids.length - 1) {
        Views.showDialog(I18n.t('nextEpisode'), vids[cur + 1].title || '', [ { label: I18n.t('play') }, { label: I18n.t('close') } ], function (idx) {
          if (idx === 0) { stop(true); Views.renderStreams(m.type, m.id, vids[cur + 1].id, m); }
        });
        return;
      }
    }
    Views.showDialog(I18n.t('close'), '', [ { label: I18n.t('close') } ], function () {});
  }

  /* ---------------- OSD ---------------- */
  function buildOSD() {
    removeOSD();
    var root = Util.el('div', 'player-osd');
    root.id = 'player-osd';
    var bar = Util.el('div', 'osd-bar');
    var fill = Util.el('div', 'osd-fill'); fill.id = 'osd-fill';
    bar.appendChild(fill);
    root.appendChild(bar);
    var mid = Util.el('div', 'osd-mid');
    var t = Util.el('span', 'osd-time', '0:00 / 0:00'); t.id = 'osd-time';
    mid.appendChild(t);
    var pp = Util.el('button', 'btn osd-btn focusable', '⏸');
    pp.id = 'osd-pp'; pp.setAttribute('data-focus-id', 'osd-pp'); pp.setAttribute('data-action', 'osd-pp'); pp.setAttribute('type', 'button');
    mid.appendChild(pp);
    var s10 = Util.el('button', 'btn osd-btn focusable', '−10s');
    s10.setAttribute('data-focus-id', 'osd-s10'); s10.setAttribute('data-action', 'osd-s10'); s10.setAttribute('type', 'button');
    var s30 = Util.el('button', 'btn osd-btn focusable', '−30s');
    s30.setAttribute('data-focus-id', 'osd-s30'); s30.setAttribute('data-action', 'osd-s30'); s30.setAttribute('type', 'button');
    var tr = Util.el('button', 'btn osd-btn focusable', 'Audio / CC');
    tr.id = 'osd-tracks-btn'; tr.setAttribute('data-focus-id', 'osd-tracks'); tr.setAttribute('data-action', 'osd-tracks'); tr.setAttribute('type', 'button');
    mid.appendChild(s10); mid.appendChild(s30); mid.appendChild(tr);
    root.appendChild(mid);
    var buf = Util.el('div', 'osd-buffering hidden', '…'); buf.id = 'osd-buffering';
    root.appendChild(buf);
    var title = Util.el('div', 'osd-title', (session && session.title) || ''); title.id = 'osd-title';
    root.appendChild(title);
    var hint = Util.el('div', 'osd-hint', '←/→ seek · ↑/↓ controls · Enter select · Back exit');
    hint.id = 'osd-hint';
    root.appendChild(hint);
    var menu = Util.el('div', 'osd-trackmenu hidden'); menu.id = 'osd-trackmenu';
    root.appendChild(menu);
    document.body.appendChild(root);
    FocusMgr.setScope(root);
    FocusMgr.focusById('osd-pp') || FocusMgr.focusFirst();
  }
  function updateOSD() {
    var fill = document.getElementById('osd-fill');
    var time = document.getElementById('osd-time');
    if (!fill || !time) return;
    var pct = osd.dur > 0 ? Math.min(100, (osd.pos / osd.dur) * 100) : 0;
    fill.style.width = pct + '%';
    time.textContent = Util.fmtTime(osd.pos) + ' / ' + Util.fmtTime(osd.dur) +
      (seekAccum.pendingSec ? '  (' + (seekAccum.pendingSec > 0 ? '+' : '') + seekAccum.pendingSec + 's)' : '');
    var buf = document.getElementById('osd-buffering');
    if (buf) buf.className = 'osd-buffering' + (osd.buffering ? '' : ' hidden');
    var pp = document.getElementById('osd-pp');
    if (pp) pp.textContent = osd.playing ? '⏸' : '▶';
    var hint = document.getElementById('osd-hint');
    if (hint) hint.textContent = (engineUsed ? ('Engine: ' + engineUsed.toUpperCase() + '  ·  ') : '') + '←/→ seek · ↑/↓ controls · Enter select · Back exit';
    updateSubtitleOverlay(osd.pos);
  }
  function updateTrackButton() {
    var b = document.getElementById('osd-tracks-btn');
    if (!b) return;
    var a = tracks.audio.length, s = tracks.subtitle.length + extSubs.length;
    b.textContent = 'Audio ' + (a || '–') + ' / CC ' + (s || '–');
  }
  function showOSD() {
    osd.visible = true;
    var r = document.getElementById('player-osd');
    if (r) { r.classList.remove('hidden'); if (FocusMgr.setScope) FocusMgr.setScope(r); }
    updateOSD();
    if (osd.hideTimer) clearTimeout(osd.hideTimer);
    if (!trackMenuOpen && !osd.pinned) osd.hideTimer = setTimeout(hideOSD, 4000);
  }
  function hideOSD() {
    if (trackMenuOpen) return;
    osd.visible = false;
    var r = document.getElementById('player-osd');
    if (r) r.classList.add('hidden');
  }
  function removeOSD() {
    var r = document.getElementById('player-osd');
    if (r && r.parentNode) r.parentNode.removeChild(r);
    if (FocusMgr.clearScope) FocusMgr.clearScope();
  }

  /* ---------------- tracks / subtitles ---------------- */
  function loadExternalSubtitles() {
    if (extSubsLoaded || extSubsLoading) return;
    var ss = Views.getStream && Views.getStream();
    if (!ss || !ss.type) return;
    var addons = Api.enabledAddons();
    if (!addons.length) { extSubsLoaded = true; return; }
    extSubsLoading = true;
    var pending = addons.length;
    addons.forEach(function (addon) {
      Api.getSubtitles(addon, ss.type, ss.videoId || ss.id, function (err, subs) {
        pending--;
        if (!err && subs) {
          for (var i = 0; i < subs.length; i++) {
            var s = subs[i], url = s.url || s.id || '';
            if (!url || !Util.isHttp(url)) continue;
            var dup = false;
            for (var j = 0; j < extSubs.length; j++) if (extSubs[j].url === url) dup = true;
            if (!dup) extSubs.push({ url: url, lang: s.lang || s.language || '', addon: (addon.manifest && addon.manifest.name) || '' });
          }
        }
        if (pending === 0) {
          extSubsLoading = false; extSubsLoaded = true;
          updateTrackButton();
          if (trackMenuOpen) renderTrackMenu();
        }
      });
    });
  }
  function trackRow(label, sub, selected, attrs) {
    var b = Util.el('button', 'osd-track-row focusable' + (selected ? ' selected' : ''), '');
    b.appendChild(Util.el('span', 'osd-track-label', label));
    if (sub) b.appendChild(Util.el('span', 'osd-track-sub', sub));
    if (selected) b.appendChild(Util.el('span', 'osd-track-check', '✓'));
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) b.setAttribute(k, attrs[k]);
    b.setAttribute('type', 'button');
    return b;
  }
  function renderTrackMenu() {
    var menu = document.getElementById('osd-trackmenu');
    if (!menu) return;
    var prev = FocusMgr.getFocus ? FocusMgr.getFocus() : null;
    var prevId = prev && prev.getAttribute ? prev.getAttribute('data-focus-id') : '';
    var req = ++menuReq;
    menu.innerHTML = '';
    menu.classList.remove('hidden');
    trackMenuOpen = true;
    osd.pinned = true;
    if (osd.hideTimer) clearTimeout(osd.hideTimer);

    if (engineUsed === 'avplay') {
      menu.appendChild(trackRow('↻ Refresh tracks', 're-read from the TV', false, {
        'data-focus-id': 'osd-refresh-tracks', 'data-action': 'osd-refresh-tracks'
      }));
    }
    // Audio
    menu.appendChild(Util.el('div', 'osd-track-head', 'Audio'));
    var curAudioLabel = '';
    for (var ca = 0; ca < tracks.audio.length; ca++) {
      if (tracks.audioSel != null && String(tracks.audio[ca].id) === String(tracks.audioSel)) {
        curAudioLabel = (tracks.audio[ca].language ? langName(tracks.audio[ca].language) : ('track ' + (tracks.audio[ca].index + 1))) +
          ' (idx ' + tracks.audio[ca].index + ')';
      }
    }
    menu.appendChild(Util.el('div', 'osd-track-empty',
      (engineUsed === 'avplay' ? 'Engine: AVPlay' : 'Engine: HTML5') + (curAudioLabel ? (' · current: ' + curAudioLabel) : '')));
    if (audioDiag) menu.appendChild(Util.el('div', 'osd-track-empty', 'Last audio action: ' + audioDiag));
    if (!tracks.audio.length) {
      if (engineUsed === 'avplay') {
        menu.appendChild(Util.el('div', 'osd-track-empty', 'No embedded audio tracks reported — press Refresh tracks'));
        menu.appendChild(trackRow('↻ Refresh tracks', 're-read from the TV', false, {
          'data-focus-id': 'osd-refresh-tracks', 'data-action': 'osd-refresh-tracks'
        }));
      } else {
        menu.appendChild(Util.el('div', 'osd-track-empty', 'The HTML5 engine is playing this stream, but it cannot list or switch its audio tracks.'));
        if (hasAvplay()) {
          menu.appendChild(trackRow('▶ Restart with AVPlay', 'AVPlay can switch audio languages', false, {
            'data-focus-id': 'osd-engine-avplay', 'data-action': 'osd-engine-avplay'
          }));
        } else {
          menu.appendChild(Util.el('div', 'osd-track-empty', 'AVPlay is not available on this TV.'));
        }
      }
    } else {
      tracks.audio.forEach(function (a, i) {
        var label = a.language ? langName(a.language) : (a.label || ('Audio track ' + (i + 1)));
        var info = ['idx ' + (a.index != null ? a.index : i), a.codec || a.codec_type || '', a.channels ? (a.channels + ' ch') : '',
          a.sampleRate ? (a.sampleRate + ' Hz') : ''].filter(Boolean).join(' · ');
        menu.appendChild(trackRow(label, info, String(tracks.audioSel) === String(a.id), {
          'data-focus-id': 'osd-audio-' + i, 'data-action': 'osd-track',
          'data-kind': 'AUDIO', 'data-stream-id': String(a.id), 'data-lang': a.language || ''
        }));
      });
    }

    // Subtitles
    menu.appendChild(Util.el('div', 'osd-track-head', 'Subtitles'));
    menu.appendChild(trackRow('Off', '', tracks.subSel == null || tracks.subSel < 0, {
      'data-focus-id': 'osd-sub-off', 'data-action': 'osd-track', 'data-kind': 'TEXT', 'data-stream-id': '-1'
    }));
    tracks.subtitle.forEach(function (s, i) {
      menu.appendChild(trackRow(s.language ? langName(s.language) : ('Subtitle ' + (i + 1)), 'embedded', tracks.subSel === s.id, {
        'data-focus-id': 'osd-sub-' + i, 'data-action': 'osd-track',
        'data-kind': 'TEXT', 'data-stream-id': String(s.id), 'data-lang': s.language || ''
      }));
    });
    if (extSubsLoading) menu.appendChild(Util.el('div', 'osd-track-empty', 'Loading external subtitles…'));
    extSubs.forEach(function (s, i) {
      var isSel = !!(session && session.subtitleRemote && session.subtitleRemote === s.url);
      menu.appendChild(trackRow(langName(s.lang), s.addon || 'external', isSel, {
        'data-focus-id': 'osd-ext-' + i, 'data-action': 'osd-extsub',
        'data-url': s.url, 'data-lang': s.lang || ''
      }));
    });
    if (req !== menuReq) return;

    var close = Util.el('button', 'btn osd-btn focusable', I18n.t('close'));
    close.setAttribute('data-focus-id', 'osd-track-close');
    close.setAttribute('data-action', 'osd-track-close');
    close.setAttribute('type', 'button');
    close.className += ' osd-track-close';
    menu.appendChild(close);
    trackListSig = tracksSignature();
    var again = prevId ? menu.querySelector('[data-focus-id="' + prevId + '"]') : null;
    if (!again) again = menu.querySelector('.focusable');
    if (again) FocusMgr.setFocus(again); else FocusMgr.focusFirst();
  }
  function showTrackMenu() {
    showOSD();
    loadExternalSubtitles();
    renderTrackMenu();
  }
  function closeTrackMenu() {
    trackMenuOpen = false;
    osd.pinned = false;
    var m = document.getElementById('osd-trackmenu');
    if (m) { m.innerHTML = ''; m.classList.add('hidden'); }
    FocusMgr.focusById('osd-tracks') || FocusMgr.focusFirst();
    showOSD();
  }
  function findTrack(list, id) {
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function currentAudioInfo() {
    if (!avplay || !avplay.getCurrentStreamInfo) return null;
    try {
      var info = avplay.getCurrentStreamInfo() || [];
      for (var i = 0; i < info.length; i++) {
        var t = info[i] || {};
        if (String(t.type || '').toUpperCase() === 'AUDIO') {
          var ex = trackExtra(t);
          return {
            index: (t.index != null) ? t.index : null,
            language: t.language || t.lang || t.language_code || ex.language || ex.lang || ex.track_lang || ''
          };
        }
      }
    } catch (e) {}
    return null;
  }
  function currentAudioIndex() {
    var cur = currentAudioInfo();
    return cur ? cur.index : null;
  }
  function audioApplied(tr) {
    var cur = currentAudioIndex();
    if (cur == null) return true;   // cannot verify on this firmware: assume the API call worked
    return String(cur) === String(tr.index) || String(cur) === String(tr.id);
  }
  // Select audio while PLAYING (AVPlay rejects AUDIO changes in READY/PAUSED on many TVs),
  // then verify using getCurrentStreamInfo and retry / reopen if the switch did not stick.
  function applyAvAudio(tr, tries) {
    if (!session || !avplay) return;
    var token = sessionToken;
    if (!osd.playing) {
      try { avplay.play(); osd.playing = true; osd.buffering = false; updateOSD(); } catch (e) {}
    }
    var ok = setTrackApplied('AUDIO', tr);
    if (!ok && tries > 0) {
      setTimeout(function () { if (token === sessionToken) applyAvAudio(tr, tries - 1); }, 600);
      return;
    }
    setTimeout(function () {
      if (token !== sessionToken || !avplay) return;
      var cur = currentAudioIndex();
      if (cur == null) {
        // Firmware cannot report the active track: reopen once with the chosen index.
        if (session && String(session.forceAudioIndex) === String(tr.index)) {
          tracks.audioSel = tr.id;
          tracks.appliedAudio = true;
          updateTrackButton();
        } else {
          restartWithAudio(tr);
        }
        return;
      }
      if (String(cur) === String(tr.index) || String(cur) === String(tr.id)) {
        tracks.audioSel = tr.id;
        tracks.appliedAudio = true;
        updateTrackButton();
        if (Views.toast) Views.toast('Audio: ' + (tr.language ? langName(tr.language) : ('track ' + (tr.index + 1))));
      } else if (tries > 0) {
        applyAvAudio(tr, tries - 1);
      } else {
        restartWithAudio(tr);
      }
    }, 900);
  }
  function refreshTrackList() {
    if (!avplay || !avplay.getTotalTrackInfo) return;
    try {
      var norm = normalizeTracks(avplay.getTotalTrackInfo() || []);
      if (norm.audio.length) tracks.audio = norm.audio;
      if (norm.subtitle.length) tracks.subtitle = norm.subtitle;
    } catch (e) {}
  }
  function findChosenAudio() {
    if (!session) return null;
    var want = session.audioVerifyLang || normLang(Store.settings().audioLang || '');
    var i;
    if (want && want !== 'original') {
      for (i = 0; i < tracks.audio.length; i++) {
        var l = normLang(tracks.audio[i].language);
        if (l && (l.indexOf(want) === 0 || want.indexOf(l) === 0)) return tracks.audio[i];
      }
    }
    if (session.forceAudioIndex != null) {
      for (i = 0; i < tracks.audio.length; i++) {
        if (String(tracks.audio[i].index) === String(session.forceAudioIndex)) return tracks.audio[i];
      }
    }
    return null;
  }
  function setAvAudioId(id) {
    try { avplay.setSelectTrack('AUDIO', id); return true; } catch (e) { return false; }
  }
  // Five escalating strategies: some Tizen firmwares expect a 0-based audio index,
  // some only react after pause/resume, and some need a seek to rebuild the pipeline.
  function audioMatches(tr, cur) {
    if (!cur) return false;
    var l = normLang(cur.language);
    if (session && session.audioVerifyLang && l) {
      return l.indexOf(session.audioVerifyLang) === 0 || session.audioVerifyLang.indexOf(l) === 0;
    }
    return String(cur.index) === String(tr.index);
  }
  function confirmIfApplied(tr, token, delay) {
    setTimeout(function () {
      if (token !== sessionToken || !session) return;
      var cur = currentAudioInfo();
      if (!cur || !audioMatches(tr, cur)) return;
      session.audioConfirmed = true;
      tracks.audioSel = tr.id;
      tracks.appliedAudio = true;
      updateTrackButton();
    }, delay);
  }
  function reapplyChosenAudio(stage) {
    if (!session || !avplay) return;
    refreshTrackList();
    var tr = findChosenAudio();
    if (!tr) return;
    var token = sessionToken;
    function done() {
      if (token !== sessionToken) return;
      tracks.audioSel = tr.id;
      tracks.appliedAudio = true;
      updateTrackButton();
      confirmIfApplied(tr, token, 800);
    }
    audioDiag = 'try stage ' + stage + ' → ' + (tr.language || '?') + ' idx ' + tr.index;
    dbg('reapply stage=' + stage + ' track=' + tr.language + '#' + tr.index);
    if (stage === 2) {
      var rel = 0, i;
      for (i = 0; i < tracks.audio.length; i++) if (tracks.audio[i].id === tr.id) { rel = i; break; }
      if (setAvAudioId(rel)) done();
    } else if (stage === 3) {
      try { avplay.pause(); osd.playing = false; } catch (e) {}
      setTimeout(function () {
        if (token !== sessionToken || !avplay) return;
        setAvAudioId(tr.index);
        try { avplay.play(); osd.playing = true; } catch (e) {}
        done();
      }, 350);
    } else if (stage === 4) {
      var tms = 0;
      try { tms = avplay.getCurrentTime() || 0; } catch (e) {}
      setAvAudioId(tr.index);
      try { avplay.seekTo(Math.max(0, tms - 300)); } catch (e) {}
      done();
    } else {
      if (setAvAudioId(tr.index)) done();
    }
  }
  function restartWithAudio(tr, forceIndex) {
    if (!session) return;
    var opts = {}, k;
    for (k in session) if (Object.prototype.hasOwnProperty.call(session, k)) opts[k] = session[k];
    opts.startPos = osd.pos;
    opts.forceEngine = 'avplay';
    opts.forceAudioIndex = (forceIndex != null) ? forceIndex : null;
    opts.audioVerifyLang = tr.language ? normLang(tr.language) : '';
    opts.audioLangLabel = tr.language ? langName(tr.language) : ('track ' + (tr.index + 1));
    opts.audioChecked = true;
    opts.audioVerified = false;
    opts.isRestart = true;
    opts.subCues = subCues;
    opts.subtitleRemote = (session && session.subtitleRemote) || '';
    stop(true);
    play(opts);
    if (Views.toast) Views.toast('Reopening with ' + (tr.language ? langName(tr.language) : 'selected') + ' audio…');
  }
  // After a reopen, confirm that the TV really switched.
  function verifyForcedAudio() {
    if (!session || session.audioVerified) return;
    if (session.forceAudioIndex == null && !session.audioVerifyLang) return;
    if (engineUsed !== 'avplay' || !avplay) {
      if (!session.audioVerified && Views.toast) {
        session.audioVerified = true;
        Views.toast('HTML5 cannot switch audio tracks on this TV');
      }
      return;
    }
    session.audioVerified = true;
    var cur = currentAudioInfo(), ok = true;
    if (cur) {
      var l = normLang(cur.language);
      if (session.audioVerifyLang && l) {
        ok = (l.indexOf(session.audioVerifyLang) === 0 || session.audioVerifyLang.indexOf(l) === 0);
      } else if (session.forceAudioIndex != null) {
        ok = String(cur.index) === String(session.forceAudioIndex);
      }
    }
    audioDiag = 'current idx ' + (cur ? cur.index : '?') + ' (' + (cur ? (cur.language || '?') : '?') + ') → ' + (ok ? 'MATCH' : 'MISMATCH');
    dbg('verifyForced ok=' + ok + ' current=' + JSON.stringify(cur) + ' wantIdx=' + session.forceAudioIndex + ' wantLang=' + session.audioVerifyLang);
    if (ok) session.audioConfirmed = true;
    if (Views.toast) {
      Views.toast(ok ? ('Audio: ' + (session.audioLangLabel || 'selected'))
        : 'This TV could not switch audio for this stream');
    }
    tracks.audioSel = (function () {
      for (var i = 0; i < tracks.audio.length; i++) {
        if ((session.audioVerifyLang && normLang(tracks.audio[i].language) === session.audioVerifyLang) ||
            (session.forceAudioIndex != null && String(tracks.audio[i].index) === String(session.forceAudioIndex))) {
          return tracks.audio[i].id;
        }
      }
      return tracks.audioSel;
    })();
    tracks.appliedAudio = true;
    updateTrackButton();
  }
  // Auto-selection can also fail silently: check once after playback starts.
  function verifyPreferredAudio() {
    if (!session || session.audioChecked) return;
    if (!tracks.audio.length || tracks.audioSel == null || !avplay) return;
    var sel = findTrack(tracks.audio, tracks.audioSel);
    if (!sel) return;
    session.audioChecked = true;
    if (!audioApplied(sel)) applyAvAudio(sel, 1);
  }
  function selectTrack(kind, streamId, lang) {
    var list = kind === 'AUDIO' ? tracks.audio : tracks.subtitle;
    var tr = findTrack(list, streamId);
    audioDiag = 'picked ' + kind + ' id=' + streamId + ' lang=' + lang + ' engine=' + engineUsed + ' found=' + !!tr;
    dbg('selectTrack kind=' + kind + ' id=' + streamId + ' lang=' + lang + ' engine=' + engineUsed + ' found=' + !!tr);
    if (kind === 'AUDIO' && !tr) {
      if (Views.toast) Views.toast('Audio track is no longer available — press Refresh tracks');
      return;
    }
    // Save the preference first so a restart/reopen can apply it again.
    if (lang) {
      var code = normLang(lang);
      if (kind === 'AUDIO') Store.setSetting('audioLang', code);
      if (kind === 'TEXT' && streamId != null && streamId >= 0) Store.setSetting('subLang', code);
    }
    if (kind === 'TEXT' && (streamId == null || streamId < 0)) {
      if (engineUsed === 'avplay' && avplay) {
        try {
          if (avplay.setSilentSubtitle) avplay.setSilentSubtitle(true);
          else if (avplay.setSelectTrack) avplay.setSelectTrack('TEXT', -1);
        } catch (e) {}
      }
      if (videoEl) {
        try { for (var i = 0; i < videoEl.textTracks.length; i++) videoEl.textTracks[i].mode = 'disabled'; } catch (e2) {}
      }
      tracks.subSel = null;
      tracks.appliedSub = true;
      clearAppSubtitles();
      if (engineUsed === 'avplay' && avplay) { try { if (avplay.setSilentSubtitle) avplay.setSilentSubtitle(true); } catch (e0) {} }
    } else if (tr) {
      if (engineUsed === 'avplay' && avplay) {
        if (kind === 'TEXT') {
          clearAppSubtitles();
          if (avplay.setSilentSubtitle) { try { avplay.setSilentSubtitle(false); } catch (e3) {} }
          if (setTrackApplied('TEXT', tr)) {
            tracks.subSel = tr.id;
            tracks.appliedSub = true;
            if (session) session.subtitleRemote = '';
          }
        } else {
          // Reopen at the same position: AVPlay applies the track reliably right after play().
          tracks.audioSel = tr.id;
          tracks.appliedAudio = true;
          restartWithAudio(tr, tr.index);
          return;
        }
      } else if (videoEl && kind === 'TEXT') {
        try {
          for (var j = 0; j < videoEl.textTracks.length; j++) {
            var vt = videoEl.textTracks[j];
            vt.mode = String(vt.id) === String(tr.id) ? 'showing' : 'disabled';
          }
        } catch (e4) {}
        tracks.subSel = tr.id;
        tracks.appliedSub = true;
      } else if (videoEl && kind === 'AUDIO') {
        // HTML5 cannot reliably switch tracks on Tizen 3.0: reopen in AVPlay with the chosen language.
        tracks.audioSel = tr.id;
        tracks.appliedAudio = true;
        restartWithAudio(tr, null);
        return;
      }
    }
    updateTrackButton();
    closeTrackMenu();
  }
  function restartWithSubtitle(url, lang, remoteUrl) {
    if (!session) return;
    var opts = {};
    for (var k in session) if (Object.prototype.hasOwnProperty.call(session, k)) opts[k] = session[k];
    opts.startPos = osd.pos;
    opts.subtitleUrl = url;
    opts.subtitleRemote = remoteUrl || session.subtitleRemote || '';
    stop(true);
    play(opts);
    if (Views.toast) Views.toast('Subtitles: ' + langName(lang));
  }
  function restartWithEngine(engine) {
    if (!session) return;
    var opts = {}, k;
    for (k in session) if (Object.prototype.hasOwnProperty.call(session, k)) opts[k] = session[k];
    opts.startPos = osd.pos;
    opts.forceEngine = engine;
    opts.isRestart = true;
    opts.subCues = subCues;
    opts.subtitleRemote = (session && session.subtitleRemote) || '';
    stop(true);
    play(opts);
    if (Views.toast) Views.toast(engine === 'avplay' ? 'Restarting with AVPlay for audio tracks…' : 'Restarting with HTML5…');
  }
  /* ---------------- app-rendered subtitles ----------------
     AVPlay's external subtitle path is unreliable on Tizen 3.0 and forces a reload.
     We download + parse the subtitle once and draw it in the web layer (which sits
     above the video plane), so cues stay in sync even when seeking. */
  function ensureSubOverlay() {
    if (subOverlay) return subOverlay;
    subOverlay = Util.el('div', 'subtitle-overlay hidden');
    document.body.appendChild(subOverlay);
    return subOverlay;
  }
  function removeSubOverlay() {
    if (subOverlay && subOverlay.parentNode) subOverlay.parentNode.removeChild(subOverlay);
    subOverlay = null; subLastText = '';
  }
  function parseSrt(text) {
    var blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/);
    var cues = [], i, j, lines, timeLine, m;
    for (i = 0; i < blocks.length; i++) {
      lines = blocks[i].split('\n');
      timeLine = -1;
      for (j = 0; j < lines.length; j++) if (lines[j].indexOf('-->') !== -1) { timeLine = j; break; }
      if (timeLine < 0) continue;
      m = lines[timeLine].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
      if (!m) continue;
      var start = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
      var end = (+m[5]) * 3600 + (+m[6]) * 60 + (+m[7]) + (+m[8]) / 1000;
      var body = lines.slice(timeLine + 1).join('\n').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
      if (body && end > start) cues.push({ start: start, end: end, text: body });
    }
    cues.sort(function (a, b) { return a.start - b.start; });
    return cues;
  }
  function updateSubtitleOverlay(pos) {
    if (!subCues.length) {
      if (subOverlay && subLastText !== '') { subOverlay.className = 'subtitle-overlay hidden'; subOverlay.textContent = ''; subLastText = ''; }
      return;
    }
    var found = '', i;
    for (i = 0; i < subCues.length; i++) {
      if (pos < subCues[i].start) break;
      if (pos <= subCues[i].end) { found = subCues[i].text; break; }
    }
    if (found === subLastText && subOverlay) return;
    ensureSubOverlay();
    subLastText = found;
    subOverlay.textContent = found;
    if (!found) { subOverlay.className = 'subtitle-overlay hidden'; return; }
    var s = Store.settings();
    subOverlay.className = 'subtitle-overlay sub-' + (s.subSize || 'medium') + ' subcol-' + (s.subColor || 'white');
  }
  function setSubtitleCues(cues, remoteUrl) {
    subCues = cues || [];
    subLastText = '';
    if (session) {
      session.subCues = subCues;
      session.subtitleRemote = remoteUrl || '';
      session.subtitleUrl = null;   // never hand the URL to AVPlay
    }
    ensureSubOverlay();
    updateSubtitleOverlay(osd.pos);
  }
  function clearAppSubtitles() {
    subCues = [];
    subLastText = '';
    if (session) { session.subtitleRemote = ''; session.subCues = []; }
    if (subOverlay) { subOverlay.className = 'subtitle-overlay hidden'; subOverlay.textContent = ''; }
  }
  function writeLocalSubtitle(text, cb) {
    var done = false;
    function finish(v) { if (!done) { done = true; cb(v); } }
    try {
      if (!window.tizen || !tizen.filesystem) { finish(null); return; }
      tizen.filesystem.resolve('wgt-private', function (dir) {
        try {
          var f = dir.createFile('nuvio_' + Date.now() + '.srt');
          f.openStream('w', function (stream) {
            try { stream.write(text); stream.close(); } catch (e) {}
            var path = '';
            // AVPlay wants an absolute filesystem path, not a file:// URI.
            try { path = f.fullPath || ''; } catch (e2) {}
            if (!path) { try { path = String(f.toURI() || '').replace(/^file:\/\//i, ''); } catch (e3) {} }
            dbg('subtitle saved path=' + path);
            finish(path || null);
          }, function () { finish(null); });
        } catch (e4) { finish(null); }
      }, function () { finish(null); });
    } catch (e5) { finish(null); }
  }
  function prepareSubtitlePath(url, cb) {
    // AVPlay cannot load remote subtitle URLs. Always download, convert VTT -> SRT,
    // and store an on-device file before playback restarts.
    if (!Util.isHttp(url)) { cb(url); return; }
    Http.getText(url, 10000, function (err, text) {
      if (err || !text || text.length < 10) { dbg('subtitle download failed'); cb(url); return; }
      if (/^\s*</.test(text.slice(0, 200))) { cb(url); return; }   // HTML error page
      var srt = text;
      if (/^\uFEFF?WEBVTT/i.test(text) || /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/.test(text)) {
        srt = Util.vttToSrt(text);
      }
      if (!srt || srt.length < 20) { cb(url); return; }
      writeLocalSubtitle(srt, function (filePath) { cb(filePath || url); });
    });
  }
  function setExternalSubtitle(url, lang) {
    if (lang) Store.setSetting('subLang', normLang(lang));
    if (Views.toast) Views.toast('Loading subtitles…');
    closeTrackMenu();
    Http.getText(url, 15000, function (err, text) {
      if (err || !text || text.length < 10) {
        if (Views.toast) Views.toast('Subtitle download failed');
        return;
      }
      var srt = text;
      if (/^\uFEFF?WEBVTT/i.test(text) || /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/.test(text)) {
        srt = Util.vttToSrt(text);
      }
      var cues = parseSrt(srt);
      dbg('external subtitle cues=' + cues.length + ' lang=' + lang);
      if (!cues.length) {
        if (Views.toast) Views.toast('Subtitle format not supported');
        return;
      }
      // Stop AVPlay from drawing a duplicate external/embedded subtitle; we draw the cues.
      if (engineUsed === 'avplay' && avplay) {
        try { if (avplay.setSilentSubtitle) avplay.setSilentSubtitle(true); } catch (e1) {}
        try { if (avplay.setSelectTrack) avplay.setSelectTrack('TEXT', -1); } catch (e2) {}
      }
      if (videoEl) {
        try { for (var i = 0; i < videoEl.textTracks.length; i++) videoEl.textTracks[i].mode = 'disabled'; } catch (e3) {}
      }
      tracks.subSel = 'ext';
      tracks.appliedSub = true;
      setSubtitleCues(cues, url);
      if (Views.toast) Views.toast('Subtitles: ' + langName(lang));
    });
  }

  /* ---------------- controls ---------------- */
  function togglePlay() {
    showOSD();
    if (engineUsed === 'avplay' && avplay) {
      try {
        if (osd.playing) { avplay.pause(); osd.playing = false; }
        else { avplay.play(); osd.playing = true; }
      } catch (e) {}
    } else if (videoEl) {
      if (videoEl.paused) { videoEl.play(); osd.playing = true; }
      else { videoEl.pause(); osd.playing = false; }
    }
    updateOSD();
  }
  function seekBy(sec) {
    showOSD();
    var dur = osd.dur;
    if (!(dur > 0) && engineUsed === 'avplay' && avplay && avplay.getDuration) {
      try { dur = (avplay.getDuration() || 0) / 1000; } catch (e0) {}
    }
    if (!(dur > 0) && videoEl && videoEl.duration) dur = videoEl.duration;
    if (dur > 0) osd.dur = dur;
    var target = osd.pos + sec;
    if (target < 0) target = 0;
    // Never clamp to 0 when duration is unknown: that made every seek restart from the beginning.
    if (dur > 0 && target > dur) target = dur;
    if (engineUsed === 'avplay' && avplay) {
      try {
        avplay.seekTo(target * 1000, function () { osd.pos = target; updateOSD(); },
          function (err) { if (Views.toast) Views.toast('Seek failed: ' + (err && (err.message || err.name) || 'unsupported')); });
      } catch (e) {}
    } else if (videoEl) { try { videoEl.currentTime = target; } catch (e2) {} }
    osd.pos = target;
    updateOSD();
  }
  function seekAccumulate(dir) {
    seekAccum.dir = dir;
    seekAccum.count++;
    seekAccum.pendingSec += dir * (seekAccum.count <= 2 ? 10 : (seekAccum.count <= 5 ? 30 : 60));
    updateOSD();
    if (seekAccum.timer) clearTimeout(seekAccum.timer);
    seekAccum.timer = setTimeout(function () {
      var sec = seekAccum.pendingSec;
      seekAccum.pendingSec = 0; seekAccum.count = 0;
      seekBy(sec);
    }, 600);
  }

  /* ---------------- lifecycle ---------------- */
  function stop(silent) {
    sessionToken++;
    savePos();
    stopSaveTimer();
    if (seekAccum.timer) { clearTimeout(seekAccum.timer); seekAccum.timer = null; }
    if (osd.hideTimer) { clearTimeout(osd.hideTimer); osd.hideTimer = null; }
    trackMenuOpen = false; osd.pinned = false;
    teardownAvplay();
    if (videoEl) {
      try { videoEl.pause(); } catch (e) {}
      try { videoEl.removeAttribute('src'); videoEl.load(); } catch (e2) {}
      videoEl.onloadedmetadata = null; videoEl.ontimeupdate = null; videoEl.onwaiting = null;
      videoEl.onplaying = null; videoEl.onended = null; videoEl.onerror = null;
      videoEl.onloadeddata = null; videoEl.oncanplay = null;
      try {
        if (audioAddHandler && videoEl.audioTracks && videoEl.audioTracks.removeEventListener) {
          videoEl.audioTracks.removeEventListener('addtrack', audioAddHandler);
        }
      } catch (e3) {}
      audioAddHandler = null;
      videoEl.style.display = 'none';
      videoEl = null;
    }
    removeDiv(document.getElementById('avplay-div'));
    removeOSD();
    removeSubOverlay();
    try {
      document.body.className = document.body.className.replace(/\s*player-active/g, '');
      document.documentElement.className = document.documentElement.className.replace(/\s*player-active/g, '');
    } catch (e) {}
    resetState();
    engineUsed = null;
    session = null;
    var cb = onExit; onExit = null;
    if (!silent && cb) cb();
  }
  function showError(msg) {
    Views.showDialog(msg, '', [ { label: I18n.t('close') } ], function () {});
  }
  function focusControl(dir) {
    var root = document.getElementById('player-osd');
    if (!root) return;
    var all = root.querySelectorAll('.focusable'), list = [], i;
    for (i = 0; i < all.length; i++) if (all[i].offsetParent !== null || all[i].getClientRects().length) list.push(all[i]);
    if (!list.length) return;
    var cur = FocusMgr.getFocus();
    var idx = -1;
    for (i = 0; i < list.length; i++) if (list[i] === cur) idx = i;
    if (idx === -1) idx = dir > 0 ? -1 : 0;
    var next = idx + dir;
    if (next < 0) next = list.length - 1;
    if (next >= list.length) next = 0;
    FocusMgr.setFocus(list[next]);
  }
  function isActive() { return !!engineUsed; }
  function isTrackMenuOpen() { return trackMenuOpen; }
  function getEngine() { return engineUsed; }
  function getHeadersNote() { return (session && session.headersNote) || ''; }
  function getTracks() { return { audio: tracks.audio.slice(), subtitle: tracks.subtitle.slice(), external: extSubs.slice() }; }

  /* ---------------- OSD actions ---------------- */
  Views.setExtraHandler('osd-pp', function () { togglePlay(); return true; });
  Views.setExtraHandler('osd-s10', function () { seekBy(-10); return true; });
  Views.setExtraHandler('osd-s30', function () { seekBy(-30); return true; });
  Views.setExtraHandler('osd-tracks', function () { showTrackMenu(); return true; });
  Views.setExtraHandler('osd-refresh-tracks', function () { loadTracks(); renderTrackMenu(); return true; });
  Views.setExtraHandler('osd-engine-avplay', function () { restartWithEngine('avplay'); return true; });
  Views.setExtraHandler('osd-track-close', function () { closeTrackMenu(); return true; });
  Views.setExtraHandler('osd-track', function (el) {
    selectTrack(el.getAttribute('data-kind'), parseInt(el.getAttribute('data-stream-id'), 10), el.getAttribute('data-lang'));
    return true;
  });
  Views.setExtraHandler('osd-extsub', function (el) {
    setExternalSubtitle(el.getAttribute('data-url'), el.getAttribute('data-lang'));
    return true;
  });

  return {
    play: play, stop: stop, togglePlay: togglePlay, seekBy: seekBy, seekAccumulate: seekAccumulate,
    showOSD: showOSD, isActive: isActive, isTrackMenuOpen: isTrackMenuOpen, focusControl: focusControl, getEngine: getEngine,
    getHeadersNote: getHeadersNote, getTracks: getTracks, selectTrack: selectTrack,
    showTrackMenu: showTrackMenu, closeTrackMenu: closeTrackMenu
  };
})();
