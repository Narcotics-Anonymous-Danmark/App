"use strict";

// Shared helpers for the release/publish commands.
//
// Everything here is deliberately defensive: a release build must either
// produce a signed, uploadable artefact or refuse to run at all. There is no
// "half a release" — a missing secret, a dirty worktree or an inconsistent
// version number is a hard error, not a warning.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORK_DIR = path.join(REPO_ROOT, '.na-release');
const DIST_DIR = path.join(REPO_ROOT, 'dist');

const DEFAULT_KEY_ALIAS = 'nadanmarkapp';
const CORDOVA_ANDROID_VERSION = '14.0.1';
const CORDOVA_IOS_VERSION = '7.1.0';

// ---------------------------------------------------------------------------
// process helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(msg);
}

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

function run(cmd, opts) {
  const options = opts || {};
  console.log('> ' + (options.display || cmd));
  if (options.dryRun) return '';
  return execSync(cmd, {
    stdio: options.capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    shell: true,
    cwd: options.cwd || REPO_ROOT,
    env: options.env || process.env,
    encoding: options.capture ? 'utf8' : undefined,
    maxBuffer: 64 * 1024 * 1024
  });
}

// Same as run(), but never echoes the command — for anything carrying a secret.
function runQuiet(cmd, opts) {
  const options = opts || {};
  console.log('> ' + (options.display || '<command with secret redacted>'));
  if (options.dryRun) return '';
  return execSync(cmd, {
    stdio: 'inherit',
    shell: true,
    cwd: options.cwd || REPO_ROOT,
    env: options.env || process.env
  });
}

function capture(cmd, opts) {
  const options = opts || {};
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      shell: true,
      cwd: options.cwd || REPO_ROOT,
      env: options.env || process.env,
      stdio: ['inherit', 'pipe', options.quiet ? 'ignore' : 'inherit'],
      maxBuffer: 64 * 1024 * 1024
    }).trim();
  } catch (err) {
    if (options.soft) return null;
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

function fail(message, details) {
  console.error('\nError: ' + message);
  if (details && details.length) {
    for (const d of details) console.error('  - ' + d);
  }
  process.exit(1);
}

function hasFlag(args, ...names) {
  if (!args) return false;
  return names.some(n => args.indexOf(n) !== -1);
}

function flagValue(args, name, fallback) {
  if (!args) return fallback;
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  const inline = args.find(a => a.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  return fallback;
}

// ---------------------------------------------------------------------------
// config.xml / version handling
// ---------------------------------------------------------------------------

function readFile(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

function writeFile(rel, contents) {
  fs.writeFileSync(path.join(REPO_ROOT, rel), contents, 'utf8');
}

function widgetTag(xml) {
  const match = /<widget[^>]*>/.exec(xml);
  if (!match) throw new Error('config.xml has no <widget> element');
  return match[0];
}

function widgetAttr(xml, attr) {
  const match = new RegExp('\\b' + attr + '="([^"]*)"').exec(widgetTag(xml));
  return match ? match[1] : null;
}

// Sets (or inserts, keeping cordova's alphabetical attribute order) a
// <widget> attribute.
function setWidgetAttr(xml, attr, value) {
  const tag = widgetTag(xml);
  const re = new RegExp('(\\b' + attr + '=")[^"]*(")');
  let updated;
  if (re.test(tag)) {
    updated = tag.replace(re, `$1${value}$2`);
  } else {
    updated = tag.replace(/^<widget/, `<widget ${attr}="${value}"`);
  }
  return xml.replace(tag, updated);
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || '').trim());
  if (!match) return null;
  return { major: +match[1], minor: +match[2], patch: +match[3] };
}

// Android versionCode. Play requires a strictly increasing integer <= 2100000000
// and the previously shipped codes were of the form 10<minor><patch>000001
// (1.2.3 -> 1022000001), so anything we generate has to stay above that while
// leaving room for repeat builds of the same version.
//
//   1_100_000_000 + (major*10000 + minor*100 + patch) * 1000 + build
//
// 1.2.4 build 1 -> 1110204001. Monotonic for minor/patch < 100 and build < 1000.
function computeVersionCode(version, build) {
  const v = parseVersion(version);
  if (!v) throw new Error(`Not a valid x.y.z version: "${version}"`);
  if (v.minor > 99 || v.patch > 99) {
    throw new Error(`minor/patch must stay below 100 for the versionCode scheme (got ${version})`);
  }
  const b = Number(build);
  if (!Number.isInteger(b) || b < 1 || b > 999) {
    throw new Error(`build must be an integer between 1 and 999 (got ${build})`);
  }
  const code = 1100000000 + (v.major * 10000 + v.minor * 100 + v.patch) * 1000 + b;
  if (code > 2100000000) throw new Error(`versionCode ${code} exceeds the Play limit of 2100000000`);
  return code;
}

function bumpVersion(version, kind) {
  const v = parseVersion(version);
  if (!v) throw new Error(`Not a valid x.y.z version: "${version}"`);
  if (kind === 'major') return `${v.major + 1}.0.0`;
  if (kind === 'minor') return `${v.major}.${v.minor + 1}.0`;
  if (kind === 'patch') return `${v.major}.${v.minor}.${v.patch + 1}`;
  if (kind === 'none') return version;
  throw new Error(`Unknown bump "${kind}" (expected major, minor, patch or none)`);
}

function readVersions() {
  const xml = readFile('config.xml');
  const pkg = JSON.parse(readFile('package.json'));
  const env = readFile('src/environments/environment.ts');
  const envMatch = /currentVersion:\s*"([^"]*)"/.exec(env);

  return {
    config: widgetAttr(xml, 'version'),
    versionCode: widgetAttr(xml, 'android-versionCode'),
    iosBuild: widgetAttr(xml, 'ios-CFBundleVersion'),
    package: pkg.version,
    environment: envMatch ? envMatch[1] : null
  };
}

// Writes the release version into every place that has to agree (the list in
// README's Release section).
function applyVersion(version, build) {
  if (!parseVersion(version)) throw new Error(`Not a valid x.y.z version: "${version}"`);
  const versionCode = computeVersionCode(version, build);

  let xml = readFile('config.xml');
  xml = setWidgetAttr(xml, 'version', version);
  xml = setWidgetAttr(xml, 'android-versionCode', String(versionCode));
  xml = setWidgetAttr(xml, 'ios-CFBundleVersion', String(build));
  writeFile('config.xml', xml);

  for (const file of ['package.json', 'package-lock.json']) {
    const raw = readFile(file);
    const json = JSON.parse(raw);
    json.version = version;
    // package-lock v2 repeats the version in the root package entry.
    if (json.packages && json.packages['']) json.packages[''].version = version;
    // Match the file's existing shape so the diff is the version lines only.
    const indent = /^\t/m.test(raw) ? '\t' : 2;
    const trailingNewline = raw.endsWith('\n') ? '\n' : '';
    writeFile(file, JSON.stringify(json, null, indent) + trailingNewline);
  }

  const envFile = 'src/environments/environment.ts';
  const env = readFile(envFile);
  if (!/currentVersion:\s*"[^"]*"/.test(env)) {
    throw new Error(`${envFile} has no currentVersion field to update`);
  }
  writeFile(envFile, env.replace(/currentVersion:\s*"[^"]*"/, `currentVersion: "${version}"`));

  return { version, build: Number(build), versionCode };
}

function assertConsistentVersions(expectedBuild) {
  const v = readVersions();
  const problems = [];

  if (!parseVersion(v.config)) problems.push(`config.xml version "${v.config}" is not x.y.z`);
  if (v.package !== v.config) problems.push(`package.json version "${v.package}" != config.xml "${v.config}"`);
  if (v.environment !== v.config) problems.push(`environment.ts currentVersion "${v.environment}" != config.xml "${v.config}"`);
  if (!v.versionCode) problems.push('config.xml has no android-versionCode');
  if (!v.iosBuild) problems.push('config.xml has no ios-CFBundleVersion (run `na release version`)');

  const build = expectedBuild || v.iosBuild;
  if (v.config && v.versionCode && build && parseVersion(v.config)) {
    try {
      const expected = String(computeVersionCode(v.config, build));
      if (v.versionCode !== expected) {
        problems.push(`android-versionCode ${v.versionCode} does not match version ${v.config} build ${build} (expected ${expected})`);
      }
    } catch (err) {
      problems.push(err.message);
    }
  }

  if (problems.length) {
    fail('The version numbers in this checkout are inconsistent. Run `./bin/na release version <x.y.z>` first.', problems);
  }

  return { version: v.config, build: Number(v.iosBuild), versionCode: Number(v.versionCode) };
}

// ---------------------------------------------------------------------------
// credentials
// ---------------------------------------------------------------------------

// The repo intentionally keeps placeholders in tracked files (see commit
// "chore: fixed credentials dynamic"); the real values are injected right
// before a build and restored right after.
const CREDENTIAL_SITES = [
  {
    file: 'config.xml',
    what: 'Google Maps Android SDK key',
    platforms: ['android'],
    pattern: /(<preference name="GOOGLE_MAPS_ANDROID_API_KEY" value=")[^"]*(")/,
    replace: '$1<value>$2',
    unsafe: /["'<>&]/,
    env: ['GOOGLE_MAPS_ANDROID_API_KEY', 'GOOGLE_MAPS_API_KEY']
  },
  {
    file: 'config.xml',
    what: 'Google Maps iOS SDK key',
    platforms: ['ios'],
    pattern: /(<preference name="GOOGLE_MAPS_IOS_API_KEY" value=")[^"]*(")/,
    replace: '$1<value>$2',
    unsafe: /["'<>&]/,
    env: ['GOOGLE_MAPS_IOS_API_KEY', 'GOOGLE_MAPS_API_KEY']
  },
  {
    file: 'src/index.html',
    what: 'Google Maps JavaScript API key',
    platforms: ['android', 'ios'],
    pattern: /(maps\.googleapis\.com\/maps\/api\/js\?key=)[^&"']*/,
    replace: '$1<value>',
    unsafe: /["'<>&\s]/,
    env: ['GOOGLE_MAPS_JS_API_KEY', 'GOOGLE_MAPS_API_KEY']
  },
  {
    file: 'src/app/providers/audio.service.ts',
    what: 'nadanmark.dk API basic auth (speaks)',
    platforms: ['android', 'ios'],
    pattern: /(btoa\(")[^"]*("\))/,
    replace: '$1<value>$2',
    unsafe: /["\\\r\n]/,
    env: ['NA_API_BASIC_AUTH']
  },
  {
    file: 'src/app/providers/event.service.ts',
    what: 'nadanmark.dk API basic auth (events)',
    platforms: ['android', 'ios'],
    pattern: /(btoa\(")[^"]*("\))/,
    replace: '$1<value>$2',
    unsafe: /["\\\r\n]/,
    env: ['NA_API_BASIC_AUTH']
  }
];

function sitesFor(platform) {
  return CREDENTIAL_SITES.filter(s => s.platforms.indexOf(platform) !== -1);
}

function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function missingCredentials(platform) {
  const missing = new Map();
  for (const site of sitesFor(platform)) {
    if (!envValue(site.env)) {
      // One line per secret, not per place it gets injected.
      const fallback = site.env.length > 1 ? `, or ${site.env[site.env.length - 1]}` : '';
      if (!missing.has(site.env[0])) {
        missing.set(site.env[0], `${site.env[0]} (${site.what}${fallback})`);
      }
    }
  }
  return Array.from(missing.values());
}

// Replaces the placeholders and returns a restore() that puts the tracked
// files back byte for byte.
function injectCredentials(platform, dryRun) {
  const backups = new Map();
  const sites = sitesFor(platform);

  for (const site of sites) {
    if (!backups.has(site.file)) backups.set(site.file, readFile(site.file));
  }

  const restore = () => {
    for (const [file, contents] of backups) writeFile(file, contents);
    console.log('Restored credential placeholders in ' + Array.from(backups.keys()).join(', '));
  };

  if (dryRun) {
    for (const site of sites) console.log(`> (dry run) inject ${site.what} into ${site.file}`);
    return () => {};
  }

  try {
    for (const site of sites) {
      const value = envValue(site.env);
      const current = readFile(site.file);
      if (!site.pattern.test(current)) {
        throw new Error(`Could not find the ${site.what} placeholder in ${site.file} — the file changed shape, update CREDENTIAL_SITES in lib/util/release.js`);
      }
      // A value carrying a quote, angle bracket or backslash would produce a
      // file that no longer parses — better to say so than to ship it.
      if (site.unsafe && site.unsafe.test(value)) {
        throw new Error(`The ${site.env[0]} value contains a character that cannot be embedded in ${site.file} (${site.unsafe})`);
      }
      // `replace` keeps the surrounding capture groups and drops the value in
      // literally, so a key containing `$&` can't corrupt the file.
      writeFile(site.file, current.replace(site.pattern, (...m) => {
        const groups = m.slice(1, -2);
        return site.replace
          .replace(/\$(\d)/g, (_, n) => groups[Number(n) - 1] || '')
          .replace('<value>', value);
      }));
      console.log(`Injected ${site.what} into ${site.file}`);
    }
  } catch (err) {
    restore();
    throw err;
  }

  return restore;
}

// ---------------------------------------------------------------------------
// guards
// ---------------------------------------------------------------------------

function isCi() {
  return String(process.env.CI || '').toLowerCase() === 'true' || !!process.env.GITHUB_ACTIONS;
}

function gitStatus() {
  return capture('git status --porcelain', { soft: true, quiet: true });
}

function collectBlockers(platform, opts) {
  const options = opts || {};
  const blockers = [];

  if (!fs.existsSync(path.join(REPO_ROOT, 'node_modules'))) {
    blockers.push('node_modules is missing — run `./bin/na bootstrap ' + platform + '` first');
  }
  for (const cli of ['ionic', 'cordova']) {
    if (!fs.existsSync(path.join(REPO_ROOT, 'node_modules', '.bin', cli))) {
      blockers.push(`node_modules/.bin/${cli} is missing — run \`npm ci\``);
    }
  }

  for (const missing of missingCredentials(platform)) {
    blockers.push('missing credential: ' + missing);
  }

  if (platform === 'android') {
    for (const name of ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_PASSWORD']) {
      if (!process.env[name]) blockers.push('missing signing secret: ' + name);
    }
  }

  if (platform === 'ios') {
    if (process.platform !== 'darwin') blockers.push('iOS release builds require macOS');
    for (const name of ['IOS_DIST_CERT_BASE64', 'IOS_DIST_CERT_PASSWORD', 'IOS_TEAM_ID']) {
      if (!process.env[name]) blockers.push('missing signing secret: ' + name);
    }
    const hasProfile = !!process.env.IOS_PROVISIONING_PROFILE_BASE64;
    const ascKeys = ['APP_STORE_CONNECT_KEY_ID', 'APP_STORE_CONNECT_ISSUER_ID', 'APP_STORE_CONNECT_PRIVATE_KEY'];
    const missingAsc = ascKeys.filter(n => !process.env[n]);
    if (!hasProfile && missingAsc.length) {
      blockers.push('either IOS_PROVISIONING_PROFILE_BASE64 (manual signing) or ' + missingAsc.join(' + ') + ' (automatic signing) must be set');
    }
    if (process.platform === 'darwin' && !commandAvailable('xcodebuild')) {
      blockers.push('xcodebuild is not available (install Xcode and run xcode-select)');
    }
  }

  if (!options.allowDirty) {
    const status = gitStatus();
    if (status === null) {
      blockers.push('not a git checkout — release builds must be reproducible from a commit');
    } else if (status !== '') {
      const lines = status.split('\n');
      const shown = lines.slice(0, 10);
      if (lines.length > shown.length) shown.push(`… and ${lines.length - shown.length} more`);
      blockers.push('the git worktree has uncommitted changes (pass --allow-dirty to override):\n      ' + shown.join('\n      '));
    }
  }

  return blockers;
}

function assertReleaseReady(platform, opts) {
  const blockers = collectBlockers(platform, opts);
  if (blockers.length) {
    fail(`this checkout is not ready to build a signed ${platform} release`, blockers);
  }
  const versions = assertConsistentVersions();
  log(`Release preconditions OK — ${platform} ${versions.version} build ${versions.build} (versionCode ${versions.versionCode})`);
  return versions;
}

// ---------------------------------------------------------------------------
// misc
// ---------------------------------------------------------------------------

function ensureWorkDirs() {
  fs.mkdirSync(WORK_DIR, { recursive: true, mode: 0o700 });
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function cleanWorkDir() {
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
}

function writeSecretFile(filePath, contents, encoding) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, contents, { encoding: encoding || 'utf8', mode: 0o600 });
  return filePath;
}

function decodeBase64Secret(name) {
  const raw = (process.env[name] || '').replace(/\s+/g, '');
  if (!raw) throw new Error(`${name} is empty`);
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) throw new Error(`${name} does not decode to anything — is it base64?`);
  return buf;
}

// Puts node_modules/.bin first so the pinned local ionic/cordova are used
// instead of whatever happens to be installed globally.
function buildEnv(extra) {
  const localBin = path.join(REPO_ROOT, 'node_modules', '.bin');
  return Object.assign({}, process.env, {
    PATH: [localBin].concat((process.env.PATH || '').split(path.delimiter)).join(path.delimiter),
    // A release must never be a "the daemon had a stale build" mystery.
    CI: process.env.CI || 'true'
  }, extra || {});
}

// The draft release body carries a marked-up section with the tester-facing
// notes (the rest is the generated PR/commit changelog). Both stores get that
// section when it exists, the whole body otherwise.
const NOTES_START = '<!-- release-notes:start -->';
const NOTES_END = '<!-- release-notes:end -->';

function extractNotes(text) {
  if (!text) return '';
  let body = String(text);
  const start = body.indexOf(NOTES_START);
  const end = body.indexOf(NOTES_END);
  if (start !== -1 && end > start) {
    body = body.slice(start + NOTES_START.length, end);
  }
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map(l => l.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

function artifactName(version, build, ext) {
  return `nadanmark-${version}-${build}.${ext}`;
}

function homeDir() {
  return os.homedir();
}

module.exports = {
  REPO_ROOT,
  WORK_DIR,
  DIST_DIR,
  DEFAULT_KEY_ALIAS,
  CORDOVA_ANDROID_VERSION,
  CORDOVA_IOS_VERSION,
  log,
  section,
  run,
  runQuiet,
  capture,
  commandAvailable,
  fail,
  hasFlag,
  flagValue,
  readFile,
  writeFile,
  widgetAttr,
  setWidgetAttr,
  parseVersion,
  computeVersionCode,
  bumpVersion,
  readVersions,
  applyVersion,
  assertConsistentVersions,
  CREDENTIAL_SITES,
  missingCredentials,
  injectCredentials,
  isCi,
  collectBlockers,
  assertReleaseReady,
  ensureWorkDirs,
  cleanWorkDir,
  writeSecretFile,
  decodeBase64Secret,
  buildEnv,
  NOTES_START,
  NOTES_END,
  extractNotes,
  artifactName,
  homeDir
};
