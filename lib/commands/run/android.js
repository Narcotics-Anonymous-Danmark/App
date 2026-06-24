"use strict";

const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');

function runCmd(cmd, env, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  execSync(cmd, { stdio: 'inherit', shell: true, env: env || process.env });
}

function commandAvailable(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: true });
    return true;
  } catch (_) {
    return false;
  }
}

function resolveAndroidSdkRoot() {
  if (process.env.ANDROID_SDK_ROOT) return process.env.ANDROID_SDK_ROOT;
  if (process.env.ANDROID_HOME) return process.env.ANDROID_HOME;
  const fallback = path.join(os.homedir(), 'AndroidSDK');
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function buildEnv(sdkRoot) {
  if (!sdkRoot) return process.env;
  return Object.assign({}, process.env, { ANDROID_SDK_ROOT: sdkRoot });
}

function detectPhysicalDevice() {
  if (!commandAvailable('adb')) return false;
  try {
    const out = execSync('adb devices', { encoding: 'utf8', shell: true });
    // Each connected device appears as a line after "List of devices attached"
    // Lines ending with "device" (not "emulator") indicate a physical device
    const lines = out.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
    return lines.some(l => l.endsWith('\tdevice') && !l.startsWith('emulator-'));
  } catch (_) {
    return false;
  }
}

function listAvds() {
  if (!commandAvailable('emulator')) return [];
  try {
    const out = execSync('emulator -list-avds', { encoding: 'utf8', shell: true });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
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
  const wwwDir = path.resolve('www');
  if (!fs.existsSync(wwwDir)) return true;

  const srcTime = newestMtime(path.resolve('src'), ['.ts', '.html', '.scss', '.css', '.json']);
  const assetsTime = newestMtime(path.resolve('src', 'assets'));
  const configTime = Math.max(newestMtime(path.resolve('.'), ['.json', '.xml']), 0);
  const wwwTime = newestMtime(wwwDir);

  return (srcTime > wwwTime) || (assetsTime > wwwTime) || (configTime > wwwTime);
}

function run(args) {
  const dryRun = args && args.indexOf('--dry-run') !== -1;

  const wantsDevice = args && (args.indexOf('--device') !== -1 || args.indexOf('-d') !== -1);
  const wantsEmulator = args && (args.indexOf('--emulator') !== -1 || args.indexOf('-e') !== -1);

  let useDevice = false;
  if (wantsDevice) useDevice = true;
  else if (wantsEmulator) useDevice = false;
  else useDevice = detectPhysicalDevice();

  const sdkRoot = resolveAndroidSdkRoot();
  if (!sdkRoot) {
    console.warn('ANDROID_SDK_ROOT not found — set ANDROID_SDK_ROOT or ANDROID_HOME, or place the SDK at ~/AndroidSDK');
  }
  const env = buildEnv(sdkRoot);

  // Resolve --target <avd> or pick a default
  let target = null;
  const targetIdx = args ? args.indexOf('--target') : -1;
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    target = args[targetIdx + 1];
  }

  if (!useDevice && !target) {
    const avds = listAvds();
    if (avds.length > 0) {
      // Prefer the highest API level (last alphabetically among android-N names)
      target = avds[avds.length - 1];
      console.log('Auto-selected AVD: ' + target);
    }
  }

  const skipBuild = args && args.indexOf('--no-build') !== -1;
  if (!skipBuild && needsBuild()) {
    runCmd('ionic build', env, dryRun);
  }

  let cmd = 'cordova run android';
  if (useDevice) {
    cmd += ' --device';
  } else {
    cmd += ' --emulator';
    if (target) cmd += ' --target=' + target;
  }

  runCmd(cmd, env, dryRun);
}

function usage() {
  console.log('Usage: na run android [--device|--emulator] [--target <avd>] [--dry-run] [--no-build]');
  console.log('If neither --device nor --emulator is provided the command auto-detects a connected device; otherwise it runs on an emulator.');
  console.log('--target <avd>  Override the AVD to use (default: highest API level AVD available)');
}

module.exports = { run, usage };
