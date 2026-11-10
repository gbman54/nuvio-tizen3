/* Utilities - ES5 */
var Util = (function () {
  'use strict';
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
  }
  function fmtTime(sec) {
    if (sec == null || isNaN(sec) || !isFinite(sec)) return '0:00';
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = m < 10 ? '0' + m : '' + m, ss = s < 10 ? '0' + s : '' + s;
    return h > 0 ? h + ':' + mm + ':' + ss : m + ':' + ss;
  }
  function fmtSize(bytes) {
    if (!bytes) return '';
    var units = ['B', 'KB', 'MB', 'GB'], i = 0, n = bytes;
    while (n >= 1024 && i < 3) { n /= 1024; i++; }
    return (Math.round(n * 10) / 10) + ' ' + units[i];
  }
  // Parse "720p / 1.5 GB / HEVC" style info from stream name/title
  function parseStreamInfo(s) {
    s = s || '';
    var info = { quality: '', sizeText: '', codec: '', raw: s };
    var m;
    m = s.match(/(2160p|1080p|720p|480p|4K|HD|SD|CAM|TS|HDR|DV)/i);
    if (m) info.quality = m[1].toUpperCase();
    m = s.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|TB))/i);
    if (m) info.sizeText = m[1].toUpperCase();
    m = s.match(/(HEVC|x265|x264|H\.265|H\.264|AV1|VP9|REMUX|WEB-DL|BluRay|BDRip|WEBRip)/i);
    if (m) info.codec = m[1].toUpperCase();
    return info;
  }
  function isHls(url) { return /[.]m3u8($|[?])/i.test(url || ''); }
  function isHttp(url) { return /^https?:\/\//i.test(url || ''); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() { return Date.now(); }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
  function sanitizeUrl(u) {
    // Only allow http/https/data/blob for images; reject javascript:
    u = String(u || '').trim();
    if (/^javascript:/i.test(u) || /^vbscript:/i.test(u)) return '';
    return u;
  }
  function joinUrl(base, path) {
    base = String(base || '').replace(/\/+$/, '');
    path = String(path || '').replace(/^\/+/, '');
    return base + '/' + path;
  }
  // WebVTT -> SubRip (SRT). Tizen 3.0 AVPlay does not accept .vtt files.
  function vttToSrt(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n'), out = [], idx = 1, i = 0;
    if (/^WEBVTT/.test(lines[0] || '')) { i = 1; while (i < lines.length && lines[i].trim() !== '') i++; }
    while (i < lines.length) {
      var line = lines[i];
      if (!line || !line.trim()) { i++; continue; }
      if (/^(NOTE|STYLE|REGION)\b/.test(line)) { while (i < lines.length && lines[i].trim() !== '') i++; continue; }
      var m = line.match(/(\d{1,2}:\d{2}:\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2})[.,](\d{3})/);
      if (!m) {
        var next = lines[i + 1] || '';
        var m2 = next.match(/(\d{1,2}:\d{2}:\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2})[.,](\d{3})/);
        if (m2) { i++; m = m2; } else { i++; continue; }
      }
      i++;
      var body = [];
      while (i < lines.length && lines[i].trim() !== '') {
        body.push(lines[i].replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, ''));
        i++;
      }
      if (!body.length) continue;
      out.push(String(idx++) + '\n' + m[1] + ',' + m[2] + ' --> ' + m[3] + ',' + m[4] + '\n' + body.join('\n'));
    }
    return out.join('\n\n') + '\n';
  }
  function magnetFromStream(stream, fallbackName) {
    var hash = stream.infoHash || stream.infohash || '';
    if (!hash) return null;
    var name = stream.name || stream.title || fallbackName || hash;
    var mag = 'magnet:?xt=urn:btih:' + hash + '&dn=' + encodeURIComponent(String(name).slice(0, 200));
    var sources = stream.sources || [];
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i];
      var tr = typeof s === 'string' ? s : (s && s.url) || '';
      if (tr && tr.indexOf('tracker:') === 0) mag += '&tr=' + encodeURIComponent(tr.slice(8));
      else if (tr && /^udp:|^http/.test(tr)) mag += '&tr=' + encodeURIComponent(tr);
    }
    return mag;
  }
  /* ---------- audio-language hints in stream names ----------
     Scrapers usually put the language in the name, e.g.
       "Fight Club 1999 1080p Hindi Eng Sub"
       "[RU] 1080p | Russian audio"
     We use that hint to hide streams that cannot offer the preferred audio.
     "Eng Sub" is a subtitle marker, not an audio language, so it is stripped. */
  var AUDIO_LANG_RES = [
    { c: 'en', re: /\b(english|eng)\b/i },
    { c: 'hi', re: /\b(hindi|hin|hind)\b/i },
    { c: 'ru', re: /\b(russian|rus)\b/i },
    { c: 'ar', re: /\b(arabic|ara|arab)\b/i },
    { c: 'tr', re: /\b(turkish|tur|turkce|türkçe)\b/i },
    { c: 'fr', re: /\b(french|fra|fre|francais|français)\b/i },
    { c: 'es', re: /\b(spanish|spa|espanol|español|castellano)\b/i },
    { c: 'de', re: /\b(german|deu|ger|deutsch)\b/i },
    { c: 'it', re: /\b(italian|ita|italiano)\b/i },
    { c: 'pt', re: /\b(portuguese|por|portugues|português)\b/i },
    { c: 'ta', re: /\b(tamil|tam)\b/i },
    { c: 'te', re: /\b(telugu|tel)\b/i },
    { c: 'ml', re: /\b(malayalam|mal)\b/i },
    { c: 'kn', re: /\b(kannada|kan)\b/i },
    { c: 'bn', re: /\b(bengali|ben|bangla)\b/i },
    { c: 'pa', re: /\b(punjabi|pan)\b/i },
    { c: 'mr', re: /\b(marathi|mar)\b/i },
    { c: 'gu', re: /\b(gujarati|guj)\b/i },
    { c: 'ur', re: /\b(urdu|urd)\b/i },
    { c: 'fa', re: /\b(persian|farsi|fas|per)\b/i },
    { c: 'ko', re: /\b(korean|kor)\b/i },
    { c: 'ja', re: /\b(japanese|jpn)\b/i },
    { c: 'zh', re: /\b(chinese|chi|zho|mandarin|cantonese)\b/i },
    { c: 'uk', re: /\b(ukrainian|ukr)\b/i },
    { c: 'pl', re: /\b(polish|pol|polski)\b/i },
    { c: 'nl', re: /\b(dutch|nld|dut|nederlands)\b/i },
    { c: 'sv', re: /\b(swedish|swe)\b/i },
    { c: 'da', re: /\b(danish|dan)\b/i },
    { c: 'no', re: /\b(norwegian|nor)\b/i },
    { c: 'fi', re: /\b(finnish|fin)\b/i },
    { c: 'el', re: /\b(greek|ell|gre)\b/i },
    { c: 'he', re: /\b(hebrew|heb)\b/i },
    { c: 'id', re: /\b(indonesian|ind)\b/i },
    { c: 'ms', re: /\b(malay|msa|may)\b/i },
    { c: 'th', re: /\b(thai|tha)\b/i },
    { c: 'vi', re: /\b(vietnamese|vie)\b/i },
    { c: 'cs', re: /\b(czech|ces|cze)\b/i },
    { c: 'ro', re: /\b(romanian|ron|rum)\b/i },
    { c: 'hu', re: /\b(hungarian|hun)\b/i }
  ];
  // Remove subtitle markers so "Eng Sub" is not treated as English audio.
  function stripSubtitleHints(s) {
    return String(s || '')
      .replace(/\b(?:eng|english|ara|arabic|hin|hindi|rus|russian|tur|turkish|fra|fre|french|spa|spanish|deu|ger|german|ita|italian|por|portuguese|chi|zho|chinese|jpn|japanese|kor|korean)\s*[-\s]?(?:subs?|subtitles?)\b/gi, ' ')
      .replace(/\b(?:e|h|a|f|s|t|r|p)\s?subs?\b/gi, ' ')
      .replace(/\b(?:multi|dual)\s?subs?\b/gi, ' ')
      .replace(/\bsubbed\b/gi, ' ');
  }
  // Returns { langs: ['en','fr'], multi: true|false }
  function streamLangs(text) {
    var clean = stripSubtitleHints(text), out = { langs: [], multi: false }, i;
    if (/\b(multi[\s-]?audio|dual[\s-]?audio|multi)\b/i.test(clean)) out.multi = true;
    for (i = 0; i < AUDIO_LANG_RES.length; i++) {
      if (AUDIO_LANG_RES[i].re.test(clean)) out.langs.push(AUDIO_LANG_RES[i].c);
    }
    return out;
  }
  // Unknown language hints are allowed: only an explicit non-preferred language is filtered.
  function audioAllowed(text, pref) {
    pref = String(pref || '').toLowerCase();
    if (!pref || pref === 'original') return true;
    var info = streamLangs(text);
    if (info.multi) return true;
    if (!info.langs.length) return true;
    return info.langs.indexOf(pref) !== -1;
  }
  return { $: $, $all: $all, el: el, esc: esc, debounce: debounce, fmtTime: fmtTime, fmtSize: fmtSize, parseStreamInfo: parseStreamInfo, isHls: isHls, isHttp: isHttp, clamp: clamp, now: now, deepClone: deepClone, sanitizeUrl: sanitizeUrl, joinUrl: joinUrl, magnetFromStream: magnetFromStream, vttToSrt: vttToSrt, streamLangs: streamLangs, audioAllowed: audioAllowed };
})();
