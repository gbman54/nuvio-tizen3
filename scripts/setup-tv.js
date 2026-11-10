'use strict';
// One-command TV bring-up for Tizen 3.0 TVs: cert profile -> build -> sign -> install -> launch.
// Usage: node scripts/setup-tv.js --ip=<TV_IP> [--profile=NuvioTV]
// The author-certificate password is read from NUVIO_CERT_PASS; it is never stored in this repo.
var cp = require('child_process'), fs = require('fs'), path = require('path');

var APP_ID = 'nuvio12345.nuviolite';
var AUTHOR_ID = 'nuvio12345';           // must be 10 chars: TV rejects shorter prefixes
var REMOTE = '/home/owner/share/tmp/sdk_tools/tmp/nuvio.wgt';
var PASSWORD = process.env.NUVIO_CERT_PASS || '';

var args = process.argv.slice(2);
var ip = null, profile = 'NuvioTV';
for (var i = 0; i < args.length; i++) {
  if (args[i].indexOf('--ip=') === 0) ip = args[i].slice(5);
  if (args[i].indexOf('--profile=') === 0) profile = args[i].slice(10);
}
if (!ip) { console.error('Usage: --ip=<TV_IP> [--profile=NuvioTV]  (set NUVIO_CERT_PASS for new certificates)'); process.exit(1); }
if (!PASSWORD) { console.error('ERROR: set NUVIO_CERT_PASS to the author-certificate password.'); process.exit(1); }

function which(cmd) { try { return cp.spawnSync('which', [cmd]).status === 0; } catch (e) { return false; } }
if (!which('tizen')) {
  var cand = [process.env.HOME + '/tizen-studio/tools/ide/bin', '/opt/tizen-studio/tools/ide/bin'];
  for (var ci = 0; ci < cand.length; ci++) if (fs.existsSync(cand[ci] + '/tizen')) { process.env.PATH = cand[ci] + ':' + process.env.PATH; break; }
}
if (!which('tizen') || !which('sdb')) {
  console.error('ERROR: tizen/sdb not found. Install Tizen Studio CLI first.');
  process.exit(1);
}

function run(cmd, a, allowFail) {
  console.log('+ ' + cmd + ' ' + a.join(' '));
  var r = cp.spawnSync(cmd, a, { stdio: 'inherit' });
  if (r.status !== 0 && !allowFail) process.exit(1);
}

// 1) Author certificate (10-char alias)
var authorP12 = process.env.HOME + '/tizen-studio-data/keystore/author/' + AUTHOR_ID + '.p12';
if (!fs.existsSync(authorP12)) {
  console.log('--- creating author certificate ---');
  run('tizen', ['certificate', '-a', AUTHOR_ID, '-p', PASSWORD, '-c', 'US', '-s', 'California',
    '-ct', 'Los Angeles', '-o', 'Nuvio', '-u', 'Dev', '-n', 'Nuvio Lite',
    '-e', 'dev@nuvio.local', '-f', AUTHOR_ID], true);
}

// 2) Signing profile with the SDK PUBLIC distributor (the Samsung cert chain is rejected on Tizen 3.0)
var sdk = process.env.HOME + '/tizen-studio/tools/certificate-generator/certificates/distributor/sdk-public';
if (!fs.existsSync(process.env.HOME + '/tizen-studio-data/profile/profiles.xml')) {
  var cfg = process.env.HOME + '/tizen-studio/tools/ide/conf-ncli/profiles.xml';
  if (fs.existsSync(cfg)) { fs.mkdirSync(process.env.HOME + '/tizen-studio-data/profile', { recursive: true }); fs.copyFileSync(cfg, process.env.HOME + '/tizen-studio-data/profile/profiles.xml'); }
}
if (fs.existsSync(authorP12)) {
  console.log('--- registering signing profile (public distributor) ---');
  run('tizen', ['security-profiles', 'add', '-n', profile, '-a', authorP12, '-p', PASSWORD,
    '-c', sdk + '/tizen-distributor-ca.cer', '-d', sdk + '/tizen-distributor-signer.p12',
    '-dp', 'tizenpkcs12passfordsigner'], true);
  run('tizen', ['cli-config', 'profiles.path=' + process.env.HOME + '/tizen-studio-data/profile/profiles.xml'], true);
}

// 3) Stage + package
console.log('--- packaging ---');
var buildDir = 'build-out';
if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });
function copy(src, dst) {
  var s = fs.statSync(src);
  if (s.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); fs.readdirSync(src).forEach(function (f) { copy(path.join(src, f), path.join(dst, f)); }); }
  else fs.copyFileSync(src, dst);
}
['index.html', 'config.xml', 'icon.png', 'icon_launcher.png'].forEach(function (f) { copy(f, path.join(buildDir, f)); });
copy('src', path.join(buildDir, 'src'));
if (fs.existsSync('assets')) copy('assets', path.join(buildDir, 'assets'));
run('tizen', ['package', '-t', 'wgt', '-s', profile, '--', buildDir]);

// 4) Install + launch
var wgt = path.join(buildDir, 'Nuvio Lite.wgt');
console.log('--- install ---');
run('sdb', ['connect', ip + ':26101'], true);
run('sdb', ['-s', ip + ':26101', 'push', wgt, REMOTE]);
run('sdb', ['-s', ip + ':26101', 'shell', '0', 'vd_appinstall', APP_ID, REMOTE]);
run('tizen', ['run', '-p', APP_ID, '-s', ip + ':26101'], true);
console.log('DONE. Nuvio Lite installed and launched.');
