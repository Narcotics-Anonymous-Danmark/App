"use strict";

// `na publish testflight` — uploads a signed .ipa with Apple's own iTMS
// Transporter (bundled with Xcode, no third-party tooling), waits for
// processing and then hands the build to the internal TestFlight group(s) over
// the App Store Connect API.

const path = require('path');
const fs = require('fs');
const release = require(path.join(__dirname, '..', '..', 'util', 'release'));
const asc = require(path.join(__dirname, '..', '..', 'util', 'asc'));

function usage() {
  console.log('Usage: na publish testflight --ipa <file> [options]');
  console.log('');
  console.log('  --ipa <file>          Signed .ipa to upload (required)');
  console.log('  --notes <file|->      "What to Test" text; - reads stdin. The release-notes marker section wins.');
  console.log('  --group <name>        Internal TestFlight group to add the build to (default: every internal group)');
  console.log('  --wait-minutes <n>    How long to wait for Apple to process the build (default 45)');
  console.log('  --no-wait             Upload only; do not wait or assign to a group');
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
  const raw = process.env.APP_STORE_CONNECT_PRIVATE_KEY;
  const contents = raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
  const target = path.join(release.homeDir(), '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
  release.writeSecretFile(target, contents.endsWith('\n') ? contents : contents + '\n');
  console.log('Installed App Store Connect API key at ' + target);
  return target;
}

function transporterPath() {
  const direct = release.capture('xcrun --find iTMSTransporter', { soft: true, quiet: true });
  if (direct && fs.existsSync(direct)) return direct;

  const developerDir = release.capture('xcode-select -p', { soft: true, quiet: true });
  if (developerDir) {
    const bundled = path.join(
      developerDir, '..', 'SharedFrameworks', 'ContentDeliveryServices.framework',
      'Versions', 'A', 'Frameworks', 'iTMSTransporter.framework', 'Versions', 'A', 'Resources', 'iTMSTransporter'
    );
    if (fs.existsSync(bundled)) return bundled;
  }
  return null;
}

function upload(ipaPath) {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuer = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const transporter = transporterPath();

  if (transporter) {
    console.log('Uploading with iTMS Transporter');
    release.run(
      `"${transporter}" -m upload -assetFile "${ipaPath}" -apiKey "${keyId}" -apiIssuer "${issuer}" -v informational`,
      { display: `iTMSTransporter -m upload -assetFile ${path.basename(ipaPath)} -apiKey <key> -apiIssuer <issuer>` }
    );
    return;
  }

  // Same job, same Apple tooling, different front end — used when the runner's
  // Xcode does not ship the Transporter binary.
  console.log('iTMS Transporter not found in this Xcode — falling back to xcrun altool');
  release.run(
    `xcrun altool --upload-app -f "${ipaPath}" -t ios --apiKey "${keyId}" --apiIssuer "${issuer}"`,
    { display: `xcrun altool --upload-app -f ${path.basename(ipaPath)} --apiKey <key> --apiIssuer <issuer>` }
  );
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
    console.log('\nUploaded. --no-wait given, so not waiting for processing or assigning testers.');
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

  release.section('Handing the build to internal testers');
  const groupName = release.flagValue(args, '--group', process.env.TESTFLIGHT_INTERNAL_GROUP || null);
  const groups = await asc.internalGroups(appId, groupName);
  if (groups.length === 0) {
    console.log('No internal TestFlight groups exist — the build is on TestFlight but you will have to');
    console.log('add it to a group in App Store Connect (or create an internal group once).');
    return;
  }

  for (const group of groups) {
    await asc.addBuildToGroup(group.id, build.id);
    console.log(`Added build ${info.version} (${info.build}) to internal group "${group.attributes.name}"`);
  }

  release.section('Done');
  console.log(`TestFlight: ${info.version} (${info.build}) is available to internal testers`);
}

module.exports = { run, usage };
