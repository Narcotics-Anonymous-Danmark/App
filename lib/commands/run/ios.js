"use strict";

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

function runCmd(cmd, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function commandAvailable(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: true });
    return true;
  } catch (_) {
    return false;
  }
}

function detectPhysicalDevice() {
  // Prefer libimobiledevice if available
  try {
    if (commandAvailable('idevice_id')) {
      const out = execSync('idevice_id -l', { encoding: 'utf8', shell: true }).trim();
      return out.length > 0;
    }

    // Fallback to xcrun listing — look for entries that look like physical devices
    if (commandAvailable('xcrun')) {
      const out = execSync('xcrun xctrace list devices', { encoding: 'utf8', shell: true });
      // Lines containing "Simulator" are simulators. Physical devices typically contain a UUID in parentheses and no "Simulator".
      const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
      for (const l of lines) {
        if (!/Simulator/.test(l) && /\(|\)/.test(l) && /iPhone|iPad|iPod/.test(l)) return true;
      }
    }
  } catch (_) {
    // ignore errors and assume no physical device
  }
  return false;
}

// No bootstrapping here by design. Build is done only if sources changed.
function newestMtime(dir, exts) {
  let newest = 0;
  if (!fs.existsSync(dir)) return 0;
  const stack = [dir];
  while (stack.length) {
    const p = stack.pop();
    const entries = fs.readdirSync(p);
    for (const e of entries) {
      const full = path.join(p, e);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else {
        if (!exts || exts.length === 0) {
          newest = Math.max(newest, stat.mtimeMs);
        } else {
          for (const ex of exts) if (full.endsWith(ex)) newest = Math.max(newest, stat.mtimeMs);
        }
      }
    }
  }
  return newest;
}

function needsBuild() {
  // If no www exists, build needed
  const wwwDir = path.resolve('www');
  if (!fs.existsSync(wwwDir)) return true;

  // Compare latest src/ and config/ files against www/
  const srcTime = newestMtime(path.resolve('src'), ['.ts', '.html', '.scss', '.css', '.json']);
  const assetsTime = newestMtime(path.resolve('src', 'assets'));
  const configTime = Math.max(newestMtime(path.resolve('.'), ['.json', '.xml']), 0);
  const wwwTime = newestMtime(wwwDir);

  return (srcTime > wwwTime) || (assetsTime > wwwTime) || (configTime > wwwTime);
}

function run(args) {
  const dryRun = args && args.indexOf('--dry-run') !== -1;

  // Decide whether to run on device or emulator
  const wantsDevice = args && (args.indexOf('--device') !== -1 || args.indexOf('-d') !== -1);
  const wantsEmulator = args && (args.indexOf('--emulator') !== -1 || args.indexOf('-e') !== -1);

  let useDevice = false;
  if (wantsDevice) useDevice = true;
  else if (wantsEmulator) useDevice = false;
  else useDevice = detectPhysicalDevice();

  // Build only when needed (sources newer than www) unless user passes --no-build
  const skipBuild = args && args.indexOf('--no-build') !== -1;
  if (!skipBuild && needsBuild()) {
    runCmd('ionic build', dryRun);
  }

  let cmd = 'cordova run ios';
  cmd += useDevice ? ' --device' : ' --emulator';
  if (args && args.indexOf('--no-native-run') !== -1) cmd += ' --no-native-run';

  runCmd(cmd, dryRun);
}

function usage() {
  console.log('Usage: na run ios [--device|--emulator] [--dry-run] [--no-native-run]');
  console.log('If neither --device nor --emulator is provided the command will auto-detect a connected device and use it; otherwise it runs on the simulator.');
}

module.exports = { run, usage };
