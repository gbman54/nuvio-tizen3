// ES5 checker: fails build on ES6+ syntax. No deps.
'use strict';
var fs = require('fs'), path = require('path');
var dirs = ['src/js', 'scripts'];
var forbidden = [
  { re: /=>/, msg: 'arrow function' },
  { re: /\bclass\s+\w+/, msg: 'class' },
  { re: /\bconst\s+\w+/, msg: 'const' },
  { re: /\blet\s+\w+/, msg: 'let' },
  { re: /`/, msg: 'template literal (backtick)' },
  { re: /[(\[,]\s*\.\.\./, msg: 'spread/rest (...)' },
  { re: /\basync\s+function/, msg: 'async function' },
  { re: /\bawait\s/, msg: 'await' },
  { re: /\?\./, msg: 'optional chaining (?.)' },
  { re: /Object\.(entries|values|fromEntries)\s*\(/, msg: 'Object.entries/values/fromEntries' },
  { re: /\.padStart\s*\(/, msg: 'String.padStart (polyfill instead)' },
  { re: /\bfetch\s*\(/, msg: 'fetch' },
  { re: /\bnew\s+URL\s*\(/, msg: 'new URL' },
  { re: /\bURLSearchParams\b/, msg: 'URLSearchParams' },
  { re: /\.includes\s*\(/, msg: 'Array.includes (polyfill instead)' },
  { re: /\.find\s*\(/, msg: 'Array.find (polyfill instead)' },
  { re: /\bimport\s+/, msg: 'import' },
  { re: /\bexport\s+(default|const|function|class)/, msg: 'export' }
];
// allow polyfill file to define padStart/entries/values/includes/find
var allowlist = ['00-polyfill.js', 'check-es5.js'];
var failed = false;
function walk(dir) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f);
    var st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.js$/.test(f)) check(p);
  });
}
// strip string literals and comments so '=>' / backticks inside strings don't false-positive
function stripStrings(src) {
  var out = '', i = 0;
  function skipStr(q) { var j = i + 1; while (j < src.length) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === q) return j + 1; j++; } return src.length; }
  while (i < src.length) {
    var c = src[i];
    if (c === '"' || c === "'" || c === '`') { i = skipStr(c); out += '""'; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && src[i] !== '*') i++; i += 2; continue; }
    if (c === '/' && src[i + 1] !== '/' && src[i + 1] !== '*') {
      // regex literal: skip it so '=>' / quotes inside a pattern don't false-positive
      var prev = out.replace(/\s+$/, '').slice(-1);
      if (i === 0 || /[=(:,\[!&|?{};+\-*%<>]/.test(prev) || /(return|typeof|case)$/.test(out.replace(/\s+$/, ''))) {
        var j = i + 1, inClass = false;
        while (j < src.length) {
          var ch = src[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) { j++; break; }
          else if (ch === '\n') break;
          j++;
        }
        if (j > i + 1 && src[j - 1] === '/') { out += '/regex/'; i = j; continue; }
      }
    }
    out += c; i++;
  }
  return out;
}
function check(file) {
  var src = fs.readFileSync(file, 'utf8');
  var stripped = stripStrings(src);
  var base = path.basename(file);
  var lines = stripped.split('\n');
  lines.forEach(function (line, i) {
    var trimmed = line.trim();
    if (allowlist.indexOf(base) !== -1 && /padStart|Object\.entries|Object\.values|prototype\.find|prototype\.includes/.test(trimmed)) return;
    if (/^\s*\/\//.test(trimmed)) return;
    forbidden.forEach(function (rule) {
      if (rule.re.test(line)) {
        // allow .find( inside polyfill only
        if (allowlist.indexOf(base) !== -1) return;
        console.error(file + ':' + (i + 1) + ': ' + rule.msg + ' :: ' + trimmed.slice(0, 100));
        failed = true;
      }
    });
  });
  // syntax check with vm (ES5 parse via Function constructor catches some ES6? use acorn-free: node --check handles ES6, so instead use Function)
  try { new Function(src); } catch (e) { /* Function allows ES6 syntax, ignore */ }
}
dirs.forEach(function (d) { if (fs.existsSync(d)) walk(d); });
if (failed) { console.error('ES5 check FAILED'); process.exit(1); }
console.log('ES5 check passed');
