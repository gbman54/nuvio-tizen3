/* Remote resolver: Debrid (direct only) vs LAN streaming server adapters. No torrent engine on TV. */
var Resolver = (function () {
  'use strict';
  var TIMEOUT = 8000;
  function settings() { return Store.settings(); }
  function isConfigured() {
    var s = settings();
    return s.resolverMode === 'lan' && !!s.resolverBase;
  }
  function base() { return String(settings().resolverBase || '').replace(/\/$/, ''); }
  // Filter streams: keeps direct urls; if lan configured, also converts infoHash via adapter
  // cb(null, {direct:[], resolved:[{stream,url,via}], torrentOnly:bool})
  function processStreams(type, id, streams, cb) {
    var direct = [], torrents = [], i;
    for (i = 0; i < streams.length; i++) {
      var s = streams[i];
      if (s.url && Util.isHttp(s.url)) direct.push(s);
      else if (s.infoHash || s.infohash) torrents.push(s);
    }
    if (!torrents.length || !isConfigured()) {
      cb(null, { direct: direct, resolved: [], torrents: torrents, torrentOnly: torrents.length > 0 && direct.length === 0 });
      return;
    }
    var adapter = settings().resolverAdapter || 'stremio-server';
    var resolved = [], pending = torrents.length;
    torrents.forEach(function (s) {
      var magnet = Util.magnetFromStream(s, id);
      if (!magnet) { if (--pending === 0) cb(null, { direct: direct, resolved: resolved, torrents: torrents, torrentOnly: resolved.length === 0 && direct.length === 0 }); return; }
      resolveMagnet(magnet, type, id, adapter, function (err, url) {
        if (!err && url) resolved.push({ stream: s, url: url, via: adapter });
        if (--pending === 0) cb(null, { direct: direct, resolved: resolved, torrents: torrents, torrentOnly: resolved.length === 0 && direct.length === 0 });
      });
    });
  }
  function resolveMagnet(magnet, type, id, adapter, cb) {
    if (adapter === 'torrserver') resolveTorrServer(magnet, type, id, cb);
    else resolveStremioServer(magnet, type, id, cb);
  }
  // stremio-server adapter: try its stream proxy, then magnet endpoint
  function resolveStremioServer(magnet, type, id, cb) {
    var b = base();
    // Attempt 1: GET /stream/{type}/{id}.json on server (it aggregates its own addons)
    Http.getJson(b + '/stream/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + '.json', TIMEOUT, function (err, json) {
      if (!err && json && json.streams && json.streams.length) {
        for (var i = 0; i < json.streams.length; i++) if (json.streams[i].url && Util.isHttp(json.streams[i].url)) return cb(null, json.streams[i].url);
      }
      // Attempt 2: POST magnet to /  (some builds accept {magnet} / {url})
      Http.postJson(b + '/', { magnet: magnet, url: magnet }, TIMEOUT, function (err2, body) {
        if (!err2 && body) {
          if (typeof body === 'string' && Util.isHttp(body)) return cb(null, body);
          if (body.url && Util.isHttp(body.url)) return cb(null, body.url);
          if (body.stream && body.stream.url) return cb(null, body.stream.url);
        }
        cb(new Error('stremio-server-unreachable'));
      });
    });
  }
  // torrserver adapter: POST /add {link}, poll /list for files, build /stream/{hash}/{index}
  function resolveTorrServer(magnet, type, id, cb) {
    var b = base();
    var hash = '';
    var m = magnet.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/);
    if (m) hash = m[1].toLowerCase();
    Http.postJson(b + '/add', { link: magnet, title: id, save: true }, TIMEOUT, function (err, body) {
      if (err) return cb(new Error('torrserver-unreachable'));
      // body may contain hash; fall back to parsed hash
      var h = (body && (body.hash || body.Hash)) || hash;
      if (!h) return cb(new Error('torrserver-no-hash'));
      pollTorrServer(b, String(h).toLowerCase(), 0, cb);
    });
  }
  function pollTorrServer(b, hash, attempt, cb) {
    if (attempt > 8) return cb(new Error('torrserver-timeout'));
    Http.getText(b + '/list', TIMEOUT, function (err, text) {
      if (err) return cb(new Error('torrserver-unreachable'));
      var data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (data) {
        // torrserver list format: array or {hash: {file_stats: [...]}} - tolerant parse
        var files = extractFiles(data, hash);
        if (files && files.length) {
          // pick largest video-like file
          var best = files[0], bestSize = -1, i;
          for (i = 0; i < files.length; i++) {
            var sz = files[i].length || files[i].Length || 0;
            if (sz > bestSize) { bestSize = sz; best = files[i]; }
          }
          var idx = best.id != null ? best.id : files.indexOf(best);
          return cb(null, b + '/stream/' + hash + '/' + idx);
        }
      }
      setTimeout(function () { pollTorrServer(b, hash, attempt + 1, cb); }, 1200);
    });
  }
  function extractFiles(data, hash) {
    if (Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        if (data[i] && data[i].hash && String(data[i].hash).toLowerCase() === hash && data[i].file_stats) return data[i].file_stats;
        if (data[i] && data[i].hash && String(data[i].hash).toLowerCase() === hash && data[i].files) return data[i].files;
      }
      if (data[0] && data[0].file_stats) return data[0].file_stats;
      return null;
    }
    if (data && typeof data === 'object') {
      var entry = data[hash] || data[Object.keys(data)[0]];
      if (entry && entry.file_stats) return entry.file_stats;
      if (entry && entry.files) return entry.files;
    }
    return null;
  }
  function testConnection(cb) {
    if (!isConfigured()) return cb(new Error('not-configured'));
    var adapter = settings().resolverAdapter || 'stremio-server';
    var url = adapter === 'torrserver' ? base() + '/list' : base() + '/server/settings';
    Http.testUrl(url, 6000, function (err, status) {
      if (err) {
        // fallback: root
        Http.testUrl(base() + '/', 6000, function (err2, st2) { cb(err2, st2); });
      } else cb(null, status);
    });
  }
  return { isConfigured: isConfigured, processStreams: processStreams, resolveMagnet: resolveMagnet, testConnection: testConnection, base: base };
})();
