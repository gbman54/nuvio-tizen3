// Node unit tests for pure logic (no DOM needed where possible). Run: node scripts/test-unit.js
'use strict';
var fs = require('fs'), vm = require('vm');
var assert = require('assert');
var sandbox = {
  window: {}, document: undefined, localStorage: {
    _d: {},
    getItem: function (k) { return this._d[k] || null; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; }
  },
  setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
  console: console, Date: Date, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, RegExp: RegExp, Error: Error
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
// polyfill first (needs window/self)
load('src/js/00-polyfill.js');
load('src/js/01-util.js');
// Util tests
var Util = sandbox.Util;
assert.strictEqual(Util.fmtTime(0), '0:00');
assert.strictEqual(Util.fmtTime(65), '1:05');
assert.strictEqual(Util.fmtTime(3661), '1:01:01');
assert.strictEqual(Util.fmtSize(1024), '1 KB');
assert.strictEqual(Util.fmtSize(1536), '1.5 KB');
assert.strictEqual(Util.isHls('http://x/v.m3u8'), true);
assert.strictEqual(Util.isHls('http://x/v.mp4'), false);
var info = Util.parseStreamInfo('720p HEVC 1.5 GB BluRay');
assert.strictEqual(info.quality, '720P');
assert.strictEqual(info.sizeText, '1.5 GB');
assert.strictEqual(info.codec, 'HEVC');
assert.strictEqual(Util.sanitizeUrl('javascript:alert(1)'), '');
assert.strictEqual(Util.joinUrl('https://a/', '/b'), 'https://a/b');
var mag = Util.magnetFromStream({ infoHash: 'abc123', name: 'My Movie', sources: ['tracker:udp://t:1337/announce', 'udp://t2:80'] }, 'tt1');
assert.ok(mag.indexOf('magnet:?xt=urn:btih:abc123') === 0, mag);
assert.ok(mag.indexOf('&tr=udp%3A%2F%2Ft%3A1337%2Fannounce') !== -1, mag);
assert.strictEqual(Util.magnetFromStream({ name: 'x' }), null);
var vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nHello <b>world</b>\n\n00:00:04.000 --> 00:00:05.000\nSecond line\n';
var srt = Util.vttToSrt(vtt);
assert.ok(srt.indexOf('1\n00:00:01,000 --> 00:00:03,500\nHello world') !== -1, srt);
assert.ok(srt.indexOf('2\n00:00:04,000 --> 00:00:05,000\nSecond line') !== -1, srt);
console.log('Util OK');
// Storage
load('src/js/02-storage.js');
var Store = sandbox.Store;
var prof = Store.profile();
assert.ok(prof.addons.length >= 1);
assert.strictEqual(prof.addons[0].url, 'https://v3-cinemeta.strem.io/manifest.json');
Store.createProfile('T1', 'Test');
assert.strictEqual(Store.profileNames().length, 2);
Store.switchProfile('T1');
assert.strictEqual(Store.state().currentProfile, 'T1');
Store.setSetting('lang', 'ar');
assert.strictEqual(Store.settings().lang, 'ar');
// size cap: stuff history, save should not throw
for (var i = 0; i < 500; i++) Store.profile().history['k' + i] = { pos: 100, dur: 200, ts: i, title: 'x' };
Store.save();
console.log('Store OK');
// Api helpers (pure)
sandbox.Http = { getJson: function () {} };
// load api needs Http + Store; stub http first then load
load('src/js/04-http.js');
load('src/js/05-api.js');
var Api = sandbox.Api;
assert.strictEqual(Api.baseOf('https://host/manifest.json'), 'https://host');
assert.strictEqual(Api.baseOf('https://host/'), 'https://host');
var m = { resources: ['catalog', 'meta'], catalogs: [] };
assert.strictEqual(Api.hasResource(m, 'catalog'), true);
assert.strictEqual(Api.hasResource(m, 'stream'), false);
var m2 = { resources: { stream: true } };
assert.strictEqual(Api.hasResource(m2, 'stream'), true);
console.log('Api OK');
// Resolver magnet path covered via Util; i18n test with document stub
sandbox.document = {
  documentElement: { setAttribute: function () {} },
  getElementById: function () { return { className: '' }; }
};
load('src/js/03-i18n.js');
var I18n = sandbox.I18n;
assert.strictEqual(I18n.getLang(), 'ar');
assert.strictEqual(I18n.t('home'), 'الرئيسية');
I18n.setLang('en');
assert.strictEqual(I18n.t('home'), 'Home');
// ---- Plugins: transform + crypto + exec (no network, no DOMParser needed) ----
sandbox.atob = function (s) { return Buffer.from(s, 'base64').toString('binary'); };
sandbox.btoa = function (s) { return Buffer.from(s, 'binary').toString('base64'); };
sandbox.XMLHttpRequest = function () { throw new Error('no XHR in tests'); };
// Http is required by 13-plugins (uses Http.getJson only on addRepo); stub already loaded 04-http
load('src/js/13-plugins.js');
var Plugins = sandbox.Plugins;
var AS = 'as' + 'ync', AW = 'awa' + 'it';
// crypto known vectors
assert.strictEqual(Plugins._crypto.md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
assert.strictEqual(Plugins._crypto.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.throws(function () { Plugins._crypto.aesGcm(); }, /GCM/);
// transform: a-sync fn with a-wait on a Promise
var src1 = AS + ' ' + 'func' + 'tion getStreams(id, type) { var r = ' + AW + ' Promise.resolve(41); return [{url:"http://x/v.mp4", quality:"720p", headers:{Referer:"http://r"}}]; }';
var t1 = Plugins.transformSource(src1);
assert.ifError(t1.error);
var scraper = { id: 'test1', transformed: t1.code, code: src1, enabled: true, supportedTypes: ['movie'], error: '' };
var logs = [];
var entry = Plugins.execPlugin(scraper, logs);
entry('tt1', 'movie', 1, 1).then(function (raw) {
  assert.strictEqual(raw.length, 1);
  assert.strictEqual(raw[0].quality, '720p');
  var norm = Plugins.normalizeResults(raw, 'test1');
  assert.strictEqual(norm.length, 1);
  assert.strictEqual(norm[0].headers.Referer, 'http://r');
  // nested + module.exports shape
  var src2 = 'var getStreams = ' + AS + ' (id) => { var x = ' + AW + ' Promise.resolve(5); return [{url:"http://y/v.m3u8"}]; }; module.exports = { getStreams: getStreams };';
  var t2 = Plugins.transformSource(src2);
  assert.ifError(t2.error);
  return Plugins.execPlugin({ id: 'test2', transformed: t2.code, code: src2 }, [] )('1', 'movie', 1, 1);
}).then(function (raw2) {
  assert.strictEqual(raw2.length, 1);
  // bad plugin must not throw: unknown transform failure surfaced cleanly
  var bad = Plugins.transformSource(AS + ' class Foo {}');
  assert.ok(bad.error, 'expected transform error');
  // CommonJS require shim + optional chaining rewrite (Nuvio-style bundles)
  var src6 = 'var cheerio = require("cheerio-without-node-native");' +
    'var getStreams = function (id) { var o = {a:{b:"ok"}}; var v = o?.a?.b; ' +
    'if (typeof Buffer === "undefined") throw new Error("no Buffer"); ' +
    'return [{url:"http://n/v.mp4", name:v}]; }; module.exports = { getStreams: getStreams };';
  var t6 = Plugins.transformSource(src6);
  assert.ifError(t6.error);
  return Plugins.execPlugin({ id: 'test6', transformed: t6.code, code: src6 }, [])('1', 'movie', 1, 1);
}).then(function (r6) {
  assert.strictEqual(r6[0].name, 'ok');
  // ES6 defaults + object spread + for-of destructuring + destructuring assignment
  var src7 = 'const { a, b: c, d = 5 } = { a: 1, b: 2 };\n' +
    'let acc = 0;\n' +
    'for (const { x } of [{ x: 7 }, { x: 8 }]) { acc += x; }\n' +
    'var opts = { z: 1 };\n' +
    'var merged = { q: 2, ...opts };\n' +
    'var getStreams = function () { return [{ url: "http://o/v.mp4", name: [a,c,d,acc,merged.q,merged.z].join("-") }]; };\n' +
    'module.exports = { getStreams: getStreams };';
  var t7 = Plugins.transformSource(src7);
  assert.ifError(t7.error);
  var r7 = Plugins.execPlugin({ id: 'test7', transformed: t7.code, code: src7 }, [])();
  assert.strictEqual(r7[0].name, '1-2-5-15-2-1');
  // HmacMD5 via crypto-js shim
  var src8 = 'var C=require("crypto-js");var getStreams=function(){return [{url:"http://h/v.mp4",name:C.HmacMD5("key","The quick brown fox jumps over the lazy dog").toString(C.enc.Hex)}];};module.exports={getStreams:getStreams};';
  var t8 = Plugins.transformSource(src8);
  var r8 = Plugins.execPlugin({ id: 'test8', transformed: t8.code, code: src8 }, [])();
  assert.strictEqual(r8[0].name, '80070713463e7749b90c2dc24911e275');
  // expression-body arrow: async x => (await ...) -> generator with return
  var src3 = 'const getStreams = ' + AS + ' id => Promise.resolve([{url:"http://z/v.mp4"}]);';
  var t3 = Plugins.transformSource(src3);
  assert.ifError(t3.error);
  // object method shape
  var src4 = 'var p = { ' + AS + ' getStreams(id) { var v = ' + AW + ' Promise.resolve(1); return []; } }; module.exports = p;';
  var t4 = Plugins.transformSource(src4);
  assert.ifError(t4.error);
  console.log('Plugins OK');
  console.log('ALL UNIT TESTS PASSED');
}, function (e) { console.error('PLUGIN TEST FAILED', e); process.exit(1); });
