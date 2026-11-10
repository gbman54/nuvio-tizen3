'use strict';
var fs = require('fs'), path = require('path'), cp = require('child_process');
console.log('Nuvio Lite build');
var r = cp.spawnSync(process.execPath, ['scripts/check-es5.js'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);
// verify required files
var required = ['index.html', 'config.xml', 'src/css/app.css'];
var jsFiles = fs.readdirSync('src/js').filter(function (f) { return /\.js$/.test(f); }).sort();
required.forEach(function (f) { if (!fs.existsSync(f)) { console.error('missing ' + f); process.exit(1); } });
jsFiles.forEach(function (f) { if (!fs.existsSync(path.join('src/js', f))) { console.error('missing js ' + f); process.exit(1); } });
console.log('build ok, ' + jsFiles.length + ' js files');
// Version parity: config.xml and the About string must match, or the TV shows a stale version.
var cfgVersion = (fs.readFileSync('config.xml', 'utf8').match(/version="([0-9]+\.[0-9]+\.[0-9]+)"/) || [])[1];
var viewsSrc = fs.readFileSync('src/js/09-views.js', 'utf8');
var aboutVersion = (viewsSrc.match(/\)\s*\+\s*'\s*([0-9]+\.[0-9]+\.[0-9]+)\s*·/) || [])[1];
if (!cfgVersion || !aboutVersion) {
  console.error('version check failed: could not read config.xml or About version');
  process.exit(1);
}
if (cfgVersion !== aboutVersion) {
  console.error('version mismatch: config.xml=' + cfgVersion + ' About=' + aboutVersion + ' (bump both)');
  process.exit(1);
}
console.log('version ' + cfgVersion + ' (config.xml + About match)');
// size report
var total = 0;
['index.html', 'config.xml'].concat(jsFiles.map(function (f) { return 'src/js/' + f; }), ['src/css/app.css']).forEach(function (f) {
  total += fs.statSync(f).size;
});
console.log('package source size: ' + (total / 1024).toFixed(1) + ' KB (target <500 KB)');
if (total > 500 * 1024) { console.error('WARNING: over 500 KB'); }
console.log('Run: npm run package  (requires tizen CLI + Samsung certs)');
