"use strict";

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

function runCmd(cmd, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function runSoftCmd(cmd, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  try {
    execSync(cmd, { stdio: 'inherit', shell: true });
  } catch (_) {
  }
}

function runDeviceCmd(cmd, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  try {
    execSync(cmd, { stdio: 'inherit', shell: true });
  } catch (err) {
    console.error('\nDevice install/launch failed. If the device itself looks fine, this is usually an unstable USB/AMDevice connection.');
    console.error('Try: keep the device unlocked and on the home screen, reconnect the USB cable (avoid hubs/adapters), or restart the device to clear a stuck install session.');
    throw err;
  }
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
  if (commandAvailable('idevice_id')) {
    try {
      const out = execSync('idevice_id -l', { encoding: 'utf8', shell: true }).trim();
      if (out.length > 0) return true;
    } catch (_) {
    }
  }

  if (commandAvailable('xcrun')) {
    try {
      const out = execSync('xcrun xctrace list devices', { encoding: 'utf8', shell: true });
      const lines = out.split('\n').map(l => l.trim());
      let inDevicesSection = false;
      for (const l of lines) {
        if (/^==\s*devices\s*==$/i.test(l)) { inDevicesSection = true; continue; }
        if (/^==.*==$/.test(l)) { inDevicesSection = false; continue; }
        if (!inDevicesSection || !l) continue;
        if (/\(|\)/.test(l) && /iPhone|iPad|iPod/.test(l)) return true;
      }
    } catch (_) {
      // ignore errors and assume no physical device
    }
  }

  return false;
}

function bootedSimulators() {
  if (!commandAvailable('xcrun')) return [];
  let parsed;
  try {
    const out = execSync('xcrun simctl list devices -j', { encoding: 'utf8', shell: true });
    parsed = JSON.parse(out);
  } catch (_) {
    return [];
  }

  const booted = [];
  const byRuntime = (parsed && parsed.devices) || {};
  for (const runtime of Object.keys(byRuntime)) {
    for (const d of byRuntime[runtime] || []) {
      if (d && d.state === 'Booted') booted.push({ udid: d.udid, name: d.name });
    }
  }
  return booted;
}

function configWidgetAttr(attr) {
  const configPath = path.resolve('config.xml');
  if (!fs.existsSync(configPath)) return null;
  try {
    const widget = /<widget[^>]*>/.exec(fs.readFileSync(configPath, 'utf8'));
    if (!widget) return null;
    const match = new RegExp('\\b' + attr + '="([^"]+)"').exec(widget[0]);
    return match ? match[1] : null;
  } catch (_) {
    return null;
  }
}

function bundleId() {
  return configWidgetAttr('ios-CFBundleIdentifier') || configWidgetAttr('id');
}

function findSimulatorApp() {
  const buildDir = path.resolve('platforms', 'ios', 'build', 'Debug-iphonesimulator');
  if (!fs.existsSync(buildDir)) return null;
  const app = fs.readdirSync(buildDir).find(e => e.endsWith('.app'));
  return app ? path.join(buildDir, app) : null;
}

function simKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickBootedSimulator(target) {
  const booted = bootedSimulators();
  if (booted.length === 0) return null;

  if (target) {
    const wanted = simKey(target);
    const match = booted.find(s =>
      s.udid === target || simKey(s.name) === wanted);
    if (match) return match;
    console.log(`Target "${target}" is not among the booted simulators — booting it instead.`);
    return null;
  }

  if (booted.length > 1) {
    console.log('Several simulators are booted: ' + booted.map(s => s.name).join(', '));
  }
  return booted[0];
}

function runOnBootedSimulator(sim, dryRun) {
  const appId = bundleId();
  if (!appId) {
    console.warn('Could not read the app id from config.xml — falling back to a normal cordova run.');
    return false;
  }

  runCmd('cordova build ios --emulator', dryRun);

  const appPath = findSimulatorApp();
  if (!appPath) {
    if (dryRun) {
      console.log('> (dry run) would install platforms/ios/build/Debug-iphonesimulator/<app> on ' + sim.udid);
      return true;
    }
    console.warn('No simulator .app found in platforms/ios/build/Debug-iphonesimulator — falling back to a normal cordova run.');
    return false;
  }

  runSoftCmd('open -a Simulator', dryRun);
  runSoftCmd(`xcrun simctl terminate ${sim.udid} ${appId}`, dryRun);
  runCmd(`xcrun simctl install ${sim.udid} "${appPath}"`, dryRun);
  runCmd(`xcrun simctl launch ${sim.udid} ${appId}`, dryRun);
  return true;
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
  if (wantsDevice) {
    useDevice = true;
    console.log('Targeting a physical device (--device)');
  } else if (wantsEmulator) {
    useDevice = false;
    console.log('Targeting the simulator (--emulator)');
  } else {
    useDevice = detectPhysicalDevice();
    console.log(useDevice
      ? 'Physical iOS device detected — running on device. Pass --emulator to force the simulator.'
      : 'No physical iOS device detected — running on the simulator. Pass --device to force a physical device.');
  }

  // Running on a physical device requires ios-deploy; install it if missing.
  if (useDevice && !commandAvailable('ios-deploy')) {
    const bootstrapIos = require(path.join(__dirname, '..', 'bootstrap', 'ios'));
    bootstrapIos.ensureIosDeploy(dryRun);
  }

  let target = null;
  const targetIdx = args ? args.indexOf('--target') : -1;
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    target = args[targetIdx + 1];
  }

  const skipBuild = args && args.indexOf('--no-build') !== -1;
  if (!skipBuild && needsBuild()) {
    runCmd('ionic build', dryRun);
  }

  if (!useDevice) {
    const sim = pickBootedSimulator(target);
    if (sim) {
      console.log(`Simulator "${sim.name}" (${sim.udid}) is already running — reusing it.`);
      if (runOnBootedSimulator(sim, dryRun)) return;
    }
  }

  let cmd = 'cordova run ios';
  cmd += useDevice ? ' --device' : ' --emulator';
  if (target) cmd += ' --target=' + target;
  if (args && args.indexOf('--no-native-run') !== -1) cmd += ' --no-native-run';

  if (useDevice) {
    runDeviceCmd(cmd, dryRun);
  } else {
    runCmd(cmd, dryRun);
  }
}

function usage() {
  console.log('Usage: na run ios [--device|--emulator] [--target <simulator>] [--dry-run] [--no-build] [--no-native-run]');
  console.log('If neither --device nor --emulator is provided the command will auto-detect a connected device and use it; otherwise it runs on the simulator.');
  console.log('--target <simulator>  Simulator name ("iPhone 16 Pro"), device-type suffix (iPhone-16-Pro) or udid');
  console.log('An already-booted simulator is reused: the app is terminated, reinstalled and relaunched on it instead of booting a second one.');
}

module.exports = { run, usage };
