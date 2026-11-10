/* Stremio addon protocol client */
var Api = (function () {
  'use strict';
  var TIMEOUT = 8000;
  function baseOf(manifestUrl) {
    // manifestUrl like https://host/manifest.json -> https://host
    var u = String(manifestUrl || '');
    if (u.slice(-'/manifest.json'.length) === '/manifest.json') return u.slice(0, -'/manifest.json'.length);
    return u.replace(/\/$/, '');
  }
  function hasResource(manifest, name) {
    if (!manifest) return false;
    var r = manifest.resources;
    if (!r) return false;
    if (typeof r === 'string') return r === name;
    if (Array.isArray(r)) return r.indexOf(name) !== -1;
    if (typeof r === 'object') return !!r[name];
    return false;
  }
  // Load + cache manifest
  function loadManifest(addon, cb) {
    var url = addon.url;
    if (!/^https?:\/\//i.test(url)) return cb(new Error('invalid-url'));
    if (url.indexOf('/manifest.json') === -1) url = url.replace(/\/$/, '') + '/manifest.json';
    Http.getJson(url, TIMEOUT, function (err, json) {
      if (err) return cb(err);
      addon.manifest = json;
      addon.base = baseOf(url);
      Store.save();
      cb(null, json);
    });
  }
  function ensureManifest(addon, cb) {
    if (addon.manifest && addon.base) return cb(null, addon.manifest);
    loadManifest(addon, cb);
  }
  function catalogUrl(addon, type, id, extra) {
    var path = '/catalog/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + '.json';
    if (extra) {
      var keys = Object.keys(extra), query = '';
      for (var i = 0; i < keys.length; i++) {
        if (extra[keys[i]] != null && extra[keys[i]] !== '') query += (query ? '&' : '') + encodeURIComponent(keys[i]) + '=' + encodeURIComponent(extra[keys[i]]);
      }
      // Stremio extra style: /catalog/{type}/{id}/{extra}.json ; we use query form also supported by many addons,
      // but canonical is path segment: /catalog/movie/top/search=query.json
      // Build canonical path form when extra present:
      var seg = '';
      for (var j = 0; j < keys.length; j++) {
        if (extra[keys[j]] != null && extra[keys[j]] !== '') seg += '/' + encodeURIComponent(keys[j]) + '=' + encodeURIComponent(extra[keys[j]]);
      }
      if (seg) path = '/catalog/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + seg + '.json';
    }
    return addon.base + path;
  }
  function getCatalog(addon, type, id, extra, cb) {
    ensureManifest(addon, function (err) {
      if (err) return cb(err);
      if (!hasResource(addon.manifest, 'catalog')) return cb(new Error('no-catalog-resource'));
      Http.getJson(catalogUrl(addon, type, id, extra), TIMEOUT, function (e2, json) {
        if (e2) return cb(e2);
        cb(null, (json && json.metas) || []);
      });
    });
  }
  function getMeta(addon, type, id, cb) {
    ensureManifest(addon, function (err) {
      if (err) return cb(err);
      if (!hasResource(addon.manifest, 'meta')) return cb(new Error('no-meta-resource'));
      Http.getJson(addon.base + '/meta/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + '.json', TIMEOUT, function (e2, json) {
        if (e2) return cb(e2);
        cb(null, (json && json.meta) || null);
      });
    });
  }
  function getStreams(addon, type, id, cb) {
    ensureManifest(addon, function (err) {
      if (err) return cb(err);
      if (!hasResource(addon.manifest, 'stream')) return cb(new Error('no-stream-resource'));
      Http.getJson(addon.base + '/stream/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + '.json', TIMEOUT, function (e2, json) {
        if (e2) return cb(e2);
        cb(null, (json && json.streams) || []);
      });
    });
  }
  function getSubtitles(addon, type, id, cb) {
    ensureManifest(addon, function (err) {
      if (err) return cb(err);
      if (!hasResource(addon.manifest, 'subtitles')) return cb(new Error('no-subtitles-resource'));
      Http.getJson(addon.base + '/subtitles/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + '.json', TIMEOUT, function (e2, json) {
        if (e2) return cb(e2);
        cb(null, (json && json.subtitles) || []);
      });
    });
  }
  // Aggregate streams from enabled addons that actually expose the `stream` resource.
  // onEach(group) as results arrive; onDone(results, supported) where supported tells
  // whether any installed addon supports streams (so callers can distinguish
  // "no stream addon installed" from "network/all addons failed").
  function aggregateStreams(type, id, onEach, onDone) {
    var prof = Store.profile();
    var addons = prof.addons.filter(function (a) { return a.enabled; });
    var pending = addons.length, supported = 0, results = [];
    if (!pending) { onDone(results, false); return; }
    addons.forEach(function (addon) {
      ensureManifest(addon, function (err) {
        if (err || !addon.manifest || !hasResource(addon.manifest, 'stream')) {
          pending--;
          if (pending === 0) onDone(results, supported > 0);
          return;
        }
        supported++;
        getStreams(addon, type, id, function (e2, streams) {
          pending--;
          if (!e2 && streams && streams.length) {
            var group = { addon: addon, streams: streams };
            results.push(group);
            onEach(group);
          }
          if (pending === 0) onDone(results, supported > 0);
        });
      });
    });
  }
  // Search across catalog addons that support the 'search' extra.
  // Counts individual catalog requests (not addons) so addons with both
  // movie and series search catalogs are handled correctly.
  function searchAll(query, cb) {
    var addons = enabledAddons();
    var out = { movie: [], series: [] };
    var pending = 1, finished = false;

    function finalize() {
      var clean = { movie: [], series: [] };
      ['movie', 'series'].forEach(function (ty) {
        var seen = {}, list = out[ty] || [];
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (!m || !m.id || seen[m.id]) continue;
          seen[m.id] = 1;
          clean[ty].push(m);
        }
      });
      return clean;
    }
    function done() {
      if (finished) return;
      pending--;
      if (pending > 0) return;
      finished = true;
      cb(null, finalize());
    }
    if (!addons.length) { cb(null, out); return; }
    addons.forEach(function (addon) {
      pending++;
      ensureManifest(addon, function (err) {
        if (!err && addon.manifest) {
          var cats = addon.manifest.catalogs || [], byType = {};
          for (var ci = 0; ci < cats.length; ci++) {
            var c = cats[ci];
            if (c.type !== 'movie' && c.type !== 'series') continue;
            var extras = c.extraSupported || (c.extra || []).map(function (e) { return e.name; });
            if (extras.indexOf('search') === -1) continue;
            if (!byType[c.type]) byType[c.type] = c;
          }
          Object.keys(byType).forEach(function (ty) {
            pending++;
            getCatalog(addon, ty, byType[ty].id, { search: query }, function (e2, metas) {
              if (!e2 && metas) out[ty] = out[ty].concat(metas);
              done();
            });
          });
        }
        done();
      });
    });
    done(); // release sentinel
    setTimeout(function () {
      if (!finished) { finished = true; cb(null, finalize()); }
    }, 20000);
  }
  function enabledAddons() { return Store.profile().addons.filter(function (a) { return a.enabled; }); }
  return {
    baseOf: baseOf, hasResource: hasResource, loadManifest: loadManifest, ensureManifest: ensureManifest,
    getCatalog: getCatalog, getMeta: getMeta, getStreams: getStreams, getSubtitles: getSubtitles,
    aggregateStreams: aggregateStreams, searchAll: searchAll, enabledAddons: enabledAddons
  };
})();
