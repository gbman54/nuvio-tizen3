'use strict';
// Signs WGT via tizen CLI. Requires: tizen CLI, Samsung certs, security profile.
// Usage: npm run package -- --profile="MyProfile" --build="build-out"
var cp = require('child_process'), fs = require('fs'), path = require('path');
var args = process.argv.slice(2);
var profile = null, buildDir = 'build-out';
for (var i = 0; i < args.length; i++) {
  if (args[i].indexOf('--profile=') === 0) profile = args[i].slice(10);
  if (args[i].indexOf('--build=') === 0) buildDir = args[i].slice(8);
}
if (!profile) { console.error('Missing --profile="<security-profile>". See README: Certificate Manager -> create author+distributor certs -> tizen security-profiles add.'); process.exit(1); }
// stage build dir with forward-slash paths (zip entries must use /)
if (fs.existsSync(buildDir)) { /* keep */ } else fs.mkdirSync(buildDir, { recursive: true });
function copy(src, dst) {
  var s = fs.statSync(src);
  if (s.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); fs.readdirSync(src).forEach(function (f) { copy(path.join(src, f), path.join(dst, f)); }); }
  else fs.copyFileSync(src, dst);
}
['index.html', 'config.xml', 'icon.png', 'icon_launcher.png'].forEach(function (f) { if (fs.existsSync(f)) copy(f, path.join(buildDir, f)); });
copy('src', path.join(buildDir, 'src'));
console.log('Staged in ' + buildDir);
var cmd = 'tizen package -t wgt -s "' + profile + '" -- "' + buildDir + '"';
console.log(cmd);
var r = cp.spawnSync('tizen', ['package', '-t', 'wgt', '-s', profile, '--', buildDir], { stdio: 'inherit' });
if (r.status !== 0) { console.error('tizen package failed. Ensure tizen CLI on PATH and certs configured.'); process.exit(1); }
console.log('WGT created in current dir / ' + buildDir);
