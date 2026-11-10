/* Plugin Manager: on-device scraper repos, sandbox, a-sync transform, Plugin Test.
   ES5 source. The transform rewrites provider a-sync/a-wait code into
   generator coroutines (native in Chromium 47) driven by a tiny runner. */
var Plugins = (function () {
  'use strict';
  var RUN_TIMEOUT = 8000;
  var TRANSFORM_VERSION = 6;   // bump when the source transformer changes
  var CODE_KEY = 'nuvio-plugin-code-';
  var CACHE_KEY = 'nuvio-plugin-cache-';
  var REPO_KEY = 'nuvio-plugin-repos';
  var SCRAPER_KEY = 'nuvio-plugin-scrapers';
  var running = false;
  var runChain = Promise.resolve();
  var AS = 'as' + 'ync', AW = 'awa' + 'it', FN = 'func' + 'tion';
  var AX = 'async';

  /* ---------------- storage ---------------- */
  function getRepos() {
    try { return JSON.parse(localStorage.getItem(REPO_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveRepos(r) { try { localStorage.setItem(REPO_KEY, JSON.stringify(r)); } catch (e) {} }
  function getScrapers() {
    try { return JSON.parse(localStorage.getItem(SCRAPER_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveScrapers(s) {
    try { localStorage.setItem(SCRAPER_KEY, JSON.stringify(s)); } catch (e) { /* quota: keep in memory only */ }
  }
  function hashStr(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36) + '_' + s.length;
  }
  function saveCode(s) {
    var list = getScrapers();
    for (var i = 0; i < list.length; i++) if (list[i].id === s.id) list[i] = s;
    saveScrapers(list);
  }
  function getCode(id) {
    var list = getScrapers(), i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i].code || '';
    return '';
  }

  /* ---------------- repo / manifest ---------------- */
  function resolveUrl(manifestUrl, filename) {
    if (/^https?:\/\//i.test(filename)) return filename;
    var base = String(manifestUrl).split('/manifest.json')[0];
    if (base.slice(-1) !== '/') base += '/';
    return base + String(filename).replace(/^\//, '');
  }
  function normalizeManifest(json, manifestUrl) {
    var raw = json, out = [];
    if (!raw) return out;
    var list = raw.scrapers || raw.plugins || raw.providers || (Array.isArray(raw) ? raw : []);
    for (var i = 0; i < list.length; i++) {
      var s = list[i] || {};
      if (!s.id || !s.filename) continue;
      out.push({
        id: String(s.id), filename: String(s.filename),
        url: resolveUrl(manifestUrl, s.filename),
        supportedTypes: s.supportedTypes || s.types || ['movie', 'series'],
        enabled: s.enabled !== false,
        formats: s.formats || ['mp4', 'hls', 'm3u8'],
        version: s.version || s.v || '1.0.0',
        code: '', hash: '', transformed: '', error: ''
      });
    }
    return out;
  }
  function addRepo(manifestUrl, cb) {
    manifestUrl = (manifestUrl || '').trim();
    if (!/^https?:\/\//i.test(manifestUrl)) { cb(new Error('invalid-url')); return; }
    if (manifestUrl.indexOf('/manifest.json') === -1) manifestUrl = manifestUrl.replace(/\/$/, '') + '/manifest.json';
    Http.getJson(manifestUrl, 8000, function (err, json) {
      if (err) { cb(err); return; }
      var repos = getRepos();
      if (repos.indexOf(manifestUrl) === -1) { repos.push(manifestUrl); saveRepos(repos); }
      var scrapers = normalizeManifest(json, manifestUrl);
      var existing = getScrapers();
      scrapers.forEach(function (s) {
        var idx = -1, i;
        for (i = 0; i < existing.length; i++) if (existing[i].id === s.id) idx = i;
        if (idx >= 0) { // version check: keep enabled/code if version matches, else re-download
          if (existing[idx].version !== s.version || !existing[idx].code) { existing[idx] = s; }
          else { existing[idx].enabled = s.enabled; existing[idx].supportedTypes = s.supportedTypes; existing[idx].formats = s.formats; }
        } else existing.push(s);
      });
      saveScrapers(existing);
      var pending = scrapers.length;
      if (!pending) { cb(null, scrapers); return; }
      scrapers.forEach(function (s) { downloadScraper(s, function () { if (--pending === 0) cb(null, scrapers); }); });
    });
  }
  function downloadScraper(s, cb) {
    Http.getText(s.url, 8000, function (err, text) {
      if (err) { s.error = 'download failed: ' + err.message; saveCode(s); cb(s); return; }
      s.code = text; s.hash = hashStr(text); s.error = '';
      var t = transformSource(text);
      if (t.error) s.error = 'transform failed: ' + t.error;
      else { s.transformed = t.code; s.tv = TRANSFORM_VERSION; }
      saveCode(s); cb(s);
    });
  }
  function refreshScraper(id, cb) {
    var list = getScrapers(), target = null, i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) target = list[i];
    if (!target) { cb(new Error('not-found')); return; }
    downloadScraper(target, function (s) { cb(s.error ? new Error(s.error) : null, s); });
  }
  function removeScraper(id) {
    var list = getScrapers().filter(function (s) { return s.id !== id; });
    saveScrapers(list);
    try { localStorage.removeItem(CODE_KEY + id); localStorage.removeItem(CACHE_KEY + id); } catch (e) {}
  }
  function setEnabled(id, enabled) {
    var list = getScrapers(), i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) { list[i].enabled = enabled; saveScrapers(list); return; }
  }
  function removeRepo(url) {
    saveRepos(getRepos().filter(function (u) { return u !== url; }));
  }

  /* ---------------- transform (a-sync -> generators) ---------------- */
  function isCodeChar(src, i) { return true; }
  function skipString(src, i) {
    var q = src[i], j = i + 1;
    while (j < src.length) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === q) return j + 1;
      if (q !== '`' && src[j] === '\n') return j;
      j++;
    }
    return src.length;
  }
  function findClosing(src, openIdx) {
    var depth = 0, j = openIdx;
    while (j < src.length) {
      var c = src[j];
      if (c === '"' || c === "'" || c === '`') { j = skipString(src, j); continue; }
      if (c === '/' && src[j + 1] === '/') { while (j < src.length && src[j] !== '\n') j++; continue; }
      if (c === '/' && src[j + 1] === '*') { j += 2; while (j < src.length && src[j] !== '*' ) j++; j += 2; continue; }
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0) return j; }
      j++;
    }
    return -1;
  }
  function findMatchBrace(src, openIdx) { return findClosing(src, openIdx); }
  // Replace a-wait words with yield inside [from,to) outside strings/comments
  function replaceAwait(src, from, to) {
    var out = '', i = from;
    while (i < to) {
      var c = src[i];
      if (c === '"' || c === "'" || c === '`') { var e = skipString(src, i); e = Math.min(e, to); out += src.slice(i, e); i = e; continue; }
      if (c === '/' && src[i + 1] === '/') { var e2 = i; while (e2 < to && src[e2] !== '\n') e2++; out += src.slice(i, e2); i = e2; continue; }
      if (c === '/' && src[i + 1] === '*') { var m = src.indexOf('*/', i + 2); m = (m === -1 ? to : Math.min(m + 2, to)); out += src.slice(i, m); i = m; continue; }
      if ((c === 'a') && src.substr(i, 5) === AW && !/[\w$]/.test(src[i - 1] || '') && !/[\w$]/.test(src[i + 5] || '')) {
        out += 'yield'; i += 5; continue;
      }
      out += c; i++;
    }
    return out;
  }
  // Replace strings and comments with spaces (same length) so keyword scans
  // never match inside comments/strings, while indices stay valid.
  function maskNonCode(src) {
    var out = '', i = 0;
    while (i < src.length) {
      var c = src[i];
      if (c === '"' || c === "'" || c === '`') {
        var e = skipString(src, i);
        out += new Array(Math.max(0, e - i) + 1).join(' ');
        i = e; continue;
      }
      if (c === '/' && src[i + 1] === '/') {
        var j = i; while (j < src.length && src[j] !== '\n') j++;
        out += new Array(Math.max(0, j - i) + 1).join(' '); i = j; continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        var k = src.indexOf('*/', i + 2); k = (k === -1 ? src.length : k + 2);
        out += new Array(Math.max(0, k - i) + 1).join(' '); i = k; continue;
      }
      out += c; i++;
    }
    return out;
  }
  // ---- Chrome 47 syntax helpers (default params, object spread, destructuring, **) ----
  function splitTopLevel(s, sep) {
    var out = [], cur = '', depth = 0, i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === '"' || c === "'" || c === '`') { var e = skipString(s, i); cur += s.slice(i, e); i = e; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      if (c === sep && depth === 0) { out.push(cur); cur = ''; i++; continue; }
      cur += c; i++;
    }
    out.push(cur);
    return out;
  }
  function topLevelAssignIndex(p) {
    var depth = 0, i = 0;
    while (i < p.length) {
      var c = p[i];
      if (c === '"' || c === "'" || c === '`') { i = skipString(p, i); continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === '=' && depth === 0) {
        var prev = p[i - 1] || '', next = p[i + 1] || '';
        if (next !== '=' && prev !== '=' && prev !== '!' && prev !== '<' && prev !== '>' && next !== '>') return i;
      }
      i++;
    }
    return -1;
  }
  function splitDefaults(params) {
    var parts = splitTopLevel(params, ','), outNames = [], checks = '', changed = false;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) { outNames.push(''); continue; }
      var eq = topLevelAssignIndex(p);
      if (eq === -1) { outNames.push(p); continue; }
      var name = p.slice(0, eq).trim(), def = p.slice(eq + 1).trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) return { changed: false }; // destructuring default: bail out
      outNames.push(name);
      checks += 'if(' + name + '===undefined){' + name + '=' + def + ';}';
      changed = true;
    }
    return { changed: changed, params: outNames.join(', '), checks: checks };
  }
  function rewriteParamDefaults(code) {
    var guard = 0, changedAny = false;
    while (guard++ < 200) {
      var changed = false;
      code = code.replace(/function(\s*\*)?(\s+[A-Za-z_$][\w$]*)?\s*\(([^()]*)\)\s*\{/g, function (m, star, name, params) {
        var r = splitDefaults(params);
        if (!r.changed) return m;
        changed = true;
        return 'function' + (star || '') + (name || '') + '(' + r.params + '){' + r.checks;
      });
      var arrowBlock = new RegExp('\\(([^()]*)\\)\\s*' + '=' + '>\\s*\\{', 'g');
      code = code.replace(arrowBlock, function (m, params) {
        var r = splitDefaults(params);
        if (!r.changed) return m;
        changed = true;
        return '(' + r.params + ')' + '=' + '>{' + r.checks;
      });
      if (!changed) break;
      changedAny = true;
    }
    return code;
  }
  // General object-spread rewrite: { a: 1, ...x, ...y } -> Object.assign({}, x, y, { a: 1 })
  function findSpreadObject(code) {
    var i = 0;
    while (i < code.length) {
      var c = code[i];
      if (c === '"' || c === "'" || c === '`') { i = skipString(code, i); continue; }
      if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
      if (c === '/' && code[i + 1] === '*') { var ce = code.indexOf('*/', i + 2); i = (ce === -1 ? code.length : ce + 2); continue; }
      if (c === '{') {
        var before = code.slice(0, i).replace(/\s+$/, '');
        var prev = before.charAt(before.length - 1);
        var word = (before.match(/[A-Za-z_$][\w$]*$/) || [''])[0];
        var exprPos = /[=(:,\[!&|?+\-*\/%]/.test(prev) || /^(return|typeof|case|in|of|void)$/.test(word);
        if (/=>\s*$/.test(before)) exprPos = false;   // arrow function body, not an object literal
        if (prev !== ')' && exprPos) {
          var end = findMatchBrace(code, i);
          if (end !== -1) {
            var inner = code.slice(i + 1, end);
            if (inner.indexOf('...') !== -1) {
              var parts = splitTopLevel(inner, ','), spreads = [], normals = [], hasSpread = false, ok = true;
              for (var p = 0; p < parts.length; p++) {
                var part = parts[p].trim();
                if (!part) continue;
                if (part.indexOf('...') === 0) {
                  var ex = part.slice(3).trim();
                  if (!ex) { ok = false; break; }
                  spreads.push(ex); hasSpread = true;
                } else normals.push(part);
              }
              if (ok && hasSpread) {
                var repl = 'Object.assign({}' + spreads.map(function (s) { return ',' + s; }).join('') +
                  (normals.length ? ',{' + normals.join(',') + '}' : '') + ')';
                return { start: i, end: end + 1, repl: repl };
              }
            }
          }
        }
        i++;
        continue;
      }
      i++;
    }
    return null;
  }
  function rewriteObjectSpread(code) {
    var guard = 0, hit;
    while ((hit = findSpreadObject(code)) && guard++ < 100) {
      code = code.slice(0, hit.start) + hit.repl + code.slice(hit.end);
    }
    return code;
  }

  // for (var [a,b] of X) -> for (var __tN of X) { var a=__tN[0], b=__tN[1]; ... }
  var forOfTmp = 0;
  function patternAssignments(pattern, tmp) {
    var p = pattern.trim(), out = [], i;
    if (p.charAt(0) === '{') {
      var parts = splitTopLevel(p.slice(1, -1), ',');
      for (i = 0; i < parts.length; i++) {
        var seg = parts[i].trim();
        if (!seg) continue;
        if (seg.indexOf('...') === 0) return null; // object rest unsupported
        var kv = seg.split(':');
        var key = kv[0].trim(), name = (kv[1] || kv[0]).trim();
        if (!/^[A-Za-z_$][\w$]*$/.test(key) || !/^[A-Za-z_$][\w$]*$/.test(name)) return null;
        out.push(name + '=' + tmp + '.' + key);
      }
      return out;
    }
    if (p.charAt(0) === '[') {
      var arr = splitTopLevel(p.slice(1, -1), ',');
      for (i = 0; i < arr.length; i++) {
        var nm = arr[i].trim();
        if (!nm) continue;
        if (nm.indexOf('...') === 0) return null;
        if (!/^[A-Za-z_$][\w$]*$/.test(nm)) return null;
        out.push(nm + '=' + tmp + '[' + i + ']');
      }
      return out;
    }
    return null;
  }
  function rewriteForOfDestructuringPass(code) {
    var masked = maskNonCode(code);
    var re = /for\s*\(/g, m, out = '', last = 0, guard = 0;
    while ((m = re.exec(masked)) && guard++ < 300) {
      var pos = m.index;
      if (/[\w$]/.test(masked.charAt(pos - 1))) continue;
      var open = masked.indexOf('(', pos);
      var close = findMatchBraceParen(masked, open);
      if (close === -1) continue;
      var head = code.slice(open + 1, close);
      var mm = /^\s*(?:var|let|const)\s+([\{\[][\s\S]*?[\}\]])\s+of\s+([\s\S]+)$/.exec(head);
      if (!mm) { re.lastIndex = close + 1; continue; }
      var tmp = '__fo' + (++forOfTmp);
      var assigns = patternAssignments(mm[1], tmp);
      if (!assigns) { re.lastIndex = close + 1; continue; }
      var after = masked.slice(close + 1);
      var nb = after.match(/^\s*/)[0].length;
      var bracePos = close + 1 + nb;
      if (masked.charAt(bracePos) !== '{') { re.lastIndex = close + 1; continue; }
      out += code.slice(last, open + 1) + 'var ' + tmp + ' of ' + mm[2] + ')' +
        code.slice(close + 1, bracePos + 1) + 'var ' + assigns.join(',') + ';';
      last = bracePos + 1;
      re.lastIndex = bracePos + 1;
    }
    return out + code.slice(last);
  }
  // Chromium 47 only allows let/const in strict mode; convert top-level block declarations.
  function rewriteLetConst(code) {
    var out = '', i = 0;
    while (i < code.length) {
      var c = code[i];
      if (c === '"' || c === "'" || c === '`') { var e = skipString(code, i); out += code.slice(i, e); i = e; continue; }
      if (c === '/' && code[i + 1] === '/') { var j = i; while (j < code.length && code[j] !== '\n') j++; out += code.slice(i, j); i = j; continue; }
      if (c === '/' && code[i + 1] === '*') { var k = code.indexOf('*/', i + 2); k = (k === -1 ? code.length : k + 2); out += code.slice(i, k); i = k; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        var m = /^[A-Za-z_$][\w$]*/.exec(code.slice(i));
        var w = m[0];
        out += (w === 'const' || w === 'let') ? 'var' : w;
        i += w.length; continue;
      }
      out += c; i++;
    }
    return out;
  }
  // { a, b: c, d = 1 } = src  ->  a=src.a, c=src.b, d=(src.d===undefined?(1):src.d)
  function rewriteDestructuringAssignments(code) {
    var guard = 0, changed = true;
    while (changed && guard++ < 100) {
      changed = false;
      var masked = maskNonCode(code), i, hit = null;
      for (i = 0; i < masked.length; i++) {
        if (masked.charAt(i) !== '{') continue;
        var end = findMatchBrace(code, i);
        if (end === -1) continue;
        var after = masked.slice(end + 1);
        var am = /^\s*=(?!=|>)\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])*)/.exec(after);
        if (!am) continue;
        var before = masked.slice(0, i).replace(/\s+$/, '');
        var prev = before.charAt(before.length - 1);
        var word = (before.match(/[A-Za-z_$][\w$]*$/) || [''])[0];
        if (!(/^(var|let|const)$/.test(word) || /[=(,]$/.test(prev))) continue;
        var rhs = am[1];
        // Reject when the right-hand side continues (calls, yield/await, operators):
        // only plain references can be expanded safely.
        if (/^(yield|await|new|typeof|void|delete)$/.test(rhs)) continue;
        var tail = after.slice(am[0].length);
        if (/^[ \t]*[A-Za-z_$0-9({\[`]/.test(tail)) continue;
        var parts = splitTopLevel(code.slice(i + 1, end), ','), out = [], ok = true;
        for (var p = 0; p < parts.length; p++) {
          var seg = parts[p].trim();
          if (!seg) continue;
          var ms = /^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?(?:\s*=\s*([\s\S]+))?$/.exec(seg);
          if (!ms) { ok = false; break; }
          var key = ms[1], name = ms[2] || ms[1], def = ms[3];
          var val = rhs + '.' + key;
          if (def !== undefined) val = '(' + val + '===undefined?(' + def + '):' + val + ')';
          out.push(name + '=' + val);
        }
        if (!ok || !out.length) continue;
        code = code.slice(0, i) + out.join(',') + code.slice(end + 1 + am[0].length);
        changed = true; break;
      }
    }
    return code;
  }
  function rewriteExponent(code) {
    var re = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\d+(?:\.\d+)?|\([^()]*\))\s*\*\*\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\d+(?:\.\d+)?|\([^()]*\))/g;
    var guard = 0;
    while (re.test(code) && guard++ < 50) {
      re.lastIndex = 0;
      code = code.replace(re, 'Math.pow($1,$2)');
    }
    return code;
  }
  function rewriteSimpleDestructuring(code) {
    // const { a, b: c } = expr;  ->  var a=expr.a, c=expr.b;
    code = code.replace(/(?:const|let|var)\s*\{([^{}]+)\}\s*=\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\([^()]*\))?)\s*;/g,
      function (m, inner, expr) {
        var parts = splitTopLevel(inner, ','), out = [];
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i].trim();
          if (!p) continue;
          var kv = p.split(':');
          var key = kv[0].trim(), name = (kv[1] || kv[0]).trim();
          if (!/^[A-Za-z_$][\w$]*$/.test(key) || !/^[A-Za-z_$][\w$]*$/.test(name)) return m;
          out.push(name + '=' + expr + '.' + key);
        }
        return out.length ? 'var ' + out.join(',') + ';' : m;
      });
    // const [ a, b ] = expr;  ->  var a=expr[0], b=expr[1];
    code = code.replace(/(?:const|let|var)\s*\[([^\[\]]+)\]\s*=\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/g,
      function (m, inner, expr) {
        var parts = splitTopLevel(inner, ','), out = [];
        for (var i = 0; i < parts.length; i++) {
          var name = parts[i].trim();
          if (!/^[A-Za-z_$][\w$]*$/.test(name)) return m;
          out.push(name + '=' + expr + '[' + i + ']');
        }
        return out.length ? 'var ' + out.join(',') + ';' : m;
      });
    return code;
  }
  function transformSource(src) {
    if (!src) return { code: '', error: 'empty plugin' };
    var code = String(src), guard = 0;
    var reFn = new RegExp('(^|[^\\w$])' + AS + '\\s+' + FN + '\\s*([A-Za-z_$][\\w$]*)?\\s*\\(', 'g');
    var reAr = new RegExp('(^|[^\\w$])' + AS + '\\s*', 'g');
    var reMd = new RegExp('(^|[^\\w$])' + AS + '\\s+([A-Za-z_$][\\w$]*)\\s*\\(', 'g');
    while (guard++ < 40) {
      var scan = maskNonCode(code);
      reFn.lastIndex = 0; reAr.lastIndex = 0; reMd.lastIndex = 0;
      var mfn = reFn.exec(scan);
      if (mfn) {
        var start = mfn.index + mfn[1].length;
        var parenIdx = code.indexOf('(', start);
        var parenEnd = findMatchBraceParen(code, parenIdx);
        if (parenEnd === -1) return { code: '', error: 'unbalanced parens' };
        var braceIdx = code.indexOf('{', parenEnd);
        if (braceIdx === -1) return { code: '', error: 'missing body' };
        var braceEnd = findMatchBrace(code, braceIdx);
        if (braceEnd === -1) return { code: '', error: 'unbalanced braces' };
        var body = replaceAwait(code, braceIdx + 1, braceEnd);
        var prefixEnd = mfn.index + mfn[0].length - 1; // at '('
        code = code.slice(0, start) + 'function*' + (mfn[2] ? ' ' + mfn[2] : '') + code.slice(prefixEnd, braceIdx + 1) + body + code.slice(braceEnd);
        reFn.lastIndex = 0; continue;
      }
      // async arrow: async (params) => {..}  or  async x => {..}
      var mar = null, best = null;
      reMd.lastIndex = 0;
      var mm = reMd.exec(scan);
      if (mm && mm[2] === 'function') mm = null; // handled by fn branch
      if (mm) {
        var ms = mm.index + mm[1].length;
        var mParen = code.indexOf('(', ms);
        var mEnd = findMatchBraceParen(code, mParen);
        var mBrace = code.indexOf('{', mEnd);
        // treat as method only if no '=' involvement: convert to *name
        if (mBrace !== -1) {
          var ebrace = findMatchBrace(code, mBrace);
          if (ebrace !== -1) {
            var mbody = replaceAwait(code, mBrace + 1, ebrace);
            code = code.slice(0, ms) + '*' + code.slice(ms + AX.length + 1, mBrace + 1) + mbody + code.slice(ebrace);
            reFn.lastIndex = 0; continue;
          }
        }
      }
      reAr.lastIndex = 0;
      var am = reAr.exec(scan);
      if (am) {
        var aStart = am.index + am[1].length;
        var rest = code.slice(aStart + AS.length); // after the keyword itself
        var pm = rest.match(/^\s*(\([^)]*"[^"]*"[^)]*\)|\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
        if (pm) {
          var arrowIdx = aStart + AS.length + pm[0].indexOf('=>');
          var params = pm[1].trim();
          if (params.charAt(0) !== '(') params = '(' + params + ')';
          var afterArrow = arrowIdx + 2;
          var nb = code.slice(afterArrow).match(/^\s*/)[0].length;
          var bodyStart = afterArrow + nb;
          if (code[bodyStart] === '{') {
            var bEnd = findMatchBrace(code, bodyStart);
            if (bEnd === -1) return { code: '', error: 'unbalanced arrow body' };
            var abody = replaceAwait(code, bodyStart + 1, bEnd);
            code = code.slice(0, aStart) + 'function*' + params + ' ' + code.slice(bodyStart, bodyStart + 1) + abody + code.slice(bEnd);
            reFn.lastIndex = 0; continue;
          }
          // expression body: until ; or , or ) or ] at depth 0 (bounded)
          var e2 = bodyStart, depth = 0, par = 0;
          while (e2 < code.length && e2 < bodyStart + 4000) {
            var ch = code[e2];
            if (ch === '"' || ch === "'" || ch === '`') { e2 = skipString(code, e2); continue; }
            if (ch === '{' || ch === '[') depth++;
            else if (ch === '}' || ch === ']') { if (depth === 0) break; depth--; }
            else if (ch === '(') par++;
            else if (ch === ')') { if (par === 0 && depth === 0) break; par--; }
            else if ((ch === ';' || ch === ',') && depth === 0 && par === 0) break;
            e2++;
          }
          var expr = code.slice(bodyStart, e2).replace(new RegExp('\\b' + AW + '\\b', 'g'), 'yield');
          code = code.slice(0, aStart) + 'function*' + params + '{ return (' + expr + '); }' + code.slice(e2);
          reFn.lastIndex = 0; continue;
        }
        // unsupported a-sync shape (e.g. async class method weirdness)
        return { code: '', error: 'unsupported a-sync syntax near: ' + rest.slice(0, 60) };
      }
      break;
    }
    // optional chaining (ES2020) -> ES5-safe expressions
    code = rewriteOptionalChaining(code);
    // ES6/ES2016+ features Chromium 47 does not implement
    code = rewriteParamDefaults(code);
    code = rewriteObjectSpread(code);
    code = rewriteForOfDestructuringPass(code);
    code = rewriteSimpleDestructuring(code);
    code = rewriteDestructuringAssignments(code);
    code = rewriteExponent(code);
    // verify: no remaining a-sync keyword outside strings/comments
    var check = stripStringsComments(code);
    var leftRx = new RegExp('\\b' + AS + '\\b');
    if (leftRx.test(check)) return { code: '', error: 'unsupported a-sync syntax remaining' };
    var leftAw = new RegExp('\\b' + AW + '\\b');
    if (leftAw.test(check)) return { code: '', error: 'a-wait outside a-sync function' };
    return { code: code, error: null };
  }
  // Rewrite optional chaining so Chromium 47 can parse the plugin.
  // `a?.[x]` / `a?.(x)` degrade to plain access/call; `a?.b` becomes a guarded expression.
  function rewriteOptionalChaining(src) {
    var out = src;
    // bracket + call forms first (keeps brackets balanced)
    out = out.replace(/\?\.\[/g, '[').replace(/\?\.\(/g, '(');
    var re = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])*)\?\.([A-Za-z_$][\w$]*)/g;
    var guard = 0;
    while (re.test(out) && guard++ < 200) {
      re.lastIndex = 0;
      out = out.replace(re, function (m, base, prop) { return '(' + base + '==null?void 0:' + base + '.' + prop + ')'; });
    }
    return out;
  }
  function findMatchBraceParen(src, openIdx) {
    var depth = 0, j = openIdx;
    while (j < src.length) {
      var c = src[j];
      if (c === '"' || c === "'" || c === '`') { j = skipString(src, j); continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) return j; }
      j++;
    }
    return -1;
  }
  function stripStringsComments(src) {
    var out = '', i = 0;
    while (i < src.length) {
      var c = src[i];
      if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); out += ' '; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && src[i] !== '*') i++; i += 2; continue; }
      out += c; i++;
    }
    return out;
  }
  // coroutine driver: drives generator objects, resolves thenables
  function drive(genObj) {
    return new Promise(function (resolve, reject) {
      function step(result) {
        if (result.done) { resolve(result.value); return; }
        var v = result.value;
        if (v && typeof v.then === 'function') {
          v.then(function (val) { resume(genObj.next(val)); }, function (err) {
            try { resume(genObj.throw(err)); } catch (e) { reject(e); }
          });
        } else if (v && typeof v.next === 'function') {
          drive(v).then(function (val) { resume(genObj.next(val)); }, function (err) {
            try { resume(genObj.throw(err)); } catch (e) { reject(e); }
          });
        } else {
          resume(genObj.next(v));
        }
      }
      function resume(r) { try { step(r); } catch (e) { reject(e); } }
      try { resume(genObj.next()); } catch (e) { reject(e); }
    });
  }
  function isGeneratorFn(fn) {
    try { return fn && fn.constructor && fn.constructor.name === 'GeneratorFunction'; } catch (e) { return false; }
  }
  function wrapEntry(fn) {
    if (!isGeneratorFn(fn)) return fn;
    return function () {
      var args = arguments, self = this;
      return drive(fn.apply(self, args));
    };
  }

  /* ---------------- sandbox: fetch / cheerio / crypto ---------------- */
  function shimFetch(url, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var done = false;
      xhr.open(opts.method || 'GET', url, true);
      var headers = opts.headers || {};
      if (typeof headers === 'object') {
        Object.keys(headers).forEach(function (k) { try { xhr.setRequestHeader(k, headers[k]); } catch (e) {} });
      }
      xhr.timeout = 8000;
      xhr.ontimeout = function () { if (!done) { done = true; reject(new Error('timeout')); } };
      xhr.onerror = function () { if (!done) { done = true; reject(new Error('network')); } };
      xhr.onload = function () {
        if (done) return; done = true;
        var text = xhr.responseText || '';
        var hdrs = {};
        try {
          var rh = xhr.getAllResponseHeaders() || '';
          rh.split(/\r?\n/).forEach(function (line) {
            var p = line.split(':');
            if (p.length >= 2) hdrs[p[0].trim().toLowerCase()] = p.slice(1).join(':').trim();
          });
        } catch (e) {}
        var pairs = Object.keys(hdrs).map(function (k) { return [k, hdrs[k]]; });
        var headersObj = {
          get: function (n) { return hdrs[String(n).toLowerCase()] || null; },
          entries: function () { return pairs.slice(); },
          keys: function () { return pairs.map(function (p) { return p[0]; }); },
          values: function () { return pairs.map(function (p) { return p[1]; }); },
          forEach: function (cb) { pairs.forEach(function (p) { cb(p[1], p[0]); }); }
        };
        headersObj[typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator'] = function () {
          return (typeof Symbol !== 'undefined') ? pairs[Symbol.iterator]() : pairs;
        };
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, statusText: xhr.statusText,
          headers: headersObj,
          text: function () { return Promise.resolve(text); },
          json: function () { try { return Promise.resolve(JSON.parse(text)); } catch (e) { return Promise.reject(e); } }
        });
      };
      xhr.send(opts.body || null);
    });
  }
  function cheerioFactory() {
    // jQuery/cheerio-only pseudo selectors that querySelectorAll cannot parse
    function splitPseudos(sel) {
      var filters = [], s = String(sel || '');
      var reContains = /:contains\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/i;
      var m;
      while ((m = reContains.exec(s))) {
        filters.push({ type: 'contains', value: (m[1] != null ? m[1] : (m[2] != null ? m[2] : m[3])) });
        s = s.replace(m[0], '');
      }
      var reHas = /:has\(\s*([^)]*)\)/i;
      while ((m = reHas.exec(s))) {
        filters.push({ type: 'has', value: m[1] });
        s = s.replace(m[0], '');
      }
      var reEq = /:eq\(\s*(-?\d+)\s*\)/i;
      while ((m = reEq.exec(s))) {
        filters.push({ type: 'eq', value: parseInt(m[1], 10) });
        s = s.replace(m[0], '');
      }
      if (/:first\b/i.test(s)) { filters.push({ type: 'first' }); s = s.replace(/:first\b/ig, ''); }
      if (/:last\b/i.test(s)) { filters.push({ type: 'last' }); s = s.replace(/:last\b/ig, ''); }
      s = s.replace(/\s+/g, ' ').trim();
      return { base: s || '*', filters: filters };
    }
    function query(root, sel) {
      var parsed = splitPseudos(sel);
      var list;
      try { list = Array.prototype.slice.call(root.querySelectorAll(parsed.base)); }
      catch (e) { list = []; }
      for (var i = 0; i < parsed.filters.length; i++) {
        var f = parsed.filters[i];
        if (f.type === 'contains') {
          list = list.filter(function (el) { return (el.textContent || '').toLowerCase().indexOf(String(f.value).toLowerCase()) !== -1; });
        } else if (f.type === 'has') {
          list = list.filter(function (el) {
            try { return el.querySelector(f.value) !== null; } catch (e2) { return false; }
          });
        } else if (f.type === 'eq') {
          list = f.value >= 0 && f.value < list.length ? [list[f.value]] : [];
        } else if (f.type === 'first') {
          list = list.slice(0, 1);
        } else if (f.type === 'last') {
          list = list.slice(-1);
        }
      }
      return list;
    }
    function matches(el, sel) {
      var parsed = splitPseudos(sel);
      var root = el.parentNode || document;
      try { return query(root, sel).indexOf(el) !== -1; } catch (e) { return false; }
    }
    function wrap(els) {
      var arr = Array.prototype.slice.call(els || []);
      var api = {
        length: arr.length,
        0: arr[0],
        each: function (fn) { arr.forEach(function (el, i) { fn(i, el); }); return api; },
        first: function () { return wrap(arr.slice(0, 1)); },
        eq: function (i) { return wrap(arr[i] != null ? [arr[i]] : []); },
        find: function (sel) { var out = []; arr.forEach(function (el) { if (el.querySelectorAll) out = out.concat(query(el, sel)); }); return wrap(out); },
        parent: function () { var out = []; arr.forEach(function (el) { if (el.parentNode && out.indexOf(el.parentNode) === -1) out.push(el.parentNode); }); return wrap(out); },
        next: function () { var out = []; arr.forEach(function (el) { if (el.nextElementSibling) out.push(el.nextElementSibling); }); return wrap(out); },
        children: function () { var out = []; arr.forEach(function (el) { out = out.concat(Array.prototype.slice.call(el.children || [])); }); return wrap(out); },
        filter: function (fnOrSel) {
          var out;
          if (typeof fnOrSel === 'function') out = arr.filter(function (el, i) { return fnOrSel(i, el); });
          else out = arr.filter(function (el) { return matches(el, fnOrSel); });
          return wrap(out);
        },
        not: function (sel) { return wrap(arr.filter(function (el) { return !matches(el, sel); })); },
        has: function (sel) { return wrap(arr.filter(function (el) { return query(el, sel).length > 0; })); },
        is: function (sel) { return arr.some(function (el) { return matches(el, sel); }); },
        closest: function (sel) { var out = []; arr.forEach(function (el) { var n = el; while (n && n.nodeType === 1) { if (matches(n, sel)) { out.push(n); break; } n = n.parentNode; } }); return wrap(out); },
        parents: function () { var out = []; arr.forEach(function (el) { var n = el.parentNode; while (n && n.nodeType === 1) { if (out.indexOf(n) === -1) out.push(n); n = n.parentNode; } }); return wrap(out); },
        nextAll: function () { var out = []; arr.forEach(function (el) { var n = el.nextElementSibling; while (n) { out.push(n); n = n.nextElementSibling; } }); return wrap(out); },
        prev: function () { var out = []; arr.forEach(function (el) { if (el.previousElementSibling) out.push(el.previousElementSibling); }); return wrap(out); },
        prevAll: function () { var out = []; arr.forEach(function (el) { var n = el.previousElementSibling; while (n) { out.push(n); n = n.previousElementSibling; } }); return wrap(out); },
        last: function () { return wrap(arr.slice(-1)); },
        slice: function (a, b) { return wrap(arr.slice(a, b)); },
        get: function (i) { return i == null ? arr.slice() : arr[i]; },
        val: function () { return arr.length && 'value' in arr[0] ? arr[0].value : ''; },
        remove: function () { arr.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }); return api; },
        text: function () { return arr.map(function (el) { return el.textContent || ''; }).join('').replace(/\s+/g, ' ').trim(); },
        html: function () { return arr.length ? arr[0].innerHTML || '' : ''; },
        attr: function (n) { return arr.length && arr[0].getAttribute ? arr[0].getAttribute(n) : null; },
        toArray: function () { return arr.slice(); },
        map: function (fn) { var out = []; arr.forEach(function (el, i) { var r = fn(i, el); if (r != null) out.push(r); }); return wrap(out); }
      };
      for (var i = 0; i < arr.length; i++) api[i] = arr[i];
      return api;
    }
    function make(html) {
      if (typeof DOMParser === 'undefined') throw new Error('cheerio unavailable (no DOMParser)');
      var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      function $(sel, ctx) {
        if (typeof sel === 'string') {
          var root = ctx && ctx.length ? (ctx[0] && ctx[0].querySelectorAll ? ctx[0] : doc) : doc;
          return wrap(root.querySelectorAll ? query(root, sel) : []);
        }
        if (sel && sel.nodeType) return wrap([sel]);
        return wrap([]);
      }
      return $;
    }
    function cheerio(html) { return make(html); }
    cheerio.load = function (html) { return make(html); };
    return cheerio;
  }
  /* tiny crypto: MD5 + SHA-256 + AES-CBC (pure JS). GCM unsupported. */
  var CryptoBox = (function () {
    function md5Bytes(bytes) {
      var K = [], i;
      for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
      var S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
      var origLen = bytes.length * 8;
      bytes.push(0x80);
      while ((bytes.length * 8) % 512 !== 448) bytes.push(0);
      for (i = 0; i < 8; i++) bytes.push((origLen / Math.pow(2, i * 8)) & 0xff);
      var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476, m;
      for (var off = 0; off < bytes.length; off += 64) {
        var A = a0, B = b0, C = c0, D = d0, M = [];
        for (i = 0; i < 16; i++) M[i] = (bytes[off + i*4] | (bytes[off + i*4+1] << 8) | (bytes[off + i*4+2] << 16) | (bytes[off + i*4+3] << 24)) >>> 0;
        for (i = 0; i < 64; i++) {
          var F, g;
          if (i < 16) { F = (B & C) | (~B & D); g = i; }
          else if (i < 32) { F = (D & B) | (~D & C); g = (5*i + 1) % 16; }
          else if (i < 48) { F = B ^ C ^ D; g = (3*i + 5) % 16; }
          else { F = C ^ (B | ~D); g = (7*i) % 16; }
          F = (F + A + K[i] + M[g]) >>> 0;
          A = D; D = C; C = B;
          B = (B + (((F << S[i]) | (F >>> (32 - S[i]))) >>> 0)) >>> 0;
        }
        a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
      }
      return hexLE([a0, b0, c0, d0]);
    }
    function hexLE(words) {
      var s = '';
      words.forEach(function (w) { for (var i = 0; i < 4; i++) s += toHex((w >>> (i*8)) & 0xff); });
      return s;
    }
    function toHex(b) { return ('0' + b.toString(16)).slice(-2); }
    function utf8(str) {
      var s = unescape(encodeURIComponent(String(str))), out = [], i;
      for (i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
      return out;
    }
    function sha256Bytes(bytes) {
      var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
      var bitLen = bytes.length * 8;
      bytes.push(0x80);
      while ((bytes.length * 8) % 512 !== 448) bytes.push(0);
      for (var i = 0; i < 8; i++) bytes.push(Math.floor(bitLen / Math.pow(2, (7 - i) * 8)) & 0xff);
      var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
      function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
      for (var off = 0; off < bytes.length; off += 64) {
        var w = [];
        for (i = 0; i < 16; i++) w[i] = ((bytes[off+i*4] << 24) | (bytes[off+i*4+1] << 16) | (bytes[off+i*4+2] << 8) | bytes[off+i*4+3]) >>> 0;
        for (i = 16; i < 64; i++) {
          var s0 = (rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3)) >>> 0;
          var s1 = (rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10)) >>> 0;
          w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
        }
        var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
        for (i = 0; i < 64; i++) {
          var S1 = (rotr(e,6) ^ rotr(e,11) ^ rotr(e,25)) >>> 0;
          var ch = ((e & f) ^ (~e & g)) >>> 0;
          var t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
          var S0 = (rotr(a,2) ^ rotr(a,13) ^ rotr(a,22)) >>> 0;
          var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
          var t2 = (S0 + maj) >>> 0;
          h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
        }
        H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
        H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
      }
      return H.map(function (x) { var s=''; for (var j=0;j<4;j++) s+=toHex((x>>>(24-j*8))&0xff); return s; }).join('');
    }
    // AES (encrypt/decrypt block) with computed S-box
    var SBOX = null, RSBOX = null;
    function gfMul(a, b) { var p = 0; for (var i = 0; i < 8; i++) { if (b & 1) p ^= a; var hi = a & 0x80; a = (a << 1) & 0xff; if (hi) a ^= 0x1b; b >>= 1; } return p; }
    function gfPow(a, e) { var r = 1; while (e) { if (e & 1) r = gfMul(r, a); a = gfMul(a, a); e >>= 1; } return r; }
    function buildSbox() {
      SBOX = []; RSBOX = [];
      for (var i = 0; i < 256; i++) {
        var inv = i === 0 ? 0 : gfPow(i, 254), s = inv, j;
        for (j = 0; j < 4; j++) s ^= ((inv << (j+1) | inv >>> (7-j)) & 0xff);
        s = (s ^ 0x63) & 0xff;
        SBOX[i] = s; RSBOX[s] = i;
      }
    }
    function aesKeyExpand(key) {
      if (!SBOX) buildSbox();
      var Nk = key.length / 4, Nr = Nk + 6, w = [], Rcon = 1, i, j, temp;
      for (i = 0; i < Nk; i++) w[i] = [key[i*4], key[i*4+1], key[i*4+2], key[i*4+3]];
      for (i = Nk; i < 4 * (Nr + 1); i++) {
        temp = w[i-1].slice();
        if (i % Nk === 0) { temp = [SBOX[temp[1]] ^ Rcon, SBOX[temp[2]], SBOX[temp[3]], SBOX[temp[0]]]; Rcon = gfMul(Rcon, 2); }
        else if (Nk > 6 && i % Nk === 4) { temp = temp.map(function (b) { return SBOX[b]; }); }
        w[i] = w[i-Nk].map(function (b, k) { return b ^ temp[k]; });
      }
      return { w: w, Nr: Nr };
    }
    // state is column-major: s[col][row]
    function addRK(s, w, r) { for (var c = 0; c < 4; c++) for (var row = 0; row < 4; row++) s[c][row] ^= w[r*4+c][row]; }
    function subBytes(s, inv) { for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) s[i][j] = inv ? RSBOX[s[i][j]] : SBOX[s[i][j]]; }
    function shiftRows(s, inv) {
      for (var r = 1; r < 4; r++) {
        var row = [s[0][r], s[1][r], s[2][r], s[3][r]], out = [];
        for (var c = 0; c < 4; c++) out[c] = row[(c + (inv ? (4 - r) : r)) % 4];
        for (c = 0; c < 4; c++) s[c][r] = out[c];
      }
    }
    function mixCols(s, inv) {
      for (var c = 0; c < 4; c++) {
        var a = [s[c][0], s[c][1], s[c][2], s[c][3]], o = [];
        if (!inv) { o[0]=gfMul(a[0],2)^gfMul(a[1],3)^a[2]^a[3]; o[1]=a[0]^gfMul(a[1],2)^gfMul(a[2],3)^a[3]; o[2]=a[0]^a[1]^gfMul(a[2],2)^gfMul(a[3],3); o[3]=gfMul(a[0],3)^a[1]^a[2]^gfMul(a[3],2); }
        else { o[0]=gfMul(a[0],14)^gfMul(a[1],11)^gfMul(a[2],13)^gfMul(a[3],9); o[1]=gfMul(a[0],9)^gfMul(a[1],14)^gfMul(a[2],11)^gfMul(a[3],13); o[2]=gfMul(a[0],13)^gfMul(a[1],9)^gfMul(a[2],14)^gfMul(a[3],11); o[3]=gfMul(a[0],11)^gfMul(a[1],13)^gfMul(a[2],9)^gfMul(a[3],14); }
        for (var r = 0; r < 4; r++) s[c][r] = o[r];
      }
    }
    function aesBlock(input, exp, inv) {
      var s = [[],[],[],[]], i, j, r;
      for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) s[i][j] = input[i*4+j];
      addRK(s, exp.w, inv ? exp.Nr : 0);
      for (r = 1; r < exp.Nr; r++) {
        if (!inv) { subBytes(s, 0); shiftRows(s, 0); mixCols(s, 0); addRK(s, exp.w, r); }
        else { addRK(s, exp.w, exp.Nr - r); mixCols(s, 1); shiftRows(s, 1); subBytes(s, 1); }
      }
      if (!inv) { subBytes(s, 0); shiftRows(s, 0); addRK(s, exp.w, exp.Nr); }
      else { addRK(s, exp.w, 0); }
      var out = [];
      for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) out[i*4+j] = s[i][j];
      return out;
    }
    function cbc(key, iv, data, decrypt) {
      if (!SBOX) buildSbox();
      var exp = aesKeyExpand(key), out = [], prev = iv.slice(), i;
      if (!decrypt) {
        var padded = data.slice(), pad = 16 - (padded.length % 16);
        for (i = 0; i < pad; i++) padded.push(pad);
        for (i = 0; i < padded.length; i += 16) {
          var blk = []; for (var j = 0; j < 16; j++) blk[j] = padded[i+j] ^ prev[j];
          var enc = aesBlock(blk, exp, false);
          out = out.concat(enc); prev = enc.slice();
        }
      } else {
        for (i = 0; i < data.length; i += 16) {
          var block = data.slice(i, i + 16);
          var dec = aesBlock(block, exp, true);
          for (var j2 = 0; j2 < 16; j2++) dec[j2] ^= prev[j2];
          out = out.concat(dec); prev = block.slice();
        }
        var p = out[out.length - 1];
        if (p >= 1 && p <= 16) out = out.slice(0, out.length - p);
      }
      return out;
    }
    function hexToBytes(hex) { var b = []; for (var i = 0; i < hex.length; i += 2) b.push(parseInt(hex.substr(i, 2), 16)); return b; }
    function bytesToHex(b) { return b.map(toHex).join(''); }
    return {
      md5: function (s) { return md5Bytes(utf8(s)); },
      sha256: function (s) { return sha256Bytes(utf8(s)); },
      md5Bytes: md5Bytes, sha256Bytes: sha256Bytes,
      aesCbcEncryptHex: function (keyHex, ivHex, dataHex) { return bytesToHex(cbc(hexToBytes(keyHex), hexToBytes(ivHex), hexToBytes(dataHex), false)); },
      aesCbcDecryptHex: function (keyHex, ivHex, dataHex) { return bytesToHex(cbc(hexToBytes(keyHex), hexToBytes(ivHex), hexToBytes(dataHex), true)); },
      aesCbcEncryptBytes: function (key, iv, data) { return cbc(key, iv, data, false); },
      aesCbcDecryptBytes: function (key, iv, data) { return cbc(key, iv, data, true); },
      aesGcm: function () { throw new Error('AES-GCM unsupported on this TV (use AES-CBC)'); }
    };
  })();

  /* ---------------- sandbox modules (require shim) ---------------- */
  function b64ToBytes(b64) {
    var bin = atob(String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '')), out = [], i;
    for (i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
    return out;
  }
  function bytesToB64(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function utf8ToBytes(str) {
    var s = unescape(encodeURIComponent(String(str))), out = [], i;
    for (i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function bytesToUtf8(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }
  function hexToBytesLocal(hex) { var b = [], i; for (i = 0; i < hex.length; i += 2) b.push(parseInt(hex.substr(i, 2), 16)); return b; }
  function bytesToHexLocal(b) { var s = '', i; for (i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2); return s; }
  function wordsFromBytes(bytes) {
    var words = [], i;
    for (i = 0; i < bytes.length; i++) words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
    return words;
  }
  function bytesFromWords(words, sigBytes) {
    var bytes = [], i;
    for (i = 0; i < sigBytes; i++) bytes.push((words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
    return bytes;
  }
  function augmentWordArray(wa) {
    wa.toString = function (enc) { return (enc && enc.stringify) ? enc.stringify(wa) : bytesToHexLocal(bytesFromWords(wa.words, wa.sigBytes)); };
    wa.concat = function (other) {
      var a = bytesFromWords(wa.words, wa.sigBytes), b = bytesFromWords(other.words || [], other.sigBytes || 0);
      return makeWordArray(a.concat(b));
    };
    wa.clone = function () { return makeWordArray(bytesFromWords(wa.words, wa.sigBytes)); };
    wa.clamp = function () { return wa; };
    return wa;
  }
  function makeWordArray(bytes) {
    return augmentWordArray({ words: wordsFromBytes(bytes), sigBytes: bytes.length });
  }
  function makeCryptoJS() {
    var enc = {
      Hex: { parse: function (s) { return makeWordArray(hexToBytesLocal(String(s))); }, stringify: function (wa) { return bytesToHexLocal(bytesFromWords(wa.words, wa.sigBytes)); } },
      Base64: { parse: function (s) { return makeWordArray(b64ToBytes(s)); }, stringify: function (wa) { return bytesToB64(bytesFromWords(wa.words, wa.sigBytes)); } },
      Utf8: { parse: function (s) { return makeWordArray(utf8ToBytes(s)); }, stringify: function (wa) { return bytesToUtf8(bytesFromWords(wa.words, wa.sigBytes)); } },
      Latin1: { parse: function (s) { var b = [], i; for (i = 0; i < s.length; i++) b.push(s.charCodeAt(i) & 0xff); return makeWordArray(b); }, stringify: function (wa) { var b = bytesFromWords(wa.words, wa.sigBytes), s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; } }
    };
    function bytesOf(wa) { return bytesFromWords(wa.words, wa.sigBytes); }
    function asWordArray(v) {
      if (v && v.words && typeof v.sigBytes === 'number') return v;
      return enc.Utf8.parse(String(v));
    }
    function md5BytesWrapped(b) { return hexToBytesLocal(CryptoBox.md5Bytes(b)); }
    function sha256BytesWrapped(b) { return hexToBytesLocal(CryptoBox.sha256Bytes(b)); }
    function hmac(hashBytes, blockSize, keyWA, msgWA) {
      var key = bytesOf(keyWA);
      if (key.length > blockSize) key = hashBytes(key);
      while (key.length < blockSize) key.push(0);
      var o = [], i = [], j;
      for (j = 0; j < blockSize; j++) { o.push(key[j] ^ 0x5c); i.push(key[j] ^ 0x36); }
      var inner = hashBytes(i.concat(bytesOf(msgWA)));
      return makeWordArray(hashBytes(o.concat(inner)));
    }
    function aesDecrypt(cipherParams, keyWA, cfg) {
      cfg = cfg || {};
      var key = asWordArray(keyWA), keyBytes = bytesOf(key);
      var ivBytes = cfg.iv ? bytesOf(asWordArray(cfg.iv)) : [];
      while (ivBytes.length < 16) ivBytes.push(0);
      var ct;
      if (typeof cipherParams === 'string') ct = b64ToBytes(cipherParams);
      else if (cipherParams && cipherParams.ciphertext) ct = bytesOf(cipherParams.ciphertext);
      else ct = bytesOf(cipherParams || {});
      return makeWordArray(CryptoBox.aesCbcDecryptBytes(keyBytes, ivBytes, ct));
    }
    function aesEncrypt(msgWA, keyWA, cfg) {
      cfg = cfg || {};
      var key = bytesOf(asWordArray(keyWA)), iv = cfg.iv ? bytesOf(asWordArray(cfg.iv)) : [];
      while (iv.length < 16) iv.push(0);
      return { ciphertext: makeWordArray(CryptoBox.aesCbcEncryptBytes(key, iv, bytesOf(msgWA))) };
    }
    return {
      enc: enc,
      mode: { CBC: { name: 'CBC' } },
      pad: { Pkcs7: { name: 'Pkcs7' } },
      lib: {
        WordArray: {
          create: function (input, sigBytes) {
            if (Array.isArray(input)) {
              if (sigBytes != null) return augmentWordArray({ words: input.slice(), sigBytes: sigBytes });
              return makeWordArray(input);
            }
            return makeWordArray([]);
          }
        }
      },
      MD5: function (s) { return makeWordArray(hexToBytesLocal(CryptoBox.md5(String(s)))); },
      SHA256: function (s) { return makeWordArray(hexToBytesLocal(CryptoBox.sha256(String(s)))); },
      HmacMD5: function (key, msg) {
        return hmac(md5BytesWrapped, 64, asWordArray(key), asWordArray(msg));
      },
      HmacSHA256: function (key, msg) {
        return hmac(sha256BytesWrapped, 64, asWordArray(key), asWordArray(msg));
      },
      AES: { decrypt: aesDecrypt, encrypt: aesEncrypt },
      TripleDES: { decrypt: function () { throw new Error('TripleDES is not supported on this TV'); }, encrypt: function () { throw new Error('TripleDES is not supported on this TV'); } }
    };
  }
  function makeURLSearchParams() {
    function USP(init) {
      this._p = [];
      if (typeof init === 'string') {
        var parts = init.replace(/^\?/, '').split('&'), i;
        for (i = 0; i < parts.length; i++) {
          if (!parts[i]) continue;
          var kv = parts[i].split('=');
          this._p.push([decodeURIComponent(kv[0] || ''), decodeURIComponent(kv.slice(1).join('=') || '')]);
        }
      } else if (init && typeof init === 'object') {
        var keys = Object.keys(init), k;
        for (k = 0; k < keys.length; k++) this._p.push([keys[k], String(init[keys[k]])]);
      }
    }
    USP.prototype.append = function (k, v) { this._p.push([String(k), String(v)]); };
    USP.prototype.set = function (k, v) { this['delete'](k); this.append(k, v); };
    USP.prototype.get = function (k) { for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === k) return this._p[i][1]; return null; };
    USP.prototype['delete'] = function (k) { this._p = this._p.filter(function (p) { return p[0] !== k; }); };
    USP.prototype.has = function (k) { return this.get(k) !== null; };
    USP.prototype.toString = function () { return this._p.map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); }).join('&'); };
    return USP;
  }
  function makeBuffer() {
    function Buf(bytes) { this.bytes = bytes || []; }
    Buf.from = function (v, enc) {
      if (typeof v === 'string') {
        if (enc === 'base64') return new Buf(b64ToBytes(v));
        if (enc === 'hex') return new Buf(hexToBytesLocal(v));
        return new Buf(utf8ToBytes(v));
      }
      if (Array.isArray(v)) return new Buf(v.slice());
      if (v && v.bytes) return new Buf(v.bytes.slice());
      return new Buf([]);
    };
    Buf.prototype.toString = function (enc) {
      if (enc === 'base64') return bytesToB64(this.bytes);
      if (enc === 'hex') return bytesToHexLocal(this.bytes);
      return bytesToUtf8(this.bytes);
    };
    return Buf;
  }
  function makeTextDecoder() {
    function TD() {}
    TD.prototype.decode = function (buf) { return bytesToUtf8(buf && buf.bytes ? buf.bytes : buf || []); };
    return TD;
  }
  function makeRequire() {
    var cheerio = cheerioFactory();
    // callable module + ES-module interop: require('cheerio').load(), .default.load(), or cheerio()
    var cheerioModule = cheerio;
    cheerioModule['default'] = cheerioModule;
    cheerioModule.load = cheerio.load;
    cheerioModule.__esModule = true;
    var cryptoModule = makeCryptoJS();
    var USPS = makeURLSearchParams();
    return function require(name) {
      var n = String(name || '');
      if (n === 'cheerio' || n === 'cheerio-without-node-native' || n.indexOf('cheerio') === 0) return cheerioModule;
      if (n === 'crypto-js' || n === 'crypto') return cryptoModule;
      throw new Error('module "' + n + '" is not available in the TV sandbox');
    };
  }

  /* ---------------- sandbox exec ---------------- */
  function execPlugin(scraper, logs) {
    // Re-transform cached plugins after an app update (transformer improvements)
    if (scraper.code && (!scraper.transformed || scraper.tv !== TRANSFORM_VERSION)) {
      var fresh = transformSource(scraper.code);
      if (fresh.error) throw new Error('transform failed: ' + fresh.error);
      scraper.transformed = fresh.code;
      scraper.tv = TRANSFORM_VERSION;
      scraper.error = '';
      saveCode(scraper);
    }
    var code = scraper.transformed || scraper.code;
    if (!code) throw new Error('plugin not downloaded');
    if (scraper.error && scraper.error.indexOf('transform failed') === 0) throw new Error(scraper.error);
    var exportsObj = {};
    var moduleObj = { exports: exportsObj };
    var fakeConsole = {
      log: function () { logs.push(Array.prototype.slice.call(arguments).join(' ')); },
      warn: function () { logs.push(Array.prototype.slice.call(arguments).join(' ')); },
      error: function () { logs.push(Array.prototype.slice.call(arguments).join(' ')); }
    };
    var sandboxGlobal = {};
    var discovery = '\n;try{if(typeof getStreams!=="undefined")exports.getStreams=getStreams;}catch(e){}' +
      '\n;try{if(typeof getStreamsAsync!=="undefined")exports.getStreams=getStreamsAsync;}catch(e){}' +
      '\n;try{if(typeof fetchStreams!=="undefined")exports.getStreams=fetchStreams;}catch(e){}' +
      '\n;try{if(typeof resolveStream!=="undefined")exports.getStreams=resolveStream;}catch(e){}' +
      '\n;try{if(module.exports&&typeof module.exports==="function"){if(!exports.getStreams)exports.getStreams=module.exports;}}catch(e){}' +
      '\n;try{if(module.exports&&module.exports.getStreams)exports.getStreams=module.exports.getStreams;}catch(e){}' +
      '\n;try{if(module.exports&&module.exports.default)exports.getStreams=module.exports.default;}catch(e){}' +
      '\n;try{if(typeof exports.getStreams==="undefined"&&typeof getStreamsFor!="undefined")exports.getStreams=getStreamsFor;}catch(e){}';
    var wrapper = new Function('exports', 'module', 'require', 'fetch', 'console', 'setTimeout', 'clearTimeout',
      'atob', 'btoa', 'URLSearchParams', 'Buffer', 'TextDecoder', 'URL', 'globalThis', 'global', 'self',
      "'use strict';\nvar window,document,process,XMLHttpRequest,WebSocket;\n" +
      code + discovery);
    wrapper(exportsObj, moduleObj, makeRequire(), shimFetch, fakeConsole, setTimeout, clearTimeout,
      atob, btoa, makeURLSearchParams(), makeBuffer(), makeTextDecoder(), (typeof URL !== 'undefined' ? URL : null),
      sandboxGlobal, sandboxGlobal, sandboxGlobal);
    var entry = exportsObj.getStreams || moduleObj.exports.getStreams || moduleObj.exports.default || moduleObj.exports;
    if (typeof entry !== 'function') throw new Error('no getStreams entry found');
    return wrapEntry(entry);
  }
  function normalizeResults(raw, providerId) {
    var out = [];
    if (!raw) return out;
    var list = Array.isArray(raw) ? raw : (raw.streams || raw.results || raw.urls || []);
    if (typeof raw === 'string') list = [raw];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (typeof r === 'string') r = { url: r };
      if (!r || !r.url || !Util.isHttp(r.url)) continue;
      if (/\.(torrent|magnet)$/i.test(r.url)) continue;
      out.push({
        url: String(r.url), name: String(r.name || r.title || providerId),
        title: String(r.title || r.name || ''), quality: String(r.quality || ''),
        headers: (r.headers && typeof r.headers === 'object') ? r.headers : {},
        provider: providerId
      });
    }
    return out;
  }
  function runPlugin(id, ctx) {
    ctx = ctx || {};
    var task = function () {
      return new Promise(function (resolve) {
        var list = getScrapers(), scraper = null, i;
        for (i = 0; i < list.length; i++) if (list[i].id === id) scraper = list[i];
        var logs = [], t0 = Date.now();
        function done(result) { result.ms = Date.now() - t0; result.logs = logs; resolve(result); }
        if (!scraper) return done({ ok: false, error: 'not installed', results: [] });
        if (!scraper.enabled) return done({ ok: false, error: 'disabled', results: [] });
        var types = scraper.supportedTypes || ['movie', 'series'];
        if (types.indexOf(ctx.mediaType || 'movie') === -1 && types.indexOf('all') === -1) {
          return done({ ok: false, error: 'unsupported type', results: [] });
        }
        var entry;
        try { entry = execPlugin(scraper, logs); }
        catch (e) { return done({ ok: false, error: String((e && e.message) || e), results: [] }); }
        var timer = setTimeout(function () { done({ ok: false, error: 'timeout after 8s', results: [] }); }, RUN_TIMEOUT);
        var finished = false;
        function finishOnce(r) { if (!finished) { finished = true; clearTimeout(timer); done(r); } }
        Promise.resolve().then(function () {
          return entry(ctx.tmdbId || ctx.id || '', ctx.mediaType || 'movie', ctx.season || 1, ctx.episode || 1);
        }).then(function (raw) {
          finishOnce({ ok: true, results: normalizeResults(raw, id), raw: raw });
        }, function (err) {
          finishOnce({ ok: false, error: String((err && err.message) || err), results: [] });
        });
      });
    };
    // serialize: one at a time
    var p = runChain.then(task, task);
    runChain = p.then(function () {}, function () {});
    return p;
  }
  function runAllEnabled(ctx, onEach, onDone) {
    var list = getScrapers().filter(function (s) { return s.enabled; });
    var i = 0;
    function next() {
      if (i >= list.length) { if (onDone) onDone(); return; }
      var s = list[i++];
      runPlugin(s.id, ctx).then(function (res) {
        onEach(s, res);
        next();
      });
    }
    if (!list.length) { if (onDone) onDone(); return; }
    next();
  }

  return {
    getRepos: getRepos, getScrapers: getScrapers, addRepo: addRepo, removeRepo: removeRepo,
    downloadScraper: downloadScraper, refreshScraper: refreshScraper, removeScraper: removeScraper,
    setEnabled: setEnabled, runPlugin: runPlugin, runAllEnabled: runAllEnabled,
    normalizeResults: normalizeResults, transformSource: transformSource, execPlugin: execPlugin,
    _crypto: CryptoBox, _drive: drive, _hash: hashStr
  };
})();
