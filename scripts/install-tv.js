'use strict';
// Install + launch Nuvio Lite on a Samsung TV (Tizen 3.0) over sdb.
// Usage: node scripts/install-tv.js --ip=<TV_IP> [--wgt="build-out/Nuvio Lite.wgt"]
// Requires: sdb + tizen on PATH (Tizen Studio), a signed WGT.
var cp = require('child_process'), fs = require('fs'), path = require('path');

var APP_ID = 'nuvio12345.nuviolite';
var REMOTE = '/home/owner/share/tmp/sdk_tools/tmp/nuvio.wgt';

var args = process.argv.slice(2);
var ip = null, wgt = 'build-out/Nuvio Lite.wgt';
for (var i = 0; i < args.length; i++) {
  if (args[i].indexOf('--ip=') === 0) ip = args[i].slice(5);
  if (args[i].indexOf('--wgt=') === 0) wgt = args[i].slice(6);
}
if (!ip) { console.error('Usage: --ip=<TV_IP> [--wgt=<file.wgt>]'); process.exit(1); }
if (!fs.existsSync(wgt)) { console.error('WGT not found: ' + wgt + ' (run npm run package first)'); process.exit(1); }

function run(cmd, a, allowFail) {
  console.log('+ ' + cmd + ' ' + a.join(' '));
  var r = cp.spawnSync(cmd, a, { stdio: 'inherit' });
  if (r.status !== 0 && !allowFail) process.exit(1);
  return r.status;
}

// 1) connect
run('sdb', ['connect', ip + ':26101'], true);

// 2) push (install channel is shell-restricted on retail TVs; push works)
run('sdb', ['-s', ip + ':26101', 'push', wgt, REMOTE]);

// 3) install via the whitelisted TV command
run('sdb', ['-s', ip + ':26101', 'shell', '0', 'vd_appinstall', APP_ID, REMOTE]);

// 4) launch
run('tizen', ['run', '-p', APP_ID, '-s', ip + ':26101'], true);
console.log('Done. "Nuvio Lite" is installed (app id ' + APP_ID + ').');
