"use strict";

// `na publish testflight` — uploads a signed .ipa with Apple's own iTMS
// Transporter (bundled with Xcode, no third-party tooling)

const path = require('path');
const fs = require('fs');
const release = require(path.join(__dirname, '..', '..', 'util', 'release'));
const asc = require(path.join(__dirname, '..', '..', 'util', 'asc'));

function usage() {
  console.log('Usage: na publish testflight --ipa <file> [options]');
  console.log('');
  console.log('  --ipa <file>          Signed .ipa to upload (required)');
  console.log('  --notes <file|->      "What to Test" text; - reads stdin. The release-notes marker section wins.');
  console.log('  --wait-minutes <n>    How long to wait for Apple to process the build (default 45)');
  console.log('  --no-wait             Upload only; do not wait for processing or set "What to Test"');
  console.log('  --yes                 Required outside CI — this pushes a build to real testers');
  console.log('');
  console.log('Requires APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID and');
  console.log('APP_STORE_CONNECT_PRIVATE_KEY (the .p8 contents).');
}

function readIpaVersion(ipaPath) {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'na-ipa-'));
  try {
    release.capture(`unzip -o -q "${ipaPath}" 'Payload/*.app/Info.plist' -d "${tmp}"`, { quiet: true });
    const appDir = fs.readdirSync(path.join(tmp, 'Payload')).find(d => d.endsWith('.app'));
    const plist = path.join(tmp, 'Payload', appDir, 'Info.plist');
    return {
      version: release.capture(`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${plist}"`, { quiet: true }),
      build: release.capture(`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${plist}"`, { quiet: true }),
      bundleId: release.capture(`/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${plist}"`, { quiet: true })
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Transporter reads the API key from a private_keys directory next to the
// working dir or under ~/.appstoreconnect.
function installApiKey() {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const contents = release.normalizeApiPrivateKey(process.env.APP_STORE_CONNECT_PRIVATE_KEY);
  const target = path.join(release.homeDir(), '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
  release.writeSecretFile(target, contents);
  console.log('Installed App Store Connect API key at ' + target);
  return target;
}

function usableTransporter() {
  const found = release.capture('xcrun --find iTMSTransporter', { soft: true, quiet: true });
  if (!found || !fs.existsSync(found)) return null;

  let resolved = found;
  try {
    resolved = fs.realpathSync(found);
  } catch (_) {
    return null;
  }
  if (/shim$/i.test(path.basename(resolved)) && !fs.existsSync('/Applications/Transporter.app')) {
    return null;
  }
  return found;
}

function upload(ipaPath) {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuer = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const file = path.resolve(ipaPath);
  const shown = path.basename(file);

  try {
    release.run(
      `xcrun altool --upload-app -f "${file}" -t ios --apiKey "${keyId}" --apiIssuer "${issuer}"`,
      { display: `xcrun altool --upload-app -f ${shown} -t ios --apiKey <key> --apiIssuer <issuer>` }
    );
    return;
  } catch (err) {
    const transporter = usableTransporter();
    if (!transporter) throw err;
    console.log('\naltool failed — retrying with the installed iTMS Transporter');
    release.run(
      `"${transporter}" -m upload -assetFile "${file}" -apiKey "${keyId}" -apiIssuer "${issuer}" -v informational`,
      { display: `iTMSTransporter -m upload -assetFile ${shown} -apiKey <key> -apiIssuer <issuer>` }
    );
  }
}

function readNotes(args) {
  const notesArg = release.flagValue(args, '--notes', null);
  if (!notesArg) return '';
  const raw = notesArg === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(notesArg, 'utf8');
  return release.extractNotes(raw);
}

async function run(args) {
  args = args || [];
  if (release.hasFlag(args, '--help', '-h') || args.length === 0) return usage();

  const ipaPath = release.flagValue(args, '--ipa', null);
  if (!ipaPath) return release.fail('--ipa <file> is required');
  if (!fs.existsSync(ipaPath)) return release.fail(`no such file: ${ipaPath}`);
  if (process.platform !== 'darwin') return release.fail('uploading to App Store Connect needs macOS (Xcode ships the uploader)');

  const missing = ['APP_STORE_CONNECT_KEY_ID', 'APP_STORE_CONNECT_ISSUER_ID', 'APP_STORE_CONNECT_PRIVATE_KEY']
    .filter(n => !process.env[n]);
  if (missing.length) return release.fail('missing App Store Connect credentials', missing);

  if (!release.isCi() && !release.hasFlag(args, '--yes')) {
    return release.fail('refusing to upload to TestFlight without --yes (this pushes a build to real testers)');
  }

  const info = readIpaVersion(ipaPath);
  console.log(`Uploading ${path.basename(ipaPath)} — ${info.bundleId} ${info.version} (${info.build})`);

  installApiKey();
  upload(ipaPath);

  if (release.hasFlag(args, '--no-wait')) {
    console.log('\nUploaded. --no-wait given, so not waiting for processing or setting "What to Test".');
    return;
  }

  release.section('Waiting for App Store Connect to finish processing');
  const appId = await asc.appIdForBundleId(info.bundleId);
  const build = await asc.waitForBuild(appId, info.version, info.build, {
    timeoutMinutes: Number(release.flagValue(args, '--wait-minutes', '45')),
    intervalSeconds: 30
  });

  const notes = readNotes(args);
  if (notes) {
    await asc.setWhatsNew(build.id, notes);
  }

  release.section('Done');
  console.log(`TestFlight: ${info.version} (${info.build}) has finished processing`);
}

module.exports = { run, usage };
