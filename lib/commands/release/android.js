"use strict";

// `na release android` — produces a signed Android App Bundle ready for the
// Play Console. This replaces the manual README dance (regular build, prod
// build, cd into outputs, jarsigner) with one command that either produces a
// verified, signed .aab or fails.

const path = require('path');
const fs = require('fs');
const release = require(path.join(__dirname, '..', '..', 'util', 'release'));
const androidEnv = require(path.join(__dirname, '..', '..', 'util', 'android-env'));

function usage() {
  console.log('Usage: na release android [--allow-dirty] [--dry-run] [--output <dir>]');
  console.log('');
  console.log('Builds a signed .aab into dist/. Requires (all of them, or it refuses to run):');
  console.log('  ANDROID_KEYSTORE_BASE64    base64 of the nadanmarkapp.keystore upload key');
  console.log('  ANDROID_KEYSTORE_PASSWORD  keystore password');
  console.log('  ANDROID_KEY_PASSWORD       key password (usually the same)');
  console.log('  ANDROID_KEY_ALIAS          key alias (optional, defaults to ' + release.DEFAULT_KEY_ALIAS + ')');
  console.log('  GOOGLE_MAPS_API_KEY        Maps key (GOOGLE_MAPS_ANDROID_API_KEY / GOOGLE_MAPS_JS_API_KEY override it)');
  console.log('  NA_API_BASIC_AUTH          "user:password" for the nadanmark.dk API');
  console.log('plus a clean git worktree and version numbers that agree (see `na release check android`).');
}

function materialiseKeystore(dryRun) {
  const keystorePath = path.join(release.WORK_DIR, 'nadanmarkapp.keystore');
  if (dryRun) {
    console.log('> (dry run) decode ANDROID_KEYSTORE_BASE64 into ' + keystorePath);
    return keystorePath;
  }

  release.writeSecretFile(keystorePath, release.decodeBase64Secret('ANDROID_KEYSTORE_BASE64'), null);

  // Fail here — with a clear message — rather than 15 minutes later inside gradle.
  const alias = process.env.ANDROID_KEY_ALIAS || release.DEFAULT_KEY_ALIAS;
  const javaHome = androidEnv.resolveJavaHome();
  const keytool = javaHome && fs.existsSync(path.join(javaHome, 'bin', 'keytool'))
    ? path.join(javaHome, 'bin', 'keytool')
    : 'keytool';
  if (keytool === 'keytool' && !release.commandAvailable('keytool')) {
    release.fail('keytool was not found — set JAVA_HOME to a JDK so the keystore can be verified');
  }
  const listed = release.capture(
    `"${keytool}" -list -keystore "${keystorePath}" -alias "${alias}" -storepass "$ANDROID_KEYSTORE_PASSWORD" 2>&1`,
    { soft: true, quiet: true }
  );
  if (listed === null || /error|Alias .* does not exist|password was incorrect/i.test(listed || '')) {
    release.fail('the keystore did not open with ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS', [
      `alias: ${alias}`,
      (listed || 'keytool produced no output').split('\n').slice(0, 4).join(' / ')
    ]);
  }
  console.log(`Keystore verified (alias ${alias})`);
  return keystorePath;
}

function writeBuildConfig(keystorePath, dryRun) {
  const buildConfigPath = path.join(release.WORK_DIR, 'build.json');
  if (dryRun) {
    console.log('> (dry run) write signing config to ' + buildConfigPath);
    return buildConfigPath;
  }

  const config = {
    android: {
      debug: { packageType: 'apk' },
      release: {
        keystore: keystorePath,
        storePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
        alias: process.env.ANDROID_KEY_ALIAS || release.DEFAULT_KEY_ALIAS,
        password: process.env.ANDROID_KEY_PASSWORD,
        keystoreType: 'jks',
        packageType: 'bundle'
      }
    }
  };
  release.writeSecretFile(buildConfigPath, JSON.stringify(config, null, 2));
  return buildConfigPath;
}

function findBundle() {
  const bundleDir = path.join(release.REPO_ROOT, 'platforms', 'android', 'app', 'build', 'outputs', 'bundle', 'release');
  if (!fs.existsSync(bundleDir)) return null;
  const aab = fs.readdirSync(bundleDir).find(f => f.endsWith('.aab'));
  return aab ? path.join(bundleDir, aab) : null;
}

function verifySignature(aabPath, env) {
  const out = release.capture(`jarsigner -verify "${aabPath}"`, { soft: true, quiet: true, env });
  if (!out || !/jar verified/i.test(out)) {
    release.fail('the produced bundle is not signed', [out || 'jarsigner produced no output']);
  }
  console.log('Signature verified: jar verified');
}

function run(args) {
  args = args || [];
  if (release.hasFlag(args, '--help', '-h')) return usage();

  const dryRun = release.hasFlag(args, '--dry-run');
  const allowDirty = release.hasFlag(args, '--allow-dirty');
  const outputDir = path.resolve(release.flagValue(args, '--output', release.DIST_DIR));

  const versions = release.assertReleaseReady('android', { allowDirty });

  release.ensureWorkDirs();
  fs.mkdirSync(outputDir, { recursive: true });

  const keystorePath = materialiseKeystore(dryRun);
  const buildConfigPath = writeBuildConfig(keystorePath, dryRun);

  let restoreCredentials = () => {};
  try {
    release.section('Injecting credentials');
    restoreCredentials = release.injectCredentials('android', dryRun);

    // The pinned local ionic/cordova have to win over anything global for every
    // child process from here on — including the ones the bootstrap helpers
    // spawn with their own env.
    const env = release.buildEnv();
    process.env.PATH = env.PATH;

    release.section('Building the web app');
    // The default Angular configuration is the one that ships: angular.json's
    // "production" configuration still references files that were deleted
    // (environment.prod.ts, app.component.prod.ts, ngsw-config.json) and would
    // also write to www/prod, which cordova does not read.
    release.run('ionic build', { env, dryRun });

    release.section('Preparing the Android platform');
    // Lean toolchain: no emulator, no system image, no AVD — a release build
    // never boots a device.
    if (!dryRun) {
      const bootstrapAndroid = require(path.join(__dirname, '..', 'bootstrap', 'android'));
      bootstrapAndroid.ensureToolchain(false, false, { withEmulator: false });
    } else {
      console.log('> (dry run) ensure JDK + Android SDK + cordova android platform (no emulator)');
    }

    // android-env's buildEnv keeps process.env.PATH (with node_modules/.bin
    // first, set above) and adds JAVA_HOME/SDK tooling.
    const buildEnvWithSdk = androidEnv.buildEnv(androidEnv.resolveAndroidSdkRoot());

    release.section('Building the signed bundle');
    release.run(
      `cordova build android --release --buildConfig "${buildConfigPath}"`,
      { env: buildEnvWithSdk, dryRun }
    );

    if (dryRun) {
      console.log('\n(dry run) would copy the bundle to ' + path.join(outputDir, release.artifactName(versions.version, versions.build, 'aab')));
      return;
    }

    const aab = findBundle();
    if (!aab) release.fail('cordova reported success but no .aab was produced');

    verifySignature(aab, buildEnvWithSdk);

    const target = path.join(outputDir, release.artifactName(versions.version, versions.build, 'aab'));
    fs.copyFileSync(aab, target);

    release.section('Done');
    console.log(`Signed bundle: ${target}`);
    console.log(`Version ${versions.version} build ${versions.build} (versionCode ${versions.versionCode})`);
  } finally {
    restoreCredentials();
    if (!dryRun) release.cleanWorkDir();
  }
}

module.exports = { run, usage };
