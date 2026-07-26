"use strict";

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const androidEnv = require(path.join(__dirname, '..', '..', 'util', 'android-env'));

const { commandAvailable } = androidEnv;

function runCmd(cmd, env, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  execSync(cmd, { stdio: 'inherit', shell: true, env: env || process.env });
}

function runDeviceCmd(cmd, env, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  try {
    execSync(cmd, { stdio: 'inherit', shell: true, env: env || process.env });
  } catch (err) {
    console.error('\nDevice install/launch failed. If the device itself looks fine, this is usually an unstable USB/adb connection.');
    console.error('Try: keep the device unlocked, reconnect the USB cable (avoid hubs/adapters), or run `adb kill-server` to clear a stuck session.');
    throw err;
  }
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

  let sdkRoot = androidEnv.resolveAndroidSdkRoot();
  const gradlewMissing = !fs.existsSync(path.resolve('platforms', 'android', 'tools', 'gradlew'));
  const toolchainIncomplete = !sdkRoot || !androidEnv.resolveJavaHome() || !commandAvailable('gradle') || gradlewMissing;

  if (toolchainIncomplete) {
    console.log('Android toolchain incomplete — running full bootstrap to reach a working state...');
    const bootstrapAndroid = require(path.join(__dirname, '..', 'bootstrap', 'android'));
    bootstrapAndroid.ensureToolchain(dryRun, false);
    sdkRoot = androidEnv.resolveAndroidSdkRoot();
  }

  const env = androidEnv.buildEnv(sdkRoot);
  console.log(sdkRoot ? 'Using Android SDK at ' + sdkRoot : 'Android SDK still not found');
  console.log(env.JAVA_HOME ? 'Using JAVA_HOME=' + env.JAVA_HOME : 'No JDK found');
  Object.assign(process.env, env);

  const wantsDevice = args && (args.indexOf('--device') !== -1 || args.indexOf('-d') !== -1);
  const wantsEmulator = args && (args.indexOf('--emulator') !== -1 || args.indexOf('-e') !== -1);

  let useDevice = false;
  if (wantsDevice) {
    useDevice = true;
    console.log('Targeting a physical device (--device)');
  } else if (wantsEmulator) {
    useDevice = false;
    console.log('Targeting the emulator (--emulator)');
  } else {
    useDevice = detectPhysicalDevice();
    console.log(useDevice
      ? 'Physical Android device detected — running on device. Pass --emulator to force the emulator.'
      : 'No physical Android device detected — running on the emulator. Pass --device to force a physical device.');
  }

  // Resolve --target <avd> or pick a default
  let target = null;
  const targetIdx = args ? args.indexOf('--target') : -1;
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    target = args[targetIdx + 1];
  }

  if (!useDevice && !target) {
    const avds = androidEnv.listAvds(sdkRoot, env);
    if (avds.length > 0) {
      target = avds[avds.length - 1];
      console.log('Auto-selected AVD: ' + target);
    } else {
      console.warn('No AVD found — an emulator run will fail. Create one with `na bootstrap android`, or connect a physical device and pass --device.');
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

  if (useDevice) {
    runDeviceCmd(cmd, env, dryRun);
  } else {
    runCmd(cmd, env, dryRun);
  }
}

function usage() {
  console.log('Usage: na run android [--device|--emulator] [--target <avd>] [--dry-run] [--no-build]');
  console.log('If neither --device nor --emulator is provided the command auto-detects a connected device; otherwise it runs on an emulator.');
  console.log('--target <avd>  Override the AVD to use (default: highest API level AVD available)');
  console.log('Automatically installs/repairs the Android toolchain (JDK, SDK, gradle, AVD) if anything required is missing.');
}

module.exports = { run, usage };
