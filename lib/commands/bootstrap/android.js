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

function platformStatus() {
  let cordovaListed = false;
  const dirExists = fs.existsSync('platforms/android');

  if (commandAvailable('cordova')) {
    try {
      const out = execSync('cordova platforms ls', { encoding: 'utf8', shell: true });
      // Only match the "Installed platforms" section, not "Available platforms"
      const installedSection = out.split(/available platforms:/i)[0];
      cordovaListed = /android/i.test(installedSection);
    } catch (_) {
      cordovaListed = false;
    }
  }

  return { cordovaListed, dirExists };
}

function addPlatformAndroid(dryRun, force, env) {
  const status = platformStatus();

  if (status.cordovaListed && status.dirExists && !force) {
    console.log('Android platform already added, skipping');
    return;
  }

  if (status.cordovaListed && !status.dirExists) {
    console.warn('cordova lists Android platform but platforms/android is missing — will re-add platform');
    if (commandAvailable('cordova') && force) {
      runCmd('cordova platform rm android', env, dryRun);
    }
  }

  runCmd('ionic cordova platform add android@14.0.1', env, dryRun);
}

function prepareAndroid(dryRun, env) {
  runCmd('cordova prepare android', env, dryRun);
}

function run(args) {
  const dryRun = args && args.indexOf('--dry-run') !== -1;
  const force = args && args.indexOf('--force') !== -1;

  const bootstrap = require(path.join(__dirname, 'bootstrap'));
  bootstrap.run(args);

  const sdkRoot = resolveAndroidSdkRoot();
  if (!sdkRoot) {
    console.warn('ANDROID_SDK_ROOT not found — set ANDROID_SDK_ROOT or ANDROID_HOME, or place the SDK at ~/AndroidSDK');
  } else {
    console.log('Using ANDROID_SDK_ROOT=' + sdkRoot);
  }

  const env = buildEnv(sdkRoot);

  console.log('\nRunning Android-specific bootstrap' + (dryRun ? ' (dry-run)' : '') + (force ? ' (force)' : '') + '\n');

  addPlatformAndroid(dryRun, force, env);
  prepareAndroid(dryRun, env);

  console.log('\nAndroid bootstrap complete.');
}

function usage() {
  console.log('Usage: na bootstrap android [--dry-run] [--force]');
}

module.exports = { run, usage, addPlatformAndroid };
