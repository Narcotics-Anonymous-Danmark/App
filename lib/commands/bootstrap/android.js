"use strict";

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const androidEnv = require(path.join(__dirname, '..', '..', 'util', 'android-env'));

const { commandAvailable, runCmd } = androidEnv;

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

function ensureGradleWrapper(dryRun, env) {
  const root = path.resolve('platforms', 'android');
  const toolsDir = path.join(root, 'tools');
  if (!fs.existsSync(toolsDir)) return;

  if (fs.existsSync(path.join(toolsDir, 'gradlew'))) {
    console.log('gradle wrapper already generated');
    return;
  }

  const gradleConfig = androidEnv.readGradleConfig();
  const gradleVersion = (gradleConfig && gradleConfig.GRADLE_VERSION) || '8.13';

  runCmd(`gradle -p "${toolsDir}" wrapper --gradle-version ${gradleVersion}`, env, dryRun);

  runCmd(`cp "${path.join(toolsDir, 'gradlew')}" "${path.join(root, 'gradlew')}"`, env, dryRun);
  runCmd(`cp -r "${path.join(toolsDir, 'gradle')}" "${path.join(root, 'gradle')}"`, env, dryRun);
  if (dryRun || fs.existsSync(path.join(toolsDir, 'gradlew.bat'))) {
    runCmd(`cp "${path.join(toolsDir, 'gradlew.bat')}" "${path.join(root, 'gradlew.bat')}"`, env, dryRun);
  }
}

function ensureToolchain(dryRun, force) {
  androidEnv.ensureJdk(dryRun);

  let sdkRoot = androidEnv.resolveAndroidSdkRoot();
  if (!sdkRoot) {
    sdkRoot = androidEnv.defaultSdkRoot();
    console.log('No Android SDK found — installing one at ' + sdkRoot);
  } else {
    console.log('Using Android SDK at ' + sdkRoot);
  }

  androidEnv.ensureCmdlineTools(sdkRoot, dryRun);

  let env = androidEnv.buildEnv(sdkRoot);
  if (env.JAVA_HOME) {
    console.log('Using JAVA_HOME=' + env.JAVA_HOME);
  } else {
    console.warn('No JDK found and none could be installed automatically — set JAVA_HOME manually');
  }
  Object.assign(process.env, env);

  androidEnv.acceptSdkLicenses(sdkRoot, env, dryRun);
  androidEnv.installSdkPackages(sdkRoot, ['platform-tools'], env, dryRun);

  androidEnv.ensureGradle(dryRun);

  addPlatformAndroid(dryRun, force, env);

  const gradleConfig = androidEnv.readGradleConfig();
  const compileSdk = (gradleConfig && gradleConfig.COMPILE_SDK_VERSION) || (gradleConfig && gradleConfig.SDK_VERSION) || 35;
  const buildTools = (gradleConfig && gradleConfig.BUILD_TOOLS_VERSION) || (gradleConfig && gradleConfig.MIN_BUILD_TOOLS_VERSION) || `${compileSdk}.0.0`;

  androidEnv.installSdkPackages(sdkRoot, [
    `platforms;android-${compileSdk}`,
    `build-tools;${buildTools}`,
    'emulator',
    androidEnv.systemImagePackage(compileSdk)
  ], env, dryRun);

  env = androidEnv.buildEnv(sdkRoot);
  Object.assign(process.env, env);

  androidEnv.ensureAvd(sdkRoot, compileSdk, env, dryRun);

  prepareAndroid(dryRun, env);
  ensureGradleWrapper(dryRun, env);

  return env;
}

function run(args) {
  const dryRun = args && args.indexOf('--dry-run') !== -1;
  const force = args && args.indexOf('--force') !== -1;

  const bootstrap = require(path.join(__dirname, 'bootstrap'));
  bootstrap.run(args);

  console.log('\nRunning Android-specific bootstrap' + (dryRun ? ' (dry-run)' : '') + (force ? ' (force)' : '') + '\n');

  ensureToolchain(dryRun, force);

  console.log('\nAndroid bootstrap complete.');
}

function usage() {
  console.log('Usage: na bootstrap android [--dry-run] [--force]');
  console.log('Installs/verifies a JDK, the Android SDK (cmdline-tools, platform, build-tools, emulator + AVD) and a system gradle,');
  console.log('then adds and prepares the cordova android platform. Safe to re-run — every step is skipped if already satisfied.');
}

module.exports = { run, usage, addPlatformAndroid, ensureToolchain, ensureGradle: androidEnv.ensureGradle };
