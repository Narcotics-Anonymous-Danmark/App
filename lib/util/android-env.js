"use strict";

// Shared Android toolchain helpers used by both `na bootstrap android` and
// `na run android`, so a fresh clone on either macOS or Linux can reach a
// working state (JDK + SDK + gradle wrapper + emulator) without manual setup.

const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

// A recent, known-good build of the Android cmdline-tools. Google doesn't
// keep a stable "latest" URL, so this is pinned and should be bumped
// occasionally — see https://developer.android.com/studio#command-tools
const CMDLINE_TOOLS_VERSION = '11076708';

// Pinned via sdkman — used only as a last-resort installer when no JDK/Gradle
// is already available (e.g. no Android Studio, no Homebrew). Any reasonably
// recent version works; sdkman keeps old releases installable indefinitely.
const SDKMAN_JAVA_VERSION = '21.0.8-tem';
const SDKMAN_GRADLE_VERSION = '8.13';

function isDarwin() {
  return process.platform === 'darwin';
}

function isLinux() {
  return process.platform === 'linux';
}

function commandAvailable(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: true });
    return true;
  } catch (_) {
    return false;
  }
}

function runCmd(cmd, env, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  execSync(cmd, { stdio: 'inherit', shell: true, env: env || process.env });
}

// ---------------------------------------------------------------------------
// Android SDK root
// ---------------------------------------------------------------------------

function defaultSdkRoot() {
  if (isDarwin()) return path.join(os.homedir(), 'Library', 'Android', 'sdk');
  // Linux and anything else — Android Studio's own default location.
  return path.join(os.homedir(), 'Android', 'Sdk');
}

function resolveAndroidSdkRoot() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) return process.env.ANDROID_SDK_ROOT;

  const candidates = [
    path.join(os.homedir(), 'Library', 'Android', 'sdk'), // Android Studio default on macOS
    path.join(os.homedir(), 'Android', 'Sdk'), // Android Studio default on Linux
    path.join(os.homedir(), 'AndroidSDK') // custom fallback used by earlier setups
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// JDK
// ---------------------------------------------------------------------------

function sdkmanInitScript() {
  return path.join(os.homedir(), '.sdkman', 'bin', 'sdkman-init.sh');
}

function sdkmanCandidateHome(tool) {
  // sdkman always keeps a "current" symlink to the active version — same
  // layout on macOS and Linux.
  return path.join(os.homedir(), '.sdkman', 'candidates', tool, 'current');
}

function resolveJavaHome() {
  if (process.env.CORDOVA_JAVA_HOME && fs.existsSync(process.env.CORDOVA_JAVA_HOME)) return process.env.CORDOVA_JAVA_HOME;
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;

  const candidates = [];
  if (isDarwin()) {
    candidates.push(
      // Prefer Android Studio's bundled JDK — keeps CLI builds in sync with the IDE.
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
      '/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
      '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home'
    );
  } else if (isLinux()) {
    candidates.push(
      '/opt/android-studio/jbr', // tarball install
      '/snap/android-studio/current/android-studio/jbr', // snap install
      '/usr/lib/jvm/java-21-openjdk-amd64',
      '/usr/lib/jvm/java-21-openjdk-arm64',
      '/usr/lib/jvm/java-21-openjdk'
    );
  }
  candidates.push(sdkmanCandidateHome('java'));

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  if (isDarwin()) {
    try {
      const out = execSync('/usr/libexec/java_home', { encoding: 'utf8', shell: true }).trim();
      if (out) return out;
    } catch (_) {
      // no registered JDK
    }
  } else if (isLinux() && commandAvailable('java')) {
    try {
      const javaBin = execSync('command -v java', { encoding: 'utf8', shell: true }).trim();
      const real = fs.realpathSync(javaBin);
      const home = path.dirname(path.dirname(real)); // .../<jdk-home>/bin/java
      if (fs.existsSync(home)) return home;
    } catch (_) {
      // couldn't resolve a real JDK home from PATH
    }
  }

  return null;
}

function ensureSdkman(dryRun) {
  const initScript = sdkmanInitScript();
  if (fs.existsSync(initScript)) return initScript;
  runCmd('curl -s "https://get.sdkman.io" | bash', process.env, dryRun);
  return initScript;
}

function sdkmanExec(command, dryRun) {
  if (!commandAvailable('curl')) {
    console.warn('`curl` is required to install sdkman-managed tools but was not found — install it and re-run');
    return;
  }
  const initScript = ensureSdkman(dryRun);
  console.log('> ' + command + ' (via sdkman)');
  if (dryRun) return;
  execSync(`bash -c 'source "${initScript}" && ${command}'`, { stdio: 'inherit', shell: true });
}

// Installs a JDK if none can be found. Prefers whatever's already on the
// machine (Android Studio, Homebrew, apt); sdkman is the last-resort,
// no-root, cross-platform fallback.
function ensureJdk(dryRun) {
  if (resolveJavaHome()) {
    console.log('JDK already available');
    return;
  }
  console.warn('No JDK found — installing one via sdkman (no admin/root needed)');
  sdkmanExec(`yes | sdk install java ${SDKMAN_JAVA_VERSION}`, dryRun);
}

// ---------------------------------------------------------------------------
// Gradle (system-wide bootstrapper — only used to generate this project's
// own pinned gradle-wrapper; the actual build always runs through gradlew)
// ---------------------------------------------------------------------------

function ensureGradle(dryRun) {
  if (commandAvailable('gradle')) {
    console.log('gradle already available');
    return;
  }
  if (isDarwin() && commandAvailable('brew')) {
    runCmd('brew install gradle', process.env, dryRun);
    return;
  }
  console.warn('No system `gradle` found — installing one via sdkman (no admin/root needed)');
  sdkmanExec(`yes | sdk install gradle ${SDKMAN_GRADLE_VERSION}`, dryRun);
}

// ---------------------------------------------------------------------------
// cmdline-tools / sdkmanager / avdmanager
// ---------------------------------------------------------------------------

function cmdlineToolsZipUrl() {
  const osName = isDarwin() ? 'mac' : 'linux';
  return `https://dl.google.com/android/repository/commandlinetools-${osName}-${CMDLINE_TOOLS_VERSION}_latest.zip`;
}

function findCmdlineToolsBin (sdkRoot, tool) {
  if (!sdkRoot) return null;
  const cmdlineToolsDir = path.join(sdkRoot, 'cmdline-tools');
  if (!fs.existsSync(cmdlineToolsDir)) return null;

  // Prefer the official "latest" folder, but fall back to any versioned
  // subfolder some installs use instead (e.g. "cmdline-tools/11.0").
  const entries = fs.readdirSync(cmdlineToolsDir).filter(e => e !== 'latest');
  const names = ['latest'].concat(entries);
  for (const name of names) {
    const bin = path.join(cmdlineToolsDir, name, 'bin', tool);
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

function findSdkManager(sdkRoot) {
  return findCmdlineToolsBin(sdkRoot, 'sdkmanager');
}

function findAvdManager(sdkRoot) {
  return findCmdlineToolsBin(sdkRoot, 'avdmanager');
}

function ensureCmdlineTools(sdkRoot, dryRun) {
  if (findSdkManager(sdkRoot)) {
    console.log('Android cmdline-tools already available');
    return;
  }
  if (!commandAvailable('curl') || !commandAvailable('unzip')) {
    console.warn('`curl` and `unzip` are required to install the Android cmdline-tools — install them and re-run');
    return;
  }

  const zipUrl = cmdlineToolsZipUrl();
  const tmpZip = path.join(os.tmpdir(), 'na-android-cmdline-tools.zip');
  const tmpExtractDir = path.join(os.tmpdir(), 'na-android-cmdline-tools-extract');
  const targetDir = path.join(sdkRoot, 'cmdline-tools', 'latest');

  runCmd(`mkdir -p "${sdkRoot}"`, process.env, dryRun);
  runCmd(`curl -fsSL -o "${tmpZip}" "${zipUrl}"`, process.env, dryRun);
  runCmd(`rm -rf "${tmpExtractDir}" && mkdir -p "${tmpExtractDir}"`, process.env, dryRun);
  runCmd(`unzip -q -o "${tmpZip}" -d "${tmpExtractDir}"`, process.env, dryRun);
  runCmd(`mkdir -p "${path.join(sdkRoot, 'cmdline-tools')}"`, process.env, dryRun);
  runCmd(`rm -rf "${targetDir}"`, process.env, dryRun);
  // The zip's top-level folder is itself called "cmdline-tools"; Google's
  // required on-disk layout is <sdkRoot>/cmdline-tools/latest/*.
  runCmd(`mv "${path.join(tmpExtractDir, 'cmdline-tools')}" "${targetDir}"`, process.env, dryRun);
  runCmd(`rm -f "${tmpZip}" && rm -rf "${tmpExtractDir}"`, process.env, dryRun);
}

function acceptSdkLicenses(sdkRoot, env, dryRun) {
  const sdkmanager = findSdkManager(sdkRoot);
  if (!sdkmanager) return;
  runCmd(`yes | "${sdkmanager}" --sdk_root="${sdkRoot}" --licenses`, env, dryRun);
}

function installSdkPackages(sdkRoot, packages, env, dryRun) {
  const sdkmanager = findSdkManager(sdkRoot);
  if (!sdkmanager) {
    console.warn('sdkmanager not available — cannot install Android SDK packages: ' + packages.join(', '));
    return;
  }
  const quoted = packages.map(p => `"${p}"`).join(' ');
  runCmd(`"${sdkmanager}" --sdk_root="${sdkRoot}" ${quoted}`, env, dryRun);
}

function systemImagePackage(apiLevel) {
  const abi = process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64';
  return `system-images;android-${apiLevel};google_apis;${abi}`;
}

const DEFAULT_AVD_NAME = 'na_default';

function listAvds(sdkRoot, env) {
  if (commandAvailable('emulator')) {
    try {
      const out = execSync('emulator -list-avds', { encoding: 'utf8', shell: true, env });
      return out.split('\n').map(l => l.trim()).filter(Boolean);
    } catch (_) {
      // fall through
    }
  }
  const avdmanager = findAvdManager(sdkRoot);
  if (!avdmanager) return [];
  try {
    const out = execSync(`"${avdmanager}" list avd`, { encoding: 'utf8', shell: true, env });
    return (out.match(/Name:\s*(\S+)/g) || []).map(l => l.replace(/Name:\s*/, ''));
  } catch (_) {
    return [];
  }
}

function ensureAvd(sdkRoot, apiLevel, env, dryRun) {
  if (listAvds(sdkRoot, env).length > 0) {
    console.log('An AVD already exists, skipping creation');
    return;
  }
  const avdmanager = findAvdManager(sdkRoot);
  if (!avdmanager) {
    console.warn('avdmanager not available — cannot auto-create an emulator AVD');
    return;
  }
  const image = systemImagePackage(apiLevel);
  runCmd(`echo no | "${avdmanager}" create avd -n ${DEFAULT_AVD_NAME} -k "${image}" --device "pixel" --force`, env, dryRun);
}

// ---------------------------------------------------------------------------
// Env assembly
// ---------------------------------------------------------------------------

function buildEnv(sdkRoot) {
  const javaHome = resolveJavaHome();

  const pathDirs = [];
  if (javaHome) pathDirs.push(path.join(javaHome, 'bin'));
  if (sdkRoot) {
    pathDirs.push(
      path.join(sdkRoot, 'platform-tools'),
      path.join(sdkRoot, 'emulator'),
      path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin'),
      path.join(sdkRoot, 'tools'),
      path.join(sdkRoot, 'tools', 'bin')
    );
  }
  pathDirs.push(path.join(sdkmanCandidateHome('gradle'), 'bin'));

  const env = Object.assign({}, process.env, {
    PATH: pathDirs.filter(p => fs.existsSync(p)).concat([process.env.PATH || '']).join(path.delimiter)
  });
  if (sdkRoot) {
    env.ANDROID_HOME = sdkRoot;
    env.ANDROID_SDK_ROOT = sdkRoot;
  }
  if (javaHome) {
    env.JAVA_HOME = javaHome;
  }
  return env;
}

// ---------------------------------------------------------------------------
// cordova-android's own pinned config, once the platform has been added
// ---------------------------------------------------------------------------

function readGradleConfig() {
  const configPath = path.resolve('platforms', 'android', 'cdv-gradle-config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function configAndroidPackageName() {
  const configPath = path.resolve('config.xml');
  if (!fs.existsSync(configPath)) return null;

  let widget;
  try {
    widget = /<widget[^>]*>/.exec(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {
    return null;
  }
  if (!widget) return null;

  const override = /\bandroid-packageName="([^"]+)"/.exec(widget[0]);
  const id = /\bid="([^"]+)"/.exec(widget[0]);
  const name = (override && override[1]) || (id && id[1]);

  return name ? name.replace(/-/g, '_') : null;
}

function androidPackageMismatch() {
  const expected = configAndroidPackageName();
  if (!expected) return null;

  const gradleConfig = readGradleConfig();
  if (!gradleConfig) return null;

  const actual = gradleConfig.PACKAGE_NAMESPACE;
  if (!actual || actual === expected) return null;

  return { expected, actual };
}

module.exports = {
  commandAvailable,
  runCmd,
  defaultSdkRoot,
  resolveAndroidSdkRoot,
  resolveJavaHome,
  ensureJdk,
  ensureGradle,
  ensureCmdlineTools,
  findSdkManager,
  findAvdManager,
  acceptSdkLicenses,
  installSdkPackages,
  systemImagePackage,
  listAvds,
  ensureAvd,
  buildEnv,
  readGradleConfig,
  configAndroidPackageName,
  androidPackageMismatch,
  isDarwin,
  isLinux
};
