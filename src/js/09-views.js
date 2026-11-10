/* Views: Home, Detail, Search, Library, Settings, Profiles, Streams. ES5. */
var Views = (function () {
  'use strict';
  var appEl = function () { return document.getElementById('app'); };
  var SUB_ADDON_URL = 'https://opensubtitlesv3-pro.dexter21767.com/eyJsYW5ncyI6WyJhcmFiaWMiXSwic291cmNlIjoiYWxsIiwiYWlUcmFuc2xhdGVkIjp0cnVlLCJhdXRvQWRqdXN0bWVudCI6ZmFsc2V9/manifest.json';
  var PLUGIN_PRESETS = [
    { name: 'Yoru / Nuvio providers', url: 'https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json' },
    { name: 'Tapframe / Phisher98', url: 'https://raw.githubusercontent.com/phisher98/nuvio-providers/refs/heads/main/manifest.json' },
    { name: 'All-in-One-Nuvio', url: 'https://raw.githubusercontent.com/D3adlyRocket/All-in-One-Nuvio/refs/heads/main/manifest.json' },
    { name: 'MoOnCrOwN Nuvio', url: 'https://raw.githubusercontent.com/mooncrown04/nuviotr/refs/heads/main/manifest.json' }
  ];
  var viewStack = []; // {name, focusId}
  var currentView = 'home';

  function showDialog(title, msg, buttons, onPick) {
    var root = document.getElementById('dialog-root');
    root.innerHTML = '';
    var overlay = Util.el('div', 'dialog-overlay');
    var box = Util.el('div', 'dialog-box');
    box.appendChild(Util.el('div', 'dialog-title', title));
    if (msg) box.appendChild(Util.el('div', 'dialog-msg', msg));
    var btnRow = Util.el('div', 'dialog-btns');
    buttons.forEach(function (b, i) {
      var btn = Util.el('button', 'dialog-btn focusable', b.label);
      btn.setAttribute('data-focus-id', 'dlg-' + i);
      btn.setAttribute('data-dialog-idx', String(i));
      btn.setAttribute('type', 'button');
      btnRow.appendChild(btn);
    });
    box.appendChild(btnRow);
    overlay.appendChild(box);
    root.appendChild(overlay);
    FocusMgr.setScope(overlay);
    overlay.onclick = function (e) {
      var t = e.target.closest ? e.target.closest('[data-dialog-idx]') : null;
      if (t) { var idx = parseInt(t.getAttribute('data-dialog-idx'), 10); closeDialog(); onPick(idx); }
    };
    FocusMgr.focusFirst();
    return { close: closeDialog };
  }
  function closeDialog() {
    document.getElementById('dialog-root').innerHTML = '';
    FocusMgr.clearScope();
    if (window.Player && Player.isActive()) { Player.showOSD(); return; }
    var panel = document.getElementById('settings-panel');
    if (panel) {
      var f = panel.querySelector('.focusable');
      if (f) { FocusMgr.setFocus(f); return; }
    }
    FocusMgr.focusFirst();
  }
  function toast(msg) {
    // Append to <body>: #stage is scaled (a stacking context) and toasts appended there
    // were being covered by the player OSD during playback.
    var div = Util.el('div', 'toast', msg);
    document.body.appendChild(div);
    setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 3000);
  }
  var SIDEBAR_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  var SIDEBAR_ICONS = {
    home: SIDEBAR_SVG + '<path d="M3 11.2 12 4l9 7.2"/><path d="M5.5 10.5V20h13v-9.5"/></svg>',
    search: SIDEBAR_SVG + '<circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.4 15.4 5 5"/></svg>',
    library: SIDEBAR_SVG + '<rect x="4" y="5" width="4" height="14" rx="1"/><rect x="10" y="5" width="4" height="14" rx="1"/><rect x="16" y="5" width="4" height="14" rx="1"/></svg>',
    plugins: SIDEBAR_SVG + '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    settings: SIDEBAR_SVG + '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none"/></svg>',
    profile: SIDEBAR_SVG + '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2"/></svg>'
  };
  function sidebarIcon(name) {
    var span = Util.el('span', 'sidebar-glyph');
    span.innerHTML = SIDEBAR_ICONS[name] || '';
    return span;
  }
  function topBar(active) {
    var t = I18n.t;
    var bar = Util.el('div', 'topbar sidebar');
    var brand = Util.el('div', 'sidebar-brand');
    brand.appendChild(Util.el('span', 'sidebar-brand-name', '▶'));
    bar.appendChild(brand);
    var items = [
      { id: 'home', label: t('home') }, { id: 'search', label: t('search') },
      { id: 'library', label: t('library') }, { id: 'plugins', label: 'Plugins' },
      { id: 'settings', label: t('settings') }
    ];
    var nav = Util.el('div', 'sidebar-nav');
    items.forEach(function (it) {
      var b = Util.el('button', 'top-btn focusable' + (active === it.id ? ' top-active' : ''));
      b.setAttribute('data-focus-id', 'top-' + it.id);
      b.setAttribute('data-action', 'nav-' + it.id);
      b.setAttribute('data-label', it.label);
      b.setAttribute('title', it.label);
      b.setAttribute('type', 'button');
      b.appendChild(sidebarIcon(it.id));
      nav.appendChild(b);
    });
    bar.appendChild(nav);
    var prof = Store.profile();
    var pn = Util.el('span', 'top-profile');
    pn.innerHTML = SIDEBAR_ICONS.profile;
    pn.setAttribute('title', prof.name || Store.state().currentProfile);
    bar.appendChild(pn);
    return bar;
  }
  function posterCard(meta, idx, rowId) {
    var card = Util.el('div', 'card focusable');
    var fid = rowId + '-' + idx;
    card.setAttribute('data-focus-id', fid);
    card.setAttribute('data-action', 'open-detail');
    card.setAttribute('data-type', meta.type || '');
    card.setAttribute('data-id', meta.id || '');
    var img = Util.el('img', 'card-img');
    var poster = Util.sanitizeUrl(meta.poster || meta.background || '');
    if (poster) {
      img.setAttribute('loading', 'lazy');
      img.src = poster;
      img.onerror = function () { img.style.display = 'none'; };
    } else img.style.display = 'none';
    var ph = Util.el('div', 'card-ph', (meta.name || meta.title || '?').slice(0, 2).toUpperCase());
    card.appendChild(ph);
    card.appendChild(img);
    var lbl = Util.el('div', 'card-label', meta.name || meta.title || meta.id);
    card.appendChild(lbl);
    if (meta.year) card.appendChild(Util.el('div', 'card-year', String(meta.year)));
    var key = (meta.type || '') + ':' + (meta.id || '');
    if (Store.profile().watched[key]) card.appendChild(Util.el('div', 'card-badge', '✓ ' + I18n.t('watched')));
    return card;
  }
  function mediaSection(label) {
    var sec = Util.el('div', 'media-section');
    var head = Util.el('div', 'section-head');
    head.appendChild(Util.el('span', 'section-title', label));
    sec.appendChild(head);
    var body = Util.el('div', 'section-body');
    sec.appendChild(body);
    return { root: sec, body: body };
  }
  function rowEl(title, metas, rowId, onMore) {
    var wrap = Util.el('div', 'row');
    if (title) wrap.appendChild(Util.el('div', 'row-title', title));
    var list = Util.el('div', 'row-list');
    // virtualize: render max 40 cards per row (recycled in practice by small cap)
    var slice = metas.slice(0, 40);
    for (var i = 0; i < slice.length; i++) list.appendChild(posterCard(slice[i], i, rowId));
    if (onMore) {
      var more = Util.el('button', 'card card-more focusable', '+');
      more.setAttribute('data-focus-id', rowId + '-more');
      more.setAttribute('data-action', 'row-more');
      more.setAttribute('data-row', rowId);
      more.setAttribute('type', 'button');
      list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
  }
  // Focus the first control inside a view (not the top bar) so D-pad starts in content
  function focusViewFirst(main, fallbackId) {
    var first = main && main.querySelector ? main.querySelector('.focusable') : null;
    if (first) { FocusMgr.setFocus(first); return; }
    if (fallbackId && FocusMgr.focusById(fallbackId)) return;
    FocusMgr.focusFirst();
  }
  function focusedId() {
    var el = FocusMgr.getFocus && FocusMgr.getFocus();
    return el && el.getAttribute ? (el.getAttribute('data-focus-id') || '') : '';
  }
  // Re-render a panel without losing the user's place: restore the same focus id,
  // otherwise let focusFirst() keep a still-valid element instead of snapping.
  function restoreFocus(fid) {
    if (fid && FocusMgr.focusById(fid)) return true;
    FocusMgr.focusFirst();
    return false;
  }
  function skeleton(msg) {
    var d = Util.el('div', 'skeleton', msg || I18n.t('loading'));
    var sp = Util.el('div', 'spinner');
    d.appendChild(sp);
    return d;
  }
  function errorBox(msg, onRetry) {
    var d = Util.el('div', 'error-box');
    d.appendChild(Util.el('div', 'error-msg', msg || I18n.t('errorNetwork')));
    var b = Util.el('button', 'btn focusable', I18n.t('retry'));
    b.setAttribute('data-focus-id', 'err-retry');
    b.setAttribute('data-action', 'retry');
    b.setAttribute('type', 'button');
    d.appendChild(b);
    d._retry = onRetry;
    return d;
  }

  /* ---------- HOME ---------- */
  function renderHome() {
    currentView = 'home';
    var app = appEl();
    app.innerHTML = '';
    app.appendChild(topBar('home'));
    var main = Util.el('div', 'home-main');
    app.appendChild(main);
    var prof = Store.profile();
    // Continue watching row (from history)
    var hist = prof.history || {};
    var cw = Object.keys(hist).map(function (k) { return hist[k]; }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).filter(function (h) { return h.pos > 10 && (!h.dur || h.pos < h.dur * 0.95); });
    if (cw.length) {
      var cwMetas = cw.map(function (h) { return { type: h.type, id: h.id, name: h.title, poster: h.poster }; });
      main.appendChild(rowEl(I18n.t('continueWatching'), cwMetas, 'cw'));
    }
    var hero = Util.el('div', 'hero');
    var logo = Util.el('img', 'hero-logo');
    logo.src = 'assets/logo.png';
    logo.alt = 'Nuvio';
    hero.appendChild(logo);
    var heroText = Util.el('div', 'hero-text');
    heroText.appendChild(Util.el('div', 'hero-title', 'Nuvio Lite'));
    heroText.appendChild(Util.el('div', 'hero-sub', 'Tizen 3.0 · Cinemeta'));
    hero.appendChild(heroText);
    main.appendChild(hero);
    var rowsHost = Util.el('div', 'rows-host');
    rowsHost.appendChild(skeleton());
    main.appendChild(rowsHost);
    loadHomeRows(rowsHost);
    FocusMgr.focusFirst();
  }
  function loadHomeRows(host) {
    var addons = Api.enabledAddons();
    var pending = addons.length;
    if (!pending) { host.innerHTML = ''; host.appendChild(errorBox(I18n.t('noResults'))); return; }
    host.innerHTML = '';
    var movieSec = mediaSection(I18n.t('movies'));
    var seriesSec = mediaSection(I18n.t('series'));
    host.appendChild(movieSec.root);
    host.appendChild(seriesSec.root);
    function finish() {
      if (!movieSec.body.querySelector('.row')) movieSec.root.className += ' hidden';
      if (!seriesSec.body.querySelector('.row')) seriesSec.root.className += ' hidden';
      if (!host.querySelector('.row')) host.appendChild(skeleton(I18n.t('noResults')));
      FocusMgr.focusFirst();
    }
    addons.forEach(function (addon, ai) {
      Api.ensureManifest(addon, function (err) {
        if (err) {
          host.appendChild(errorBox(I18n.t('errorAddon') + ': ' + (addon.url || '')));
          if (--pending === 0) finish();
          return;
        }
        var allCats = (addon.manifest.catalogs || []).filter(function (c) { return c.type === 'movie' || c.type === 'series'; });
        // Keep both types: an addon's movie catalogs can fill the first slots and hide series entirely.
        var movieCats = allCats.filter(function (c) { return c.type === 'movie'; }).slice(0, 3);
        var seriesCats = allCats.filter(function (c) { return c.type === 'series'; }).slice(0, 3);
        var cats = movieCats.concat(seriesCats);
        var left = cats.length;
        if (!left) { if (--pending === 0) finish(); return; }
        cats.forEach(function (cat, ci) {
          Api.getCatalog(addon, cat.type, cat.id, { skip: 0 }, function (e2, metas) {
            if (!e2 && metas && metas.length) {
              var rowId = 'r' + ai + '-' + ci;
              var title = (cat.name || cat.id) + (addon.manifest.name ? ' · ' + addon.manifest.name : '');
              var target = cat.type === 'series' ? seriesSec.body : movieSec.body;
              target.appendChild(rowEl(title, metas, rowId, function () {}));
              // lazy pagination: store context for "more"
              var lastRow = target.querySelector('.row:last-child');
              if (lastRow) lastRow.setAttribute('data-catalog', JSON.stringify({ ai: ai, type: cat.type, id: cat.id, skip: metas.length }));
            }
            if (--left === 0 && --pending === 0) finish();
          });
        });
      });
    });
  }

  /* ---------- DETAIL ---------- */
  var detailState = { type: '', id: '', meta: null, season: 1 };
  function renderDetail(type, id) {
    currentView = 'detail';
    var app = appEl();
    app.innerHTML = '';
    app.appendChild(topBar(''));
    var main = Util.el('div', 'detail-main');
    main.appendChild(skeleton());
    app.appendChild(main);
    FocusMgr.focusFirst();
    // try each enabled addon for meta (first success wins)
    var addons = Api.enabledAddons();
    var idx = 0;
    function tryNext() {
      if (idx >= addons.length) { main.innerHTML = ''; main.appendChild(errorBox(I18n.t('errorNetwork'))); return; }
      var addon = addons[idx++];
      Api.getMeta(addon, type, id, function (err, meta) {
        if (err || !meta) return tryNext();
        detailState = { type: type, id: id, meta: meta, season: 1 };
        drawDetail(main, meta);
        // Trakt scrobble hook fallback handled by player
      });
    }
    tryNext();
  }
  function drawDetail(main, meta) {
    var fid = focusedId();
    main.innerHTML = '';
    var wrap = Util.el('div', 'detail-wrap');
    var bg = Util.sanitizeUrl(meta.background || meta.poster || '');
    var banner = Util.el('div', 'detail-banner');
    if (bg) banner.style.backgroundImage = 'url(' + bg + ')';
    banner.appendChild(Util.el('div', 'detail-title', meta.name || meta.title || meta.id));
    var sub = [meta.year, meta.runtime ? meta.runtime + ' min' : '', meta.imdbRating ? '★ ' + meta.imdbRating : ''].filter(Boolean).join('  ·  ');
    if (sub) banner.appendChild(Util.el('div', 'detail-sub', sub));
    if (meta.genres && meta.genres.length) banner.appendChild(Util.el('div', 'detail-sub', meta.genres.join(', ')));
    wrap.appendChild(banner);
    if (meta.description) wrap.appendChild(Util.el('div', 'detail-desc', meta.description));
    if (meta.cast && meta.cast.length) wrap.appendChild(Util.el('div', 'detail-sub', 'Cast: ' + meta.cast.slice(0, 6).join(', ')));
    var acts = Util.el('div', 'detail-actions');
    var histKey = meta.type + ':' + meta.id;
    var hist = Store.profile().history[histKey];
    var playBtn = Util.el('button', 'btn btn-primary focusable', (hist && hist.pos > 10 ? I18n.t('resume') : I18n.t('play')));
    playBtn.setAttribute('data-focus-id', 'detail-play');
    playBtn.setAttribute('data-action', 'detail-play');
    playBtn.setAttribute('type', 'button');
    acts.appendChild(playBtn);
    var watchedKey = meta.type + ':' + meta.id;
    var isWatched = !!Store.profile().watched[watchedKey];
    var wBtn = Util.el('button', 'btn focusable', isWatched ? I18n.t('markUnwatched') : I18n.t('markWatched'));
    wBtn.setAttribute('data-focus-id', 'detail-watched');
    wBtn.setAttribute('data-action', 'detail-watched');
    wBtn.setAttribute('type', 'button');
    acts.appendChild(wBtn);
    var inLib = Store.profile().library.some(function (x) { return x.type === meta.type && x.id === meta.id; });
    var lBtn = Util.el('button', 'btn focusable', inLib ? I18n.t('removeLibrary') : I18n.t('addLibrary'));
    lBtn.setAttribute('data-focus-id', 'detail-lib');
    lBtn.setAttribute('data-action', 'detail-lib');
    lBtn.setAttribute('type', 'button');
    acts.appendChild(lBtn);
    wrap.appendChild(acts);
    // Series: season selector + episodes
    if (meta.type === 'series' && meta.videos && meta.videos.length) {
      var seasons = [];
      meta.videos.forEach(function (v) { if (seasons.indexOf(v.season) === -1) seasons.push(v.season); });
      seasons.sort(function (a, b) { return a - b; });
      var sRow = Util.el('div', 'season-row');
      sRow.appendChild(Util.el('span', 'season-label', I18n.t('seasons') + ': '));
      var chips = Util.el('div', 'season-chips');
      seasons.forEach(function (s, si) {
        var chip = Util.el('button', 'season-chip focusable' + (s === detailState.season ? ' selected' : ''), 'S' + s);
        chip.setAttribute('data-focus-id', 'season-chip-' + si);
        chip.setAttribute('data-action', 'detail-season');
        chip.setAttribute('data-season', String(s));
        chip.setAttribute('type', 'button');
        chips.appendChild(chip);
      });
      sRow.appendChild(chips);
      wrap.appendChild(sRow);
      var eps = Util.el('div', 'ep-list');
      drawEpisodes(eps, meta, detailState.season);
      wrap.appendChild(eps);
    }
    main.appendChild(wrap);
    // Keep the user's place when the page is rebuilt (watched/library toggles),
    // but on first load put focus on Play instead of the top navigation.
    if (fid && fid.indexOf('top-') !== 0 && FocusMgr.focusById(fid)) return;
    FocusMgr.focusById('detail-play') || FocusMgr.focusFirst();
  }
  function drawEpisodes(host, meta, season) {
    host.innerHTML = '';
    var vids = (meta.videos || []).filter(function (v) { return v.season === season; }).sort(function (a, b) { return (a.episode || 0) - (b.episode || 0); });
    vids.forEach(function (v, i) {
      var row = Util.el('div', 'ep-row focusable');
      row.setAttribute('data-focus-id', 'ep-' + season + '-' + i);
      row.setAttribute('data-action', 'detail-episode');
      row.setAttribute('data-video-id', v.id || '');
      row.setAttribute('data-episode', String(v.episode || ''));
      var num = Util.el('span', 'ep-num', String(v.episode || (i + 1)));
      var ttl = Util.el('span', 'ep-title', v.title || v.name || ('Episode ' + (v.episode || i + 1)));
      row.appendChild(num); row.appendChild(ttl);
      if (v.overview) row.appendChild(Util.el('div', 'ep-overview', String(v.overview).slice(0, 120)));
      host.appendChild(row);
    });
  }

  /* ---------- SEARCH ---------- */
  var searchState = { query: '' };
  function renderSearch() {
    currentView = 'search';
    var app = appEl();
    app.innerHTML = '';
    app.appendChild(topBar('search'));
    var main = Util.el('div', 'search-main');
    var kbHost = Util.el('div', 'kb-host');
    main.appendChild(kbHost);
    var results = Util.el('div', 'search-results');
    main.appendChild(results);
    app.appendChild(main);
    var doSearch = Util.debounce(function (q, focusResults) {
      searchState.query = q;
      results.innerHTML = '';
      if (!q.trim()) return;
      results.appendChild(skeleton());
      Api.searchAll(q, function (err, out) {
        if (searchState.query !== q) return; // stale response
        results.innerHTML = '';
        if (err) { results.appendChild(errorBox(I18n.t('errorNetwork'))); return; }
        ['movie', 'series'].forEach(function (ty) {
          var metas = out[ty] || [];
          if (metas.length) {
            var sec = mediaSection(ty === 'movie' ? I18n.t('movies') : I18n.t('series'));
            sec.body.appendChild(rowEl('', metas, 'search-' + ty));
            results.appendChild(sec.root);
          }
        });
        if (!results.querySelector('.row')) results.appendChild(skeleton(I18n.t('noResults')));
        if (focusResults) {
          var first = results.querySelector('.focusable');
          if (first) FocusMgr.setFocus(first);
        }
      });
    }, 500);
    Kb.render(kbHost, {
      initial: '',
      onInput: function (q) { doSearch(q, false); },
      onDone: function (q) { doSearch(q, true); },
      idPrefix: 'search-kb'
    });
    focusViewFirst(main);
  }

  /* ---------- LIBRARY ---------- */
  function renderLibrary() {
    currentView = 'library';
    var app = appEl();
    app.innerHTML = '';
    app.appendChild(topBar('library'));
    var main = Util.el('div', 'library-main');
    var lib = Store.profile().library || [];
    if (!lib.length) main.appendChild(skeleton(I18n.t('libraryEmpty')));
    else {
      var movies = [], series = [];
      lib.forEach(function (x) {
        var m = { type: x.type, id: x.id, name: x.title, poster: x.poster };
        if (x.type === 'series') series.push(m); else movies.push(m);
      });
      if (movies.length) {
        var ms = mediaSection(I18n.t('movies'));
        ms.body.appendChild(rowEl('', movies, 'lib-movie'));
        main.appendChild(ms.root);
      }
      if (series.length) {
        var ss = mediaSection(I18n.t('series'));
        ss.body.appendChild(rowEl('', series, 'lib-series'));
        main.appendChild(ss.root);
      }
    }
    // Watched list section
    var watched = Store.profile().watched || {};
    var wkeys = Object.keys(watched).filter(function (k) { return watched[k]; });
    if (wkeys.length) main.appendChild(Util.el('div', 'detail-sub', I18n.t('watched') + ': ' + wkeys.length));
    app.appendChild(main);
    focusViewFirst(main, 'top-library');
  }

  /* ---------- STREAMS ---------- */
  var streamState = { type: '', id: '', videoId: '', meta: null, langMode: 'auto' };
  var pluginErrShown = 0;
  function audioFilterActive() {
    if (String(Store.settings().audioLang || 'en') === 'original') return false;
    return streamState.langMode === 'only';
  }
  function audioPrefLabel() {
    return optionLabel('audioLang', Store.settings().audioLang || 'en');
  }
  function renderStreams(type, id, videoId, meta) {
    currentView = 'streams';
    var app = appEl();
    app.innerHTML = '';
    app.appendChild(topBar(''));
    var main = Util.el('div', 'streams-main');
    var head = Util.el('div', 'streams-head');
    head.appendChild(Util.el('div', 'streams-kicker', I18n.t('streams')));
    head.appendChild(Util.el('div', 'streams-title', (meta && (meta.name || meta.title)) || id));
    var metaLine = Util.el('div', 'streams-sub', 'Searching sources…');
    metaLine.id = 'streams-meta';
    head.appendChild(metaLine);
    var sSettings = Store.settings();
    streamState.langMode = (String(sSettings.enforceAudioLang || 'on') === 'on' &&
      String(sSettings.audioLang || 'en') !== 'original') ? 'only' : 'all';
    if (String(sSettings.audioLang || 'en') !== 'original') {
      var langChip = Util.el('button', 'lang-chip focusable');
      langChip.id = 'streams-lang-chip';
      langChip.setAttribute('data-focus-id', 'streams-lang-chip');
      langChip.setAttribute('data-action', 'streams-toggle-langs');
      langChip.setAttribute('type', 'button');
      head.appendChild(langChip);
    }
    main.appendChild(head);
    var list = Util.el('div', 'streams-list' + (audioFilterActive() ? ' hide-other-langs' : ''));
    list.id = 'streams-list';
    main.appendChild(list);
    list.appendChild(skeleton());
    app.appendChild(main);
    streamState = { type: type, id: id, videoId: videoId || id, meta: meta, langMode: streamState.langMode };
    pluginErrShown = 0;
    FocusMgr.focusFirst();
    var key = videoId || id;

    // --- on-device scrapers start immediately (they do not depend on Stremio stream addons) ---
    var parts = String(key).split(':');
    var tmdb = (meta && (meta.moviedb_id || meta.tmdb_id)) || '';
    if (!tmdb && /^\d+$/.test(parts[0])) tmdb = parts[0];
    var ctx = { tmdbId: String(tmdb || ''), id: String(tmdb || parts[0]),
      mediaType: (type === 'series' ? 'tv' : 'movie'),
      season: parts.length > 2 ? parseInt(parts[1], 10) || 1 : 1,
      episode: parts.length > 2 ? parseInt(parts[2], 10) || 1 : 1 };
    var enabled = Plugins.getScrapers().filter(function (s) { return s.enabled; });
    var pcount = enabled.length;
    var progress = null;
    if (pcount && !ctx.tmdbId) {
      list.appendChild(Util.el('div', 'note', 'Scrapers need a numeric TMDB id, but this title only provided an IMDb id. Open Plugins → Plugin Test and use a TMDB id.'));
    } else if (pcount) {
      progress = Util.el('div', 'note', 'Scrapers: running 0/' + pcount + '…');
      list.appendChild(progress);
      var doneCount = 0, okCount = 0;
      Plugins.runAllEnabled(ctx, function (scraper, res) {
        doneCount++;
        if (res.ok && res.results.length) okCount++;
        if (progress) progress.textContent = 'Scrapers: ' + doneCount + '/' + pcount + ' done · ' + okCount + ' with results';
        var sk = list.querySelector('.skeleton'); if (sk) sk.parentNode.removeChild(sk);
        drawPluginGroup(list, scraper, res);
        FocusMgr.focusFirst();
      }, function () {
        if (progress) progress.textContent = 'Scrapers: ' + pcount + ' done · ' + okCount + ' with results' + (okCount === 0 ? ' — open Plugins → Plugin Test to inspect failures' : '');
        if (okCount === 0) list.appendChild(Util.el('div', 'note', 'No scraper returned a playable stream for this title. Try another provider in Plugins → Plugin Test.'));
        FocusMgr.focusFirst();
      });
    }

    // --- Stremio stream addons (parallel, results as they arrive) ---
    Api.aggregateStreams(type, key, function (group) {
      var sk = list.querySelector('.skeleton'); if (sk) sk.parentNode.removeChild(sk);
      drawStreamGroup(list, group);
    }, function (results, supported) {
      var sk = list.querySelector('.skeleton'); if (sk) sk.parentNode.removeChild(sk);
      if (!supported) {
        if (!pcount) {
          list.appendChild(Util.el('div', 'note', 'No stream addons installed, and no scrapers enabled. Add a Stremio stream addon in Settings, or install scrapers in Plugins.'));
        }
        return;
      }
      var hasPlayable = false;
      results.forEach(function (g) { if (g.streams.some(function (s) { return s.url; }) || (Resolver.isConfigured() && g.streams.some(function (s) { return s.infoHash; }))) hasPlayable = true; });
      var hasRows = !!list.querySelector('.stream-row');
      if (!hasPlayable && !hasRows) {
        list.appendChild(Util.el('div', 'note', 'No addon returned streams. Check Settings → Addons, or try a scraper above.'));
      }
      FocusMgr.focusFirst();
    });
  }
  function qualityScore(info) {
    var q = (info && info.quality) || '';
    if (/2160|4K|UHD/i.test(q)) return 4;
    if (/1080/.test(q)) return 3;
    if (/720/.test(q)) return 2;
    if (/480|SD|CAM|TS/i.test(q)) return 1;
    return 0;
  }
  function refreshStreamsMeta() {
    var el = document.getElementById('streams-meta');
    if (!el) return;
    var filtering = audioFilterActive();
    var allRows = document.querySelectorAll('.stream-row').length;
    var other = document.querySelectorAll('.stream-row.is-other-lang').length;
    var visible = filtering ? (allRows - other) : allRows;
    var groupEls = document.querySelectorAll('.stream-group');
    var shownGroups = 0, gi, gEl;
    for (gi = 0; gi < groupEls.length; gi++) {
      gEl = groupEls[gi];
      var hasVisible = !!gEl.querySelector('.stream-row:not(.is-other-lang)');
      var hasAny = !!gEl.querySelector('.stream-row');
      var countEl = gEl.querySelector('.stream-count');
      if (countEl) {
        var total = parseInt(countEl.getAttribute('data-total') || '0', 10) || 0;
        countEl.textContent = filtering ? String(Math.max(0, total - gEl.querySelectorAll('.stream-row.is-other-lang').length)) : String(total);
      }
      if (filtering && hasAny && !hasVisible) gEl.classList.add('filtered-empty');
      else {
        gEl.classList.remove('filtered-empty');
        if (!filtering || hasVisible) shownGroups++;
      }
    }
    if (!allRows) { el.textContent = 'Searching sources…'; }
    else if (filtering && !visible) {
      el.textContent = 'No ' + audioPrefLabel() + ' sources found · ' + other + ' hidden — press the audio filter to show all';
    } else if (filtering && other) {
      el.textContent = visible + ' ' + audioPrefLabel() + ' sources · ' + other + ' hidden · sorted by quality';
    } else {
      el.textContent = allRows + ' sources · ' + shownGroups + ' providers · sorted by quality';
    }
    var chip = document.getElementById('streams-lang-chip');
    if (chip) {
      chip.textContent = filtering
        ? ('Audio: ' + audioPrefLabel() + ' only' + (other ? ' · ' + other + ' hidden' : '') + '  ▾')
        : 'Audio: all languages  ▾';
      if (filtering) chip.classList.add('active'); else chip.classList.remove('active');
    }
  }
  function streamHintText(text) {
    var t = String(text || ''), m = streamState.meta;
    if (!m) return t;
    [m.name, m.title].forEach(function (v) {
      if (v && String(v).length > 2) {
        var re = new RegExp(String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        t = t.replace(re, ' ');
      }
    });
    return t;
  }
  function streamRow(stream, url, via, idx, headers) {
    var fullText = (stream.name || '') + ' ' + (stream.title || '') + ' ' + (stream.quality || '');
    var text = streamHintText(fullText);
    var info = Util.parseStreamInfo(fullText);
    var row = Util.el('div', 'stream-row focusable');
    row.setAttribute('data-focus-id', 'stream-' + idx + '-' + Math.floor(Math.random() * 100000));
    row.setAttribute('data-action', 'play-stream');
    row.setAttribute('data-url', url);
    if (headers) row.setAttribute('data-headers', JSON.stringify(headers || {}));
    var pref = String(Store.settings().audioLang || 'en');
    var sl = Util.streamLangs(text);
    var allowed = Util.audioAllowed(text, pref);
    if (!allowed) {
      row.className += ' is-other-lang';
      row.setAttribute('data-langs', sl.langs.join(','));
    } else if (sl.multi) {
      row.className += ' is-multi-audio';
    }
    row.appendChild(Util.el('span', 'stream-num', (idx < 10 ? '0' : '') + idx));
    var body = Util.el('div', 'stream-main');
    body.appendChild(Util.el('span', 'stream-name', (stream.name || stream.title || url).slice(0, 90)));
    var hint = sl.multi ? 'multi-audio' : (sl.langs.length ? (sl.langs.join('/') + ' audio') : (!allowed ? 'other language' : ''));
    var tags = [info.codec, info.sizeText, via ? ('via ' + via) : '', (headers && Object.keys(headers).length) ? 'custom headers' : '', hint].filter(Boolean).join(' · ');
    body.appendChild(Util.el('span', 'stream-tags', tags || 'direct link'));
    row.appendChild(body);
    var badge = Util.el('span', 'stream-badge' + (info.quality ? (' q' + qualityScore(info)) : ''), info.quality || 'LINK');
    row.appendChild(badge);
    return row;
  }
  function drawStreamGroup(list, group) {
    var g = Util.el('div', 'stream-group');
    var aname = (group.addon.manifest && group.addon.manifest.name) || group.addon.url;
    var head = Util.el('div', 'stream-group-head');
    head.appendChild(Util.el('span', 'stream-addon', aname));
    g.appendChild(head);
    Resolver.processStreams(streamState.type, streamState.videoId, group.streams, function (err, res) {
      if (err) { g.appendChild(errorBox(I18n.t('errorNetwork'))); list.appendChild(g); return; }
      var items = [];
      res.direct.forEach(function (s) { items.push({ s: s, url: s.url, via: '', h: null }); });
      res.resolved.forEach(function (r) { items.push({ s: r.stream, url: r.url, via: r.via, h: null }); });
      items.sort(function (a, b) {
        return qualityScore(Util.parseStreamInfo((b.s.name || '') + ' ' + (b.s.title || ''))) -
               qualityScore(Util.parseStreamInfo((a.s.name || '') + ' ' + (a.s.title || '')));
      });
      items.forEach(function (it, i) { g.appendChild(streamRow(it.s, it.url, it.via, i + 1, it.h)); });
      var cnt = Util.el('span', 'stream-count', items.length + '');
      cnt.setAttribute('data-total', String(items.length));
      head.appendChild(cnt);
      if (!items.length && res.torrents.length && !Resolver.isConfigured()) {
        g.appendChild(Util.el('div', 'note', I18n.t('unsupported')));
      } else if (!items.length && res.torrents.length && Resolver.isConfigured()) {
        g.appendChild(Util.el('div', 'note', I18n.t('errorNetwork') + ' (resolver)'));
      }
      list.appendChild(g);
      refreshStreamsMeta();
    });
  }
  function drawPluginGroup(list, scraper, res) {
    var g = Util.el('div', 'stream-group');
    var head = Util.el('div', 'stream-group-head');
    head.appendChild(Util.el('span', 'stream-addon', 'Plugin · ' + scraper.id));
    g.appendChild(head);
    if (!res.ok) {
      if (pluginErrShown < 6) {
        pluginErrShown++;
        g.appendChild(Util.el('div', 'note', 'provider ' + scraper.id + ' failed: ' + res.error));
        list.appendChild(g);
      }
      return;
    }
    if (!res.results.length) return;
    var results = res.results.slice().sort(function (a, b) {
      return qualityScore(Util.parseStreamInfo((b.name || '') + ' ' + (b.title || '') + ' ' + (b.quality || ''))) -
             qualityScore(Util.parseStreamInfo((a.name || '') + ' ' + (a.title || '') + ' ' + (a.quality || '')));
    });
    results.forEach(function (r, idx) {
      g.appendChild(streamRow(r, r.url, '', idx + 1, r.headers || {}));
    });
    var pcnt = Util.el('span', 'stream-count', results.length + '');
    pcnt.setAttribute('data-total', String(results.length));
    head.appendChild(pcnt);
    list.appendChild(g);
    refreshStreamsMeta();
  }

  /* ---------- SETTINGS ---------- */
  var settingsState = { cat: 'languages' };
  var UI_LANGS = [
    { v: 'en', l: 'English' }, { v: 'ar', l: 'العربية' },
    { v: 'fr', l: 'Français' }, { v: 'es', l: 'Español' }, { v: 'tr', l: 'Türkçe' }
  ];
  var AUDIO_LANGS = [
    { v: 'en', l: 'English' }, { v: 'ar', l: 'العربية' }, { v: 'fr', l: 'Français' },
    { v: 'es', l: 'Español' }, { v: 'tr', l: 'Türkçe' }, { v: 'de', l: 'Deutsch' },
    { v: 'hi', l: 'हिन्दी' }, { v: 'original', l: 'Original' }
  ];
  var SUB_LANGS = [
    { v: 'off', l: 'Off' }, { v: 'en', l: 'English' }, { v: 'ar', l: 'العربية' },
    { v: 'fr', l: 'Français' }, { v: 'es', l: 'Español' }, { v: 'tr', l: 'Türkçe' },
    { v: 'de', l: 'Deutsch' }, { v: 'hi', l: 'हिन्दी' }
  ];
  var SETTINGS_CATS = ['languages', 'playback', 'addons', 'scrapers', 'resolver', 'profiles', 'dataAbout'];

  function optionsFor(key) {
    var t = I18n.t;
    if (key === 'lang') return UI_LANGS;
    if (key === 'audioLang') return AUDIO_LANGS;
    if (key === 'enforceAudioLang') return [ { v: 'on', l: 'On — hide other languages' }, { v: 'off', l: 'Off — show every stream' } ];
    if (key === 'subLang') return SUB_LANGS;
    if (key === 'playerEngine') return [ { v: 'auto', l: t('auto') }, { v: 'avplay', l: t('avplay') }, { v: 'html5', l: t('html5') } ];
    if (key === 'defaultQuality') return [ { v: 'any', l: t('auto') }, { v: '2160p', l: '2160p' }, { v: '1080p', l: '1080p' }, { v: '720p', l: '720p' }, { v: '480p', l: '480p' } ];
    if (key === 'subSize') return [ { v: 'small', l: 'Small' }, { v: 'medium', l: 'Medium' }, { v: 'large', l: 'Large' } ];
    if (key === 'subColor') return [ { v: 'white', l: 'White' }, { v: 'yellow', l: 'Yellow' }, { v: 'cyan', l: 'Cyan' } ];
    if (key === 'resolverMode') return [ { v: 'debrid', l: t('debrid') }, { v: 'lan', l: t('lan') } ];
    if (key === 'resolverAdapter') return [ { v: 'stremio-server', l: 'stremio-server' }, { v: 'torrserver', l: 'torrserver' } ];
    return [];
  }
  function optionLabel(key, value) {
    var opts = optionsFor(key);
    for (var i = 0; i < opts.length; i++) if (opts[i].v === value) return opts[i].l;
    return String(value || '—');
  }
  function showChoice(title, opts, current, onPick) {
    var root = document.getElementById('dialog-root');
    root.innerHTML = '';
    var overlay = Util.el('div', 'choice-overlay');
    var box = Util.el('div', 'choice-box');
    box.appendChild(Util.el('div', 'dialog-title', title));
    var list = Util.el('div', 'choice-list');
    opts.forEach(function (o, i) {
      var b = Util.el('button', 'choice-row focusable' + (o.v === current ? ' selected' : ''), o.l);
      b.setAttribute('data-choice-idx', String(i));
      b.setAttribute('data-focus-id', 'choice-' + i);
      b.setAttribute('type', 'button');
      list.appendChild(b);
    });
    box.appendChild(list);
    overlay.appendChild(box);
    root.appendChild(overlay);
    FocusMgr.setScope(overlay);
    overlay.onclick = function (e) {
      var t = e.target.closest ? e.target.closest('[data-choice-idx]') : null;
      if (!t) return;
      var idx = parseInt(t.getAttribute('data-choice-idx'), 10);
      root.innerHTML = '';
      FocusMgr.clearScope();
      onPick(opts[idx].v);
    };
    FocusMgr.focusFirst();
  }
  function applySetting(key, val) {
    Store.setSetting(key, val);
    if (key === 'lang') {
      I18n.setLang(val);
      Store.setSetting('dir', val === 'ar' ? 'rtl' : 'ltr');
    }
    settingsState.flash = key;
  }
  function settingsCategoryBtn(cat) {
    var b = Util.el('button', 'settings-cat focusable' + (settingsState.cat === cat ? ' active' : ''), I18n.t(cat));
    b.setAttribute('data-focus-id', 'settings-cat-' + cat);
    b.setAttribute('data-action', 'set-cat');
    b.setAttribute('data-cat', cat);
    b.setAttribute('type', 'button');
    return b;
  }
  function renderSettingsCategory(panel) {
    panel.innerHTML = '';
    var s = Store.settings(), t = I18n.t, cat = settingsState.cat;
    var head = Util.el('div', 'row-title', t(cat));
    panel.appendChild(head);
    if (cat === 'languages') {
      panel.appendChild(Util.el('div', 'detail-sub', t('uiLanguageHint')));
      panel.appendChild(settingRow(t('uiLang'), 'lang', s.lang));
      panel.appendChild(Util.el('div', 'settings-sep'));
      panel.appendChild(settingRow(t('audioLang'), 'audioLang', s.audioLang));
      panel.appendChild(settingRow(t('enforceAudioLang'), 'enforceAudioLang', s.enforceAudioLang));
      panel.appendChild(Util.el('div', 'detail-sub', t('enforceAudioHint')));
      panel.appendChild(settingRow(t('subtitleLang'), 'subLang', s.subLang));
      panel.appendChild(settingRow(t('subtitleSize'), 'subSize', s.subSize));
      panel.appendChild(settingRow(t('subtitleColor'), 'subColor', s.subColor));
      panel.appendChild(Util.el('div', 'detail-sub', t('instantApply')));
    } else if (cat === 'playback') {
      panel.appendChild(settingRow(t('playerEngine'), 'playerEngine', s.playerEngine));
      panel.appendChild(settingRow(t('defaultQuality'), 'defaultQuality', s.defaultQuality));
      panel.appendChild(Util.el('div', 'detail-sub', 'AVPlay supports audio/subtitle track switching (required for multi-language streams). HTML5 is only a fallback.'));
    } else if (cat === 'addons') {
      var addonsHost = Util.el('div', 'addons-host');
      drawAddons(addonsHost);
      panel.appendChild(addonsHost);
      var addBtn = Util.el('button', 'btn focusable', '+ ' + t('addAddon'));
      addBtn.setAttribute('data-focus-id', 'set-add-addon');
      addBtn.setAttribute('data-action', 'set-add-addon');
      addBtn.setAttribute('type', 'button');
      panel.appendChild(addBtn);
      var kbHost = Util.el('div', 'kb-host hidden');
      panel.appendChild(kbHost);
      var subPreset = Util.el('button', 'btn focusable', '+ OpenSubtitles PRO (subtitles)');
      subPreset.setAttribute('data-focus-id', 'addons-preset-subs');
      subPreset.setAttribute('data-action', 'addons-preset-subs');
      subPreset.setAttribute('type', 'button');
      panel.appendChild(subPreset);
      var subTest = Util.el('button', 'btn focusable', 'Test subtitles');
      subTest.setAttribute('data-focus-id', 'addons-test-subs');
      subTest.setAttribute('data-action', 'addons-test-subs');
      subTest.setAttribute('type', 'button');
      panel.appendChild(subTest);
    } else if (cat === 'scrapers') {
      var allScr = Plugins.getScrapers(), repos = Plugins.getRepos();
      panel.appendChild(Util.el('div', 'detail-sub', repos.length + ' repositories · ' + allScr.length + ' scrapers installed'));
      var openPl = Util.el('button', 'btn btn-primary focusable', 'Open Plugin Manager');
      openPl.setAttribute('data-focus-id', 'set-open-plugins');
      openPl.setAttribute('data-action', 'plugins-open-test');
      openPl.setAttribute('type', 'button');
      panel.appendChild(openPl);
      panel.appendChild(Util.el('div', 'detail-sub', 'Scrapers, repositories and the single-provider test are managed in the Plugins tab with a remote-friendly list.'));
    } else if (cat === 'resolver') {
      panel.appendChild(settingRow(t('mode'), 'resolverMode', s.resolverMode));
      panel.appendChild(settingRow(t('adapter'), 'resolverAdapter', s.resolverAdapter));
      panel.appendChild(settingRow(t('serverUrl'), 'resolverBase', s.resolverBase, true));
      var testBtn = Util.el('button', 'btn focusable', t('testConnection'));
      testBtn.setAttribute('data-focus-id', 'set-test-resolver');
      testBtn.setAttribute('data-action', 'set-test-resolver');
      testBtn.setAttribute('type', 'button');
      panel.appendChild(testBtn);
      panel.appendChild(Util.el('span', 'test-out', ''));
      panel.appendChild(Util.el('div', 'kb-host hidden'));
    } else if (cat === 'profiles') {
      var profHost = Util.el('div', 'profiles-host');
      drawProfiles(profHost);
      panel.appendChild(profHost);
      panel.appendChild(Util.el('div', 'row-title', t('trakt')));
      var traktHost = Util.el('div', 'trakt-host');
      panel.appendChild(traktHost);
      if (window.Trakt && Trakt.render) Trakt.render(traktHost);
    } else if (cat === 'dataAbout') {
      var clearBtn = Util.el('button', 'btn focusable', t('clearCache'));
      clearBtn.setAttribute('data-focus-id', 'set-clear-cache'); clearBtn.setAttribute('data-action', 'set-clear-cache'); clearBtn.setAttribute('type', 'button');
      panel.appendChild(clearBtn);
      var clearAllBtn = Util.el('button', 'btn btn-danger focusable', t('clearData'));
      clearAllBtn.setAttribute('data-focus-id', 'set-clear-all'); clearAllBtn.setAttribute('data-action', 'set-clear-all'); clearAllBtn.setAttribute('type', 'button');
      panel.appendChild(clearAllBtn);
      panel.appendChild(Util.el('div', 'about', 'Nuvio Lite ' + t('version') + ' 1.0.19 · Tizen 3.0 (Chromium 47) · ES5'));
    }
    var focusKey = settingsState.flash;
    if (focusKey) {
      settingsState.flash = null;
      if (FocusMgr.focusById('set-' + focusKey)) return;
    }
    var first = panel.querySelector('.focusable');
    if (first) FocusMgr.setFocus(first); else FocusMgr.focusFirst();
  }
  function renderSettings() {
    currentView = 'settings';
    var app = appEl();
    app.innerHTML = '';
    app.appendChild(topBar('settings'));
    var main = Util.el('div', 'settings-main');
    main.appendChild(Util.el('div', 'detail-sub', I18n.t('categoryHint')));
    var layout = Util.el('div', 'settings-layout');
    var side = Util.el('div', 'settings-side');
    SETTINGS_CATS.forEach(function (cat) { side.appendChild(settingsCategoryBtn(cat)); });
    var panel = Util.el('div', 'settings-panel');
    panel.id = 'settings-panel';
    layout.appendChild(side);
    layout.appendChild(panel);
    main.appendChild(layout);
    app.appendChild(main);
    renderSettingsCategory(panel);
    FocusMgr.focusById('settings-cat-' + settingsState.cat) || FocusMgr.focusFirst();
  }
  function settingRow(label, key, value, isText) {
    var row = Util.el('div', 'setting-row');
    row.appendChild(Util.el('span', 'setting-label', label));
    if (isText) {
      var inp = Util.el('input', 'setting-input focusable');
      inp.setAttribute('data-focus-id', 'set-' + key);
      inp.setAttribute('data-action', 'set-text-' + key);
      inp.setAttribute('data-key', key);
      inp.value = value || '';
      inp.setAttribute('readonly', 'readonly');
      row.appendChild(inp);
      var open = Util.el('button', 'btn focusable', '⌨');
      open.setAttribute('data-focus-id', 'set-open-' + key);
      open.setAttribute('data-action', 'set-open-' + key);
      open.setAttribute('data-key', key);
      open.setAttribute('type', 'button');
      row.appendChild(open);
    } else {
      var btn = Util.el('button', 'setting-pick focusable', optionLabel(key, value) + '  ▾');
      btn.setAttribute('data-focus-id', 'set-' + key);
      btn.setAttribute('data-action', 'set-pick');
      btn.setAttribute('data-key', key);
      btn.setAttribute('type', 'button');
      row.appendChild(btn);
    }
    return row;
  }
  function drawAddons(host) {
    var fid = focusedId();
    host.innerHTML = '';
    var prof = Store.profile();
    prof.addons.forEach(function (addon, i) {
      var row = Util.el('div', 'addon-row');
      var name = (addon.manifest && addon.manifest.name) || addon.url;
      row.appendChild(Util.el('span', 'addon-name', name));
      row.appendChild(Util.el('span', 'addon-url', addon.url));
      var tog = Util.el('button', 'btn focusable', addon.enabled ? I18n.t('disable') : I18n.t('enable'));
      tog.setAttribute('data-focus-id', 'addon-tog-' + i);
      tog.setAttribute('data-action', 'addon-toggle');
      tog.setAttribute('data-idx', String(i));
      tog.setAttribute('type', 'button');
      row.appendChild(tog);
      var rem = Util.el('button', 'btn focusable', I18n.t('remove'));
      rem.setAttribute('data-focus-id', 'addon-rem-' + i);
      rem.setAttribute('data-action', 'addon-remove');
      rem.setAttribute('data-idx', String(i));
      rem.setAttribute('type', 'button');
      row.appendChild(rem);
      host.appendChild(row);
    });
    if (fid) FocusMgr.focusById(fid);
  }
  function addRepoAndRender(url) {
    url = (url || '').trim();
    if (!/^https?:\/\//i.test(url)) { toast('Enter a full https:// repo manifest URL'); return; }
    toast('Adding repo and downloading scrapers…');
    Plugins.addRepo(url, function (err, scrapers) {
      var reposHost = document.querySelector('.repos-host');
      var scrHost = document.querySelector('.scrapers-host');
      if (err) { toast('Repo failed: ' + err.message); return; }
      if (!scrapers || !scrapers.length) {
        Plugins.removeRepo(url);
        var pnl = document.getElementById('plugins-panel');
        if (pnl) renderPluginsCategory(pnl); else if (reposHost) drawRepos(reposHost);
        toast('That URL has no scrapers[] — use the repo manifest (e.g. the "Install" link), not a website manifest');
        return;
      }
      var panel = document.getElementById('plugins-panel');
      if (panel) {
        renderPluginsCategory(panel);
      } else {
        if (reposHost) drawRepos(reposHost);
        if (scrHost) drawScrapers(scrHost);
      }
      var failed = 0, i;
      for (i = 0; i < scrapers.length; i++) if (scrapers[i].error) failed++;
      toast('Added ' + scrapers.length + ' scrapers' + (failed ? ' (' + failed + ' need attention)' : ''));
      FocusMgr.focusFirst();
    });
  }
  function drawRepos(host) {
    host.innerHTML = '';
    var repos = Plugins.getRepos();
    if (!repos.length) host.appendChild(Util.el('div', 'detail-sub', 'No scraper repos. Add a manifest URL to discover scrapers (runs on-device; only load trusted repos).'));
    repos.forEach(function (u, i) {
      var row = Util.el('div', 'addon-row');
      row.appendChild(Util.el('span', 'addon-url', u));
      var rem = Util.el('button', 'btn focusable', I18n.t('remove'));
      rem.setAttribute('data-focus-id', 'repo-rem-' + i);
      rem.setAttribute('data-action', 'repo-remove');
      rem.setAttribute('data-url', u);
      rem.setAttribute('type', 'button');
      row.appendChild(rem);
      host.appendChild(row);
    });
  }
  function drawScrapers(host) {
    host.innerHTML = '';
    var list = Plugins.getScrapers();
    if (!list.length) host.appendChild(Util.el('div', 'detail-sub', 'No scrapers installed.'));
    list.forEach(function (s, i) {
      var row = Util.el('div', 'scraper-row');
      var label = s.id + ' · v' + (s.version || '') + ' · ' + ((s.supportedTypes || []).join(','));
      row.appendChild(Util.el('span', 'addon-name', label));
      if (s.error) row.appendChild(Util.el('span', 'note', 'provider ' + s.id + ' failed: ' + s.error));
      var tog = Util.el('button', 'btn focusable', s.enabled ? I18n.t('disable') : I18n.t('enable'));
      tog.setAttribute('data-focus-id', 'scr-tog-' + i);
      tog.setAttribute('data-action', 'scraper-toggle');
      tog.setAttribute('data-id', s.id);
      tog.setAttribute('type', 'button');
      row.appendChild(tog);
      var ref = Util.el('button', 'btn focusable', I18n.t('retry'));
      ref.setAttribute('data-focus-id', 'scr-ref-' + i);
      ref.setAttribute('data-action', 'scraper-refresh');
      ref.setAttribute('data-id', s.id);
      ref.setAttribute('type', 'button');
      row.appendChild(ref);
      var rem = Util.el('button', 'btn focusable', I18n.t('remove'));
      rem.setAttribute('data-focus-id', 'scr-rem-' + i);
      rem.setAttribute('data-action', 'scraper-remove');
      rem.setAttribute('data-id', s.id);
      rem.setAttribute('type', 'button');
      row.appendChild(rem);
      host.appendChild(row);
    });
  }

  /* ---------- PLUGIN TEST ---------- */
  var pluginTestState = { id: '', mediaType: 'movie', season: 1, episode: 1, provider: '' };
  var pluginsState = { cat: 'scrapers', filter: 'all', page: 0, flash: null };
  var PLUGIN_CATS = [
    { id: 'scrapers', label: 'Scrapers' },
    { id: 'repos', label: 'Repositories' },
    { id: 'test', label: 'Plugin Test' }
  ];
  function pluginCatBtn(c) {
    var b = Util.el('button', 'settings-cat focusable' + (pluginsState.cat === c.id ? ' active' : ''), c.label);
    b.setAttribute('data-focus-id', 'plugins-cat-' + c.id);
    b.setAttribute('data-action', 'plugins-cat');
    b.setAttribute('data-cat', c.id);
    b.setAttribute('type', 'button');
    return b;
  }
  function renderPluginTest() {
    currentView = 'plugins';
    var app = appEl();
    app.innerHTML = '';
    app.appendChild(topBar('plugins'));
    var main = Util.el('div', 'settings-main');
    main.appendChild(Util.el('div', 'detail-sub', 'Remote-friendly plugin manager · ↑/↓ category · → open · Enter actions'));
    var layout = Util.el('div', 'settings-layout');
    var side = Util.el('div', 'settings-side');
    PLUGIN_CATS.forEach(function (c) { side.appendChild(pluginCatBtn(c)); });
    var panel = Util.el('div', 'settings-panel');
    panel.id = 'plugins-panel';
    layout.appendChild(side); layout.appendChild(panel);
    main.appendChild(layout);
    app.appendChild(main);
    renderPluginsCategory(panel);
    FocusMgr.focusById('plugins-cat-' + pluginsState.cat) || FocusMgr.focusFirst();
  }
  function renderPluginsCategory(panel) {
    var fid = focusedId();
    panel.innerHTML = '';
    if (pluginsState.cat === 'repos') renderReposPanel(panel);
    else if (pluginsState.cat === 'test') renderPluginTestPanel(panel);
    else renderScrapersPanel(panel);
    var flash = pluginsState.flash; pluginsState.flash = null;
    if (flash && FocusMgr.focusById(flash)) return;
    if (fid && FocusMgr.focusById(fid)) return;
  }
  function renderReposPanel(panel) {
    panel.appendChild(Util.el('div', 'row-title', 'Repositories'));
    panel.appendChild(Util.el('div', 'detail-sub', 'Each repo manifest provides scrapers. Enter a repo for actions.'));
    var repos = Plugins.getRepos();
    if (!repos.length) panel.appendChild(Util.el('div', 'note', 'No repositories yet. Add one below.'));
    var host = Util.el('div', 'repos-host');
    repos.forEach(function (u, i) {
      var row = Util.el('button', 'scraper-item focusable');
      row.setAttribute('data-focus-id', 'repo-row-' + i);
      row.setAttribute('data-action', 'plugins-repo-open');
      row.setAttribute('data-url', u);
      row.setAttribute('type', 'button');
      row.appendChild(Util.el('span', 'scraper-name', u.replace(/^https?:\/\//, '').split('/')[0]));
      row.appendChild(Util.el('span', 'scraper-meta', u.length > 90 ? u.slice(0, 90) + '…' : u));
      row.appendChild(Util.el('span', 'scraper-arrow', '›'));
      host.appendChild(row);
    });
    panel.appendChild(host);
    var addRepoBtn = Util.el('button', 'btn focusable', '+ Add repo manifest URL');
    addRepoBtn.setAttribute('data-focus-id', 'pl-add-repo');
    addRepoBtn.setAttribute('data-action', 'plugins-add-repo');
    addRepoBtn.setAttribute('type', 'button');
    panel.appendChild(addRepoBtn);
    var repoKbHost = Util.el('div', 'kb-host hidden');
    repoKbHost.id = 'repo-kb-host';
    panel.appendChild(repoKbHost);
    panel.appendChild(Util.el('div', 'detail-sub', 'Quick add:'));
    PLUGIN_PRESETS.forEach(function (p, i) {
      var preset = Util.el('button', 'btn focusable', '+ ' + p.name);
      preset.setAttribute('data-focus-id', 'pl-preset-' + i);
      preset.setAttribute('data-action', 'plugins-preset');
      preset.setAttribute('data-url', p.url);
      preset.setAttribute('type', 'button');
      panel.appendChild(preset);
    });
    var first = panel.querySelector('.focusable');
    if (first) FocusMgr.setFocus(first); else FocusMgr.focusFirst();
  }
  function scraperStatus(s) {
    if (!s.enabled) return { cls: 'off', text: 'Disabled' };
    if (s.error) return { cls: 'err', text: s.error.replace(/^transform failed:\s*/, '').slice(0, 70) };
    return { cls: 'ok', text: 'Ready' };
  }
  function renderScrapersPanel(panel) {
    var all = Plugins.getScrapers();
    var enabled = all.filter(function (s) { return s.enabled; }).length;
    var failed = all.filter(function (s) { return s.error; }).length;
    panel.appendChild(Util.el('div', 'row-title', 'Scrapers'));
    panel.appendChild(Util.el('div', 'detail-sub', all.length + ' installed · ' + enabled + ' enabled · ' + failed + ' with errors'));
    // filters
    var filters = Util.el('div', 'plugin-filters');
    [ { v: 'all', l: 'All' }, { v: 'enabled', l: 'Enabled' }, { v: 'failed', l: 'Errors' } ].forEach(function (f, i) {
      var b = Util.el('button', 'filter-chip focusable' + (pluginsState.filter === f.v ? ' selected' : ''), f.l);
      b.setAttribute('data-focus-id', 'scr-filter-' + f.v);
      b.setAttribute('data-action', 'plugins-filter');
      b.setAttribute('data-filter', f.v);
      b.setAttribute('type', 'button');
      filters.appendChild(b);
    });
    panel.appendChild(filters);

    var list = all.filter(function (s) {
      if (pluginsState.filter === 'enabled') return s.enabled;
      if (pluginsState.filter === 'failed') return !!s.error;
      return true;
    });
    var PAGE = 8;
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (pluginsState.page >= pages) pluginsState.page = pages - 1;
    if (pluginsState.page < 0) pluginsState.page = 0;
    var slice = list.slice(pluginsState.page * PAGE, pluginsState.page * PAGE + PAGE);
    var host = Util.el('div', 'scrapers-host');
    if (!slice.length) host.appendChild(Util.el('div', 'note', all.length ? 'No scrapers match this filter.' : 'No scrapers installed. Add a repository first.'));
    slice.forEach(function (s, i) {
      var st = scraperStatus(s);
      var row = Util.el('button', 'scraper-item focusable');
      row.setAttribute('data-focus-id', 'scr-row-' + i);
      row.setAttribute('data-action', 'plugins-scraper-open');
      row.setAttribute('data-id', s.id);
      row.setAttribute('type', 'button');
      var left = Util.el('div', 'scraper-main');
      left.appendChild(Util.el('span', 'scraper-name', s.id));
      var meta = [(s.supportedTypes || []).join('/'), s.version ? 'v' + s.version : '', st.text].filter(Boolean).join(' · ');
      left.appendChild(Util.el('span', 'scraper-meta', meta));
      row.appendChild(left);
      row.appendChild(Util.el('span', 'scraper-status ' + st.cls, st.cls === 'ok' ? '●' : (st.cls === 'err' ? '!' : '–')));
      row.appendChild(Util.el('span', 'scraper-arrow', '›'));
      host.appendChild(row);
    });
    panel.appendChild(host);
    if (pages > 1) {
      var pager = Util.el('div', 'plugin-pager');
      var prev = Util.el('button', 'btn focusable', '‹ Prev');
      prev.setAttribute('data-focus-id', 'scr-prev');
      prev.setAttribute('data-action', 'plugins-page');
      prev.setAttribute('data-delta', '-1');
      prev.setAttribute('type', 'button');
      var lab = Util.el('span', 'pager-label', 'Page ' + (pluginsState.page + 1) + ' / ' + pages);
      var next = Util.el('button', 'btn focusable', 'Next ›');
      next.setAttribute('data-focus-id', 'scr-next');
      next.setAttribute('data-action', 'plugins-page');
      next.setAttribute('data-delta', '1');
      next.setAttribute('type', 'button');
      pager.appendChild(prev); pager.appendChild(lab); pager.appendChild(next);
      panel.appendChild(pager);
    }
    var first = panel.querySelector('.focusable');
    if (first) FocusMgr.setFocus(first); else FocusMgr.focusFirst();
  }
  function renderPluginTestPanel(panel) {
    var scrapers = Plugins.getScrapers();
    panel.appendChild(Util.el('div', 'row-title', 'Plugin Test'));
    panel.appendChild(Util.el('div', 'detail-sub', 'Run one provider with a numeric TMDB id and inspect results, timing and errors.'));
    var form = Util.el('div', 'pt-form');
    function pickRow(label, value, action, key) {
      var row = Util.el('div', 'setting-row');
      row.appendChild(Util.el('span', 'setting-label', label));
      var b = Util.el('button', 'setting-pick focusable', value + '  ▾');
      b.setAttribute('data-focus-id', key);
      b.setAttribute('data-action', action);
      b.setAttribute('type', 'button');
      row.appendChild(b);
      form.appendChild(row);
    }
    pickRow('TMDB ID', pluginTestState.id || 'not set', 'plugins-edit-id', 'pt-edit-id');
    pickRow('Type', pluginTestState.mediaType, 'pt-pick-type', 'pt-pick-type');
    pickRow('Season', 'S' + pluginTestState.season, 'pt-pick-season', 'pt-pick-season');
    pickRow('Episode', 'E' + pluginTestState.episode, 'pt-pick-episode', 'pt-pick-episode');
    pickRow('Provider', pluginTestState.provider || (scrapers[0] ? scrapers[0].id : 'none'), 'pt-pick-provider', 'pt-pick-provider');
    if (!pluginTestState.provider && scrapers.length) pluginTestState.provider = scrapers[0].id;
    var runBtn = Util.el('button', 'btn btn-primary focusable', 'Run provider');
    runBtn.setAttribute('data-focus-id', 'pt-run');
    runBtn.setAttribute('data-action', 'pt-run');
    runBtn.setAttribute('type', 'button');
    form.appendChild(runBtn);
    panel.appendChild(form);
    var kbHost = Util.el('div', 'kb-host hidden');
    kbHost.id = 'plugin-kb-host';
    panel.appendChild(kbHost);
    var out = Util.el('pre', 'pt-out', scrapers.length ? 'Result / error will appear here.' : 'No scrapers installed — add a repository first.');
    out.id = 'pt-out';
    panel.appendChild(out);
    var first = panel.querySelector('.focusable');
    if (first) FocusMgr.setFocus(first); else FocusMgr.focusFirst();
  }
  function runPluginTest() {
    var out = document.getElementById('pt-out');
    var installed = Plugins.getScrapers();
    if (!installed.length) {
      if (out) out.textContent = 'No scrapers installed. Open Repositories and add a manifest URL first.';
      return;
    }
    var id = pluginTestState.id || '';
    var provider = pluginTestState.provider || '';
    if (!id) { if (out) out.textContent = 'Press "TMDB ID" and enter a number (e.g. 550 = Fight Club).'; return; }
    if (!/^\d+$/.test(id)) { if (out) out.textContent = 'TMDB IDs are numbers (e.g. 550). "' + id + '" is not numeric — these scrapers do not use IMDb tt IDs.'; return; }
    if (!provider) { if (out) out.textContent = 'Choose a provider.'; return; }
    if (out) out.textContent = 'Running provider ' + provider + ' …';
    Plugins.runPlugin(provider, {
      tmdbId: id, id: id, mediaType: pluginTestState.mediaType || 'movie',
      season: pluginTestState.season || 1, episode: pluginTestState.episode || 1
    }).then(function (res) {
      var o = document.getElementById('pt-out');
      if (!o) return;
      var lines = [];
      lines.push('provider: ' + provider);
      lines.push('ok: ' + res.ok);
      lines.push('ms: ' + res.ms);
      if (res.error) lines.push('error: provider ' + provider + ' failed: ' + res.error);
      lines.push('results: ' + res.results.length);
      try { lines.push('raw: ' + JSON.stringify(res.raw, null, 2).slice(0, 2000)); } catch (e) { lines.push('raw: <unserializable>'); }
      if (res.logs && res.logs.length) lines.push('logs:\n' + res.logs.join('\n').slice(0, 1000));
      o.textContent = lines.join('\n');
      ViewsToast(res.ok ? 'Provider OK: ' + res.results.length + ' results' : 'provider ' + provider + ' failed: ' + res.error);
    });
  }
  function ViewsToast(msg) { toast(msg); }

  function drawProfiles(host) {
    host.innerHTML = '';
    var names = Store.profileNames();
    names.forEach(function (id) {
      var p = Store.state().profiles[id];
      var row = Util.el('div', 'profile-row');
      row.appendChild(Util.el('span', 'profile-name', (p.name || id) + (id === Store.state().currentProfile ? ' ✓' : '')));
      if (id !== Store.state().currentProfile) {
        var sw = Util.el('button', 'btn focusable', I18n.t('selected'));
        sw.setAttribute('data-focus-id', 'prof-sw-' + id);
        sw.setAttribute('data-action', 'profile-switch');
        sw.setAttribute('data-id', id);
        sw.setAttribute('type', 'button');
        row.appendChild(sw);
      }
      host.appendChild(row);
    });
    if (names.length < 4) {
      var nb = Util.el('button', 'btn focusable', '+ ' + I18n.t('newProfile'));
      nb.setAttribute('data-focus-id', 'prof-new');
      nb.setAttribute('data-action', 'profile-new');
      nb.setAttribute('type', 'button');
      host.appendChild(nb);
    }
  }

  /* ---------- action handling ---------- */
  var extraHandlers = {};
  function onAction(action, el) {
    var t = I18n.t;
    if (action.indexOf('nav-') === 0) {
      var dest = action.slice(4);
      FocusMgr.saveFocus(currentView);
      if (dest === 'home') renderHome();
      else if (dest === 'search') renderSearch();
      else if (dest === 'library') renderLibrary();
      else if (dest === 'plugins') renderPluginTest();
      else if (dest === 'settings') renderSettings();
      return true;
    }
    if (action === 'retry' && el && el.parentNode && el.parentNode._retry) { el.parentNode._retry(); return true; }
    if (action === 'open-detail') {
      FocusMgr.saveFocus(currentView);
      renderDetail(el.getAttribute('data-type'), el.getAttribute('data-id'));
      return true;
    }
    if (action === 'row-more') {
      var row = el.closest ? el.closest('.row') : null;
      if (row && row.getAttribute('data-catalog')) {
        try {
          var ctx = JSON.parse(row.getAttribute('data-catalog'));
          var prof = Store.profile();
          var addon = prof.addons[ctx.ai];
          var list = row.querySelector('.row-list');
          if (addon) Api.getCatalog(addon, ctx.type, ctx.id, { skip: ctx.skip }, function (err, metas) {
            if (!err && metas && metas.length) {
              var base = ctx.skip;
              metas.slice(0, 40).forEach(function (m, i) { list.insertBefore(posterCard(m, base + i, el.getAttribute('data-row')), el); });
              ctx.skip += metas.length;
              row.setAttribute('data-catalog', JSON.stringify(ctx));
            }
          });
        } catch (e) {}
      }
      return true;
    }
    if (action === 'detail-play') {
      var m = detailState.meta;
      var key = m.type + ':' + m.id;
      var hist = Store.profile().history[key];
      var vid = m.id;
      // for series, if episode selected via ep row it plays directly; play button plays first/next unwatched
      if (m.type === 'series' && m.videos && m.videos.length) {
        var ep = m.videos.filter(function (v) { return v.season === detailState.season; }).sort(function (a, b) { return (a.episode || 0) - (b.episode || 0); })[0];
        if (ep) vid = ep.id;
      }
      renderStreams(m.type, m.id, vid, m);
      return true;
    }
    if (action === 'detail-episode') {
      var vid2 = el.getAttribute('data-video-id');
      var m2 = detailState.meta;
      renderStreams(m2.type, m2.id, vid2, m2);
      return true;
    }
    if (action === 'detail-watched') {
      var m3 = detailState.meta;
      var k = m3.type + ':' + m3.id;
      var prof3 = Store.profile();
      if (prof3.watched[k]) delete prof3.watched[k]; else prof3.watched[k] = true;
      Store.save(); drawDetail(document.querySelector('.detail-main'), m3);
      return true;
    }
    if (action === 'detail-lib') {
      var m4 = detailState.meta;
      var prof4 = Store.profile();
      var found = -1, i;
      for (i = 0; i < prof4.library.length; i++) if (prof4.library[i].type === m4.type && prof4.library[i].id === m4.id) found = i;
      if (found >= 0) prof4.library.splice(found, 1);
      else prof4.library.push({ type: m4.type, id: m4.id, title: m4.name || m4.title || m4.id, poster: m4.poster || '', addedAt: Date.now() });
      Store.save(); drawDetail(document.querySelector('.detail-main'), m4);
      return true;
    }
    if (action === 'detail-season') {
      var seasonNum = parseInt(el.getAttribute('data-season'), 10) || 1;
      detailState.season = seasonNum;
      var chips = document.querySelectorAll('.season-chip');
      for (var sc = 0; sc < chips.length; sc++) {
        if (parseInt(chips[sc].getAttribute('data-season'), 10) === seasonNum) chips[sc].classList.add('selected');
        else chips[sc].classList.remove('selected');
      }
      var epHost = document.querySelector('.ep-list');
      if (epHost && detailState.meta) drawEpisodes(epHost, detailState.meta, seasonNum);
      return true;
    }
    if (action === 'streams-toggle-langs') {
      streamState.langMode = (streamState.langMode === 'only') ? 'all' : 'only';
      var slist = document.getElementById('streams-list');
      if (slist) {
        if (audioFilterActive()) slist.className = 'streams-list hide-other-langs';
        else slist.className = 'streams-list';
      }
      refreshStreamsMeta();
      return true;
    }
    if (action === 'play-stream') {
      var url = el.getAttribute('data-url');
      var m5 = streamState.meta || detailState.meta || { type: streamState.type, id: streamState.id, name: streamState.id };
      var info = Util.parseStreamInfo(el.textContent);
      if (info.quality) Store.setSetting('lastQuality', info.quality);
      var headers = {};
      try { headers = JSON.parse(el.getAttribute('data-headers') || '{}'); } catch (e) {}
      Player.play({ url: url, type: streamState.type, id: streamState.id, videoId: streamState.videoId, title: (m5.name || m5.title || streamState.id), poster: m5.poster || '', headers: headers });
      var note = Player.getHeadersNote && Player.getHeadersNote();
      if (note) toast(note);
      return true;
    }
    if (action === 'plugins-cat') {
      pluginsState.cat = el.getAttribute('data-cat');
      var pcats = document.querySelectorAll('.settings-cat');
      for (var pci = 0; pci < pcats.length; pci++) {
        if (pcats[pci].getAttribute('data-cat') === pluginsState.cat) pcats[pci].classList.add('active');
        else pcats[pci].classList.remove('active');
      }
      renderPluginsCategory(document.getElementById('plugins-panel'));
      return true;
    }
    if (action === 'plugins-filter') {
      pluginsState.filter = el.getAttribute('data-filter');
      pluginsState.page = 0;
      renderPluginsCategory(document.getElementById('plugins-panel'));
      return true;
    }
    if (action === 'plugins-page') {
      pluginsState.page += parseInt(el.getAttribute('data-delta'), 10) || 0;
      renderPluginsCategory(document.getElementById('plugins-panel'));
      return true;
    }
    if (action === 'plugins-scraper-open') {
      var rowFid = el.getAttribute('data-focus-id');
      var sid = el.getAttribute('data-id'), targetScr = null, sl = Plugins.getScrapers(), si2;
      for (si2 = 0; si2 < sl.length; si2++) if (sl[si2].id === sid) targetScr = sl[si2];
      if (!targetScr) return true;
      var scrChoices = [
        { v: 'toggle', l: targetScr.enabled ? 'Disable' : 'Enable' },
        { v: 'retry', l: 'Re-download / re-transform' },
        { v: 'test', l: 'Test this provider' },
        { v: 'remove', l: 'Remove scraper' }
      ];
      showChoice(sid, scrChoices, null, function (pick) {
        if (pick === 'toggle') Plugins.setEnabled(sid, !targetScr.enabled);
        else if (pick === 'retry') {
          Plugins.refreshScraper(sid, function (err) { toast(err ? ('Retry failed: ' + err.message) : 'Re-downloaded ' + sid); });
        } else if (pick === 'test') {
          pluginTestState.provider = sid;
          pluginsState.cat = 'test';
          renderPluginTest();
          return;
        } else if (pick === 'remove') {
          Plugins.removeScraper(sid);
        }
        if (rowFid) pluginsState.flash = rowFid;
        renderPluginsCategory(document.getElementById('plugins-panel'));
      });
      return true;
    }
    if (action === 'plugins-repo-open') {
      var repoFid = el.getAttribute('data-focus-id');
      var rurl = el.getAttribute('data-url');
      showChoice(rurl.split('/')[2] || 'Repository', [
        { v: 'refresh', l: 'Re-install scrapers from repo' },
        { v: 'remove', l: 'Remove repository' }
      ], null, function (pick) {
        if (pick === 'remove') {
          Plugins.removeRepo(rurl);
          if (repoFid) pluginsState.flash = repoFid;
          renderPluginsCategory(document.getElementById('plugins-panel'));
        } else {
          toast('Refreshing repo…');
          Plugins.addRepo(rurl, function (err) {
            toast(err ? ('Refresh failed: ' + err.message) : 'Repo refreshed');
            if (repoFid) pluginsState.flash = repoFid;
            renderPluginsCategory(document.getElementById('plugins-panel'));
          });
        }
      });
      return true;
    }
    if (action === 'plugins-edit-id') {
      var idHost = document.getElementById('plugin-kb-host');
      if (idHost) {
        idHost.classList.remove('hidden');
        Kb.render(idHost, {
          initial: pluginTestState.id || '', idPrefix: 'pt-kb',
          onInput: function (v) { pluginTestState.id = v; },
          onDone: function (v) {
            pluginTestState.id = v;
            idHost.classList.add('hidden');
            renderPluginsCategory(document.getElementById('plugins-panel'));
          }
        });
        FocusMgr.focusById('pt-kb-display') || FocusMgr.focusFirst();
      }
      return true;
    }
    if (action === 'pt-pick-type') {
      showChoice('Type', [ { v: 'movie', l: 'Movie' }, { v: 'tv', l: 'TV / Series' } ], pluginTestState.mediaType, function (v) {
        pluginTestState.mediaType = v;
        pluginsState.flash = 'pt-pick-type';
        renderPluginsCategory(document.getElementById('plugins-panel'));
      });
      return true;
    }
    if (action === 'pt-pick-season') {
      var seasonOpts = [];
      for (var sN = 0; sN <= 20; sN++) seasonOpts.push({ v: String(sN), l: sN === 0 ? 'S0 (Specials)' : ('Season ' + sN) });
      showChoice('Season', seasonOpts, String(pluginTestState.season), function (v) {
        pluginTestState.season = parseInt(v, 10) || 0;
        pluginsState.flash = 'pt-pick-season';
        renderPluginsCategory(document.getElementById('plugins-panel'));
      });
      return true;
    }
    if (action === 'pt-pick-episode') {
      var epOpts = [];
      for (var eN = 1; eN <= 30; eN++) epOpts.push({ v: String(eN), l: 'Episode ' + eN });
      showChoice('Episode', epOpts, String(pluginTestState.episode), function (v) {
        pluginTestState.episode = parseInt(v, 10) || 1;
        pluginsState.flash = 'pt-pick-episode';
        renderPluginsCategory(document.getElementById('plugins-panel'));
      });
      return true;
    }
    if (action === 'pt-pick-provider') {
      var provOpts = Plugins.getScrapers().map(function (s) { return { v: s.id, l: s.id + (s.enabled ? '' : ' (disabled)') }; });
      if (!provOpts.length) { toast('No scrapers installed'); return true; }
      showChoice('Provider', provOpts, pluginTestState.provider, function (v) {
        pluginTestState.provider = v;
        pluginsState.flash = 'pt-pick-provider';
        renderPluginsCategory(document.getElementById('plugins-panel'));
      });
      return true;
    }
    if (action === 'plugins-add-repo' || action === 'plugins-preset') {
      var host = document.getElementById('repo-kb-host');
      if (action === 'plugins-preset') {
        addRepoAndRender(el.getAttribute('data-url'));
        return true;
      }
      if (host) {
        host.classList.remove('hidden');
        Kb.render(host, {
          initial: 'https://', idPrefix: 'repo-kb', url: true, onInput: function () {},
          onDone: function (url) {
            host.classList.add('hidden');
            addRepoAndRender(url);
          }
        });
        FocusMgr.focusById('repo-kb-display') || FocusMgr.focusFirst();
      }
      return true;
    }
    if (action === 'repo-remove') {
      Plugins.removeRepo(el.getAttribute('data-url'));
      drawRepos(document.querySelector('.repos-host'));
      FocusMgr.focusFirst();
      return true;
    }
    if (action === 'scraper-toggle') {
      var sid = el.getAttribute('data-id');
      var list = Plugins.getScrapers(), target = null, i;
      for (i = 0; i < list.length; i++) if (list[i].id === sid) target = list[i];
      if (target) { Plugins.setEnabled(sid, !target.enabled); drawScrapers(document.querySelector('.scrapers-host')); FocusMgr.focusFirst(); }
      return true;
    }
    if (action === 'scraper-remove') {
      Plugins.removeScraper(el.getAttribute('data-id'));
      drawScrapers(document.querySelector('.scrapers-host'));
      FocusMgr.focusFirst();
      return true;
    }
    if (action === 'scraper-refresh') {
      Plugins.refreshScraper(el.getAttribute('data-id'), function (err) {
        if (err) toast('provider refresh failed: ' + err.message);
        drawScrapers(document.querySelector('.scrapers-host'));
        FocusMgr.focusFirst();
      });
      return true;
    }
    if (action === 'plugins-open-test') { FocusMgr.saveFocus(currentView); renderPluginTest(); return true; }
    if (action === 'pt-run') { runPluginTest(); return true; }
    if (action === 'addons-preset-subs' || action === 'addons-test-subs') {
      var prof0 = Store.profile(), target = null, i0;
      for (i0 = 0; i0 < prof0.addons.length; i0++) if (prof0.addons[i0].url === SUB_ADDON_URL) target = prof0.addons[i0];
      if (action === 'addons-preset-subs') {
        if (!target) {
          target = { url: SUB_ADDON_URL, enabled: true, manifest: null, addedAt: Date.now() };
          prof0.addons.push(target); Store.save();
        }
        Api.loadManifest(target, function (err) {
          if (err) { toast('Subtitle addon failed: ' + err.message); return; }
          drawAddons(document.querySelector('.addons-host'));
          toast('Subtitle addon added');
        });
        return true;
      }
      if (!target) { toast('Add the subtitle addon first'); return true; }
      toast('Testing subtitles…');
      Api.getSubtitles(target, 'movie', 'tt0133093', function (err, subs) {
        if (err) { toast('Subtitle test failed: ' + err.message); return; }
        toast('Subtitles OK — ' + (subs ? subs.length : 0) + ' found');
      });
      return true;
    }
    if (action === 'set-add-addon') {
      var host = document.querySelector('.kb-host');
      if (host) {
        host.classList.remove('hidden');
        Kb.render(host, {
          initial: 'https://', idPrefix: 'set-kb', url: true,
          onInput: function () {},
          onDone: function (url) {
            host.classList.add('hidden');
            url = (url || '').trim();
            if (!/^https?:\/\//i.test(url)) { toast(I18n.t('invalidUrl')); return; }
            if (url.indexOf('/manifest.json') === -1) url = url.replace(/\/$/, '') + '/manifest.json';
            var prof5 = Store.profile();
            var exists = prof5.addons.some(function (a) { return a.url === url; });
            if (exists) { toast(I18n.t('alreadyAdded')); return; }
            var addon = { url: url, enabled: true, manifest: null, addedAt: Date.now() };
            prof5.addons.push(addon); Store.save();
            Api.loadManifest(addon, function (err) {
              if (err) { toast(I18n.t('errorAddon')); }
              drawAddons(document.querySelector('.addons-host'));
              FocusMgr.focusFirst();
            });
          }
        });
        FocusMgr.focusFirst();
      }
      return true;
    }
    if (action === 'addon-toggle') {
      var idx2 = parseInt(el.getAttribute('data-idx'), 10);
      var a2 = Store.profile().addons[idx2];
      if (a2) { a2.enabled = !a2.enabled; Store.save(); drawAddons(document.querySelector('.addons-host')); FocusMgr.focusFirst(); }
      return true;
    }
    if (action === 'addon-remove') {
      var idx3 = parseInt(el.getAttribute('data-idx'), 10);
      Store.profile().addons.splice(idx3, 1); Store.save();
      drawAddons(document.querySelector('.addons-host')); FocusMgr.focusFirst();
      return true;
    }
    if (action === 'set-cat') {
      settingsState.cat = el.getAttribute('data-cat');
      var cats = document.querySelectorAll('.settings-cat');
      for (var ci = 0; ci < cats.length; ci++) {
        if (cats[ci].getAttribute('data-cat') === settingsState.cat) cats[ci].classList.add('active');
        else cats[ci].classList.remove('active');
      }
      renderSettingsCategory(document.getElementById('settings-panel'));
      FocusMgr.focusById('settings-cat-' + settingsState.cat);
      return true;
    }
    if (action === 'set-pick') {
      var pkey = el.getAttribute('data-key');
      var labelEl = el.parentNode ? el.parentNode.querySelector('.setting-label') : null;
      var title = labelEl ? labelEl.textContent : I18n.t('choose');
      showChoice(title, optionsFor(pkey), Store.settings()[pkey], function (v) {
        applySetting(pkey, v);
        settingsState.flash = pkey;
        if (pkey === 'lang') renderSettings();
        else renderSettingsCategory(document.getElementById('settings-panel'));
      });
      return true;
    }
    if (action.indexOf('set-open-') === 0) {
      var key2 = el.getAttribute('data-key');
      var host2 = document.querySelector('.kb-host');
      if (host2) {
        host2.classList.remove('hidden');
        Kb.render(host2, {
          initial: Store.settings()[key2] || (key2 === 'resolverBase' ? 'http://' : ''), idPrefix: 'set-kb2',
          url: key2 === 'resolverBase',
          onInput: function () {},
          onDone: function (v) { Store.setSetting(key2, v); renderSettings(); }
        });
        FocusMgr.focusFirst();
      }
      return true;
    }
    if (action.indexOf('set-text-') === 0) { /* readonly, open keyboard via sibling */ return true; }
    if (action === 'set-test-resolver') {
      var out = el._out || document.querySelector('.test-out');
      if (out) out.textContent = I18n.t('loading');
      Resolver.testConnection(function (err, status) {
        var o = el._out || document.querySelector('.test-out');
        if (o) o.textContent = err ? (I18n.t('unreachable') + ' (' + err.message + ')') : (I18n.t('connected') + ' ' + (status || ''));
      });
      return true;
    }
    if (action === 'set-clear-cache') { Store.clearCache(); toast(I18n.t('clearCache')); return true; }
    if (action === 'set-clear-all') {
      showDialog(I18n.t('clearData'), '', [ { label: I18n.t('yes') }, { label: I18n.t('no') } ], function (idx) {
        if (idx === 0) { Store.clearAll(); I18n.setLang(Store.settings().lang); renderHome(); }
      });
      return true;
    }
    if (action === 'profile-switch') {
      var pid = el.getAttribute('data-id');
      Store.switchProfile(pid); I18n.applyDir(); renderHome();
      return true;
    }
    if (action === 'profile-new') {
      var id = 'P' + (Store.profileNames().length + 1) + '_' + Date.now().toString(36);
      if (Store.createProfile(id, 'Profile ' + (Store.profileNames().length + 1))) { Store.switchProfile(id); renderHome(); }
      else toast(I18n.t('noResults'));
      return true;
    }
    if (extraHandlers[action]) return extraHandlers[action](el);
    return false;
  }

  function handleSelectChange(el) {
    var action = el.getAttribute('data-action') || '';
    var key = el.getAttribute('data-key');
    if (action === 'detail-season') {
      detailState.season = parseInt(el.value, 10) || 1;
      var host = document.querySelector('.ep-list');
      if (host && detailState.meta) drawEpisodes(host, detailState.meta, detailState.season);
      return true;
    }
    if (action.indexOf('set-select-') === 0 && key) {
      Store.setSetting(key, el.value);
      if (key === 'lang') I18n.setLang(el.value);
      if (key === 'resolverMode' || key === 'resolverAdapter') renderSettings();
      return true;
    }
    if (action === 'pt-type') { pluginTestState.mediaType = el.value; return true; }
    if (action === 'pt-season') { pluginTestState.season = parseInt(el.value, 10) || 1; return true; }
    if (action === 'pt-episode') { pluginTestState.episode = parseInt(el.value, 10) || 1; return true; }
    if (action === 'pt-provider') { pluginTestState.provider = el.value; return true; }
    return false;
  }
  // delegate clicks (desktop dev mode)
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('.focusable') : null;
    if (!t) return;
    FocusMgr.setFocus(t);
    var action = t.getAttribute('data-action');
    if (action && Kb.handleAction && Kb.handleAction(action, t)) return;
    if (action) onAction(action, t);
  });
  document.addEventListener('change', function (e) {
    if (e.target.tagName === 'SELECT') handleSelectChange(e.target);
  });

  function setExtraHandler(name, fn) { extraHandlers[name] = fn; }
  function getDetail() { return detailState; }
  function getStream() { return streamState; }
  return {
    renderHome: renderHome, renderDetail: renderDetail, renderSearch: renderSearch,
    renderLibrary: renderLibrary, renderSettings: renderSettings, renderStreams: renderStreams,
    renderPluginTest: renderPluginTest,
    showDialog: showDialog, closeDialog: closeDialog, toast: toast, onAction: onAction,
    setExtraHandler: setExtraHandler, getDetail: getDetail, getStream: getStream
  };
})();
