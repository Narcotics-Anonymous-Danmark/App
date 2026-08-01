"use strict";

// `na release ios` — produces a signed, App Store ready .ipa without Xcode's
// UI (the README flow is Product -> Archive -> Distribute by hand).
//
// Signing works one of two ways:
//   * manual    — IOS_PROVISIONING_PROFILE_BASE64 is set. The profile is
//                 installed and its name is handed to cordova. Deterministic;
//                 the profile has to be re-exported when it expires.
//   * automatic — no profile secret. xcodebuild is given the App Store Connect
//                 API key and -allowProvisioningUpdates, so it fetches/creates
//                 the distribution profile itself.
// Either way the distribution certificate comes from IOS_DIST_CERT_BASE64 and
// lands in a throwaway keychain that is deleted again on the way out.

const path = require('path');
const fs = require('fs');
const release = require(path.join(__dirname, '..', '..', 'util', 'release'));

const KEYCHAIN_NAME = 'na-release.keychain-db';

function usage() {
  console.log('Usage: na release ios [--allow-dirty] [--dry-run] [--output <dir>]');
  console.log('');
  console.log('Builds a signed .ipa into dist/. Requires (all of them, or it refuses to run):');
  console.log('  IOS_DIST_CERT_BASE64             base64 .p12 with the Apple Distribution cert + private key');
  console.log('  IOS_DIST_CERT_PASSWORD           .p12 password');
  console.log('  IOS_TEAM_ID                      Apple Developer team id');
  console.log('  IOS_PROVISIONING_PROFILE_BASE64  base64 App Store .mobileprovision (manual signing)');
  console.log('    ...or APP_STORE_CONNECT_KEY_ID + _ISSUER_ID + _PRIVATE_KEY for automatic signing');
  console.log('  GOOGLE_MAPS_API_KEY              Maps key (GOOGLE_MAPS_IOS_API_KEY / GOOGLE_MAPS_JS_API_KEY override it)');
  console.log('  NA_API_BASIC_AUTH                "user:password" for the nadanmark.dk API');
  console.log('plus macOS, a clean git worktree and version numbers that agree (`na release check ios`).');
}

// ---------------------------------------------------------------------------
// keychain
// ---------------------------------------------------------------------------

function keychainPath() {
  return path.join(release.homeDir(), 'Library', 'Keychains', KEYCHAIN_NAME);
}

function deleteKeychain() {
  release.capture(`security delete-keychain "${keychainPath()}"`, { soft: true, quiet: true });
}

function importCertificate(dryRun) {
  if (dryRun) {
    console.log('> (dry run) create a temporary keychain and import IOS_DIST_CERT_BASE64');
    return;
  }

  const certPath = path.join(release.WORK_DIR, 'dist-cert.p12');
  release.writeSecretFile(certPath, release.decodeBase64Secret('IOS_DIST_CERT_BASE64'), null);

  const keychainPassword = require('crypto').randomBytes(24).toString('hex');
  const kc = keychainPath();

  deleteKeychain();
  release.runQuiet(`security create-keychain -p "${keychainPassword}" "${kc}"`, { display: 'security create-keychain <temporary>' });
  release.run(`security set-keychain-settings -lut 7200 "${kc}"`);
  release.runQuiet(`security unlock-keychain -p "${keychainPassword}" "${kc}"`, { display: 'security unlock-keychain <temporary>' });
  release.runQuiet(
    `security import "${certPath}" -k "${kc}" -P "$IOS_DIST_CERT_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security -f pkcs12`,
    { display: 'security import <distribution certificate>' }
  );
  release.runQuiet(
    `security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${keychainPassword}" "${kc}"`,
    { display: 'security set-key-partition-list' }
  );

  const existing = (release.capture('security list-keychains -d user', { quiet: true }) || '')
    .split('\n').map(l => l.trim().replace(/^"|"$/g, '')).filter(Boolean)
    .filter(p => p !== kc);
  release.run(`security list-keychains -d user -s "${kc}" ${existing.map(p => `"${p}"`).join(' ')}`);

  fs.rmSync(certPath, { force: true });

  const identities = release.capture(`security find-identity -v -p codesigning "${kc}"`, { soft: true, quiet: true }) || '';
  const names = (identities.match(/"[^"]+"/g) || []).map(n => n.replace(/"/g, ''));
  if (names.length === 0) {
    release.fail('no code signing identity found in the temporary keychain', [
      'IOS_DIST_CERT_BASE64 must be a .p12 containing a distribution certificate *and* its private key',
      'export it from Keychain Access under "My Certificates" — exporting the certificate alone leaves out the key'
    ]);
  }

  const distribution = names.filter(n => /^(Apple|iPhone) Distribution:/.test(n));
  if (distribution.length === 0) {
    release.fail('the certificate in IOS_DIST_CERT_BASE64 is not a distribution certificate', [
      'found: ' + names.join(', '),
      'an "Apple Development" certificate cannot sign an App Store build — export the Apple Distribution one'
    ]);
  }
  if (distribution.length > 1) {
    console.log('Several distribution identities in the .p12: ' + distribution.join(', '));
  }

  const identity = process.env.IOS_CODE_SIGN_IDENTITY || distribution[0];
  console.log('Signing identity: ' + identity);

  try {
    const logDir = path.join(release.REPO_ROOT, 'build-logs');
    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(
      path.join(logDir, 'signing.txt'),
      'Captured at import time, before the temporary keychain was deleted.\n' +
      '(A "0 valid identities" reading taken after the build is teardown, not a fault.)\n\n' +
      'keychain: ' + keychainPath() + '\n' +
      'chosen identity: ' + identity + '\n\n' +
      'security find-identity -v -p codesigning <temporary keychain>:\n' + identities + '\n',
      'utf8'
    );
  } catch (_) {
  }

  return identity;
}

// ---------------------------------------------------------------------------
// provisioning profile
// ---------------------------------------------------------------------------

function installProvisioningProfile(dryRun) {
  if (dryRun) {
    console.log('> (dry run) install IOS_PROVISIONING_PROFILE_BASE64');
    return { name: '<profile name>', uuid: '<uuid>' };
  }

  const raw = path.join(release.WORK_DIR, 'profile.mobileprovision');
  release.writeSecretFile(raw, release.decodeBase64Secret('IOS_PROVISIONING_PROFILE_BASE64'), null);

  const plistText = release.capture(`security cms -D -i "${raw}"`, { soft: true, quiet: true });
  if (!plistText) release.fail('could not decode IOS_PROVISIONING_PROFILE_BASE64 as a .mobileprovision');

  const read = key => {
    const m = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plistText);
    return m ? m[1] : null;
  };
  const uuid = read('UUID');
  const name = read('Name');
  const expires = /<key>ExpirationDate<\/key>\s*<date>([^<]*)<\/date>/.exec(plistText);

  if (!uuid || !name) release.fail('the provisioning profile has no UUID/Name — is it a .mobileprovision?');
  if (expires && new Date(expires[1]).getTime() < Date.now()) {
    release.fail(`the provisioning profile expired on ${expires[1]} — re-export it from developer.apple.com and update IOS_PROVISIONING_PROFILE_BASE64`);
  }

  const team = /<key>TeamIdentifier<\/key>\s*<array>\s*<string>([^<]*)<\/string>/.exec(plistText);
  if (team && process.env.IOS_TEAM_ID && team[1] !== process.env.IOS_TEAM_ID) {
    release.fail(`the provisioning profile belongs to team ${team[1]} but IOS_TEAM_ID is ${process.env.IOS_TEAM_ID}`);
  }
  const appId = /<key>application-identifier<\/key>\s*<string>([^<]*)<\/string>/.exec(plistText);
  const bundleId = release.widgetAttr(release.readFile('config.xml'), 'ios-CFBundleIdentifier');
  if (appId && bundleId && !appId[1].endsWith('.' + bundleId)) {
    release.fail(`the provisioning profile is for ${appId[1]}, not ${bundleId}`);
  }

  const targets = [
    path.join(release.homeDir(), 'Library', 'Developer', 'Xcode', 'UserData', 'Provisioning Profiles', `${uuid}.mobileprovision`),
    path.join(release.homeDir(), 'Library', 'MobileDevice', 'Provisioning Profiles', `${uuid}.mobileprovision`)
  ];
  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(raw, target);
  }
  fs.rmSync(raw, { force: true });

  console.log(`Installed provisioning profile "${name}" (${uuid}${expires ? ', expires ' + expires[1] : ''})`);
  return { name, uuid, path: targets[0], paths: targets };
}

// ---------------------------------------------------------------------------
// build config
// ---------------------------------------------------------------------------

function writeBuildConfig(identity, profile, dryRun) {
  const buildConfigPath = path.join(release.WORK_DIR, 'build.json');
  const ios = {
    developmentTeam: process.env.IOS_TEAM_ID,
    packageType: 'app-store'
  };

  if (profile) {
    ios.provisioningProfile = profile.name;
    ios.codeSignIdentity = identity;
  } else {
    ios.automaticProvisioning = true;
    ios.authenticationKeyID = process.env.APP_STORE_CONNECT_KEY_ID;
    ios.authenticationKeyIssuerID = process.env.APP_STORE_CONNECT_ISSUER_ID;
    ios.authenticationKeyPath = path.join(release.WORK_DIR, `AuthKey_${process.env.APP_STORE_CONNECT_KEY_ID}.p8`);
    if (!dryRun) {
      release.writeSecretFile(
        ios.authenticationKeyPath,
        release.normalizeApiPrivateKey(process.env.APP_STORE_CONNECT_PRIVATE_KEY)
      );
    }
  }

  if (dryRun) {
    console.log('> (dry run) write iOS signing config to ' + buildConfigPath);
    return buildConfigPath;
  }

  release.writeSecretFile(buildConfigPath, JSON.stringify({ ios: { release: ios } }, null, 2));
  if (profile) {
    console.log(`Signing style: manual — pinned to ${identity}`);
  } else {
    console.log('Signing style: automatic (App Store Connect API key); Xcode selects the certificate');
    if (process.env.IOS_CODE_SIGN_IDENTITY) {
      console.log('Note: IOS_CODE_SIGN_IDENTITY is set but only applies to manual signing. ' +
        'Supply IOS_PROVISIONING_PROFILE_BASE64 to pin the identity.');
    }
  }
  return buildConfigPath;
}

// ---------------------------------------------------------------------------
// platform + build
// ---------------------------------------------------------------------------

function ensurePlatform(env, dryRun) {
  const platformDir = path.join(release.REPO_ROOT, 'platforms', 'ios');

  if (dryRun) {
    console.log('> (dry run) point CocoaPods at the CDN (scripts/use-cocoapods-cdn.js)');
  } else if (!require(path.join(release.REPO_ROOT, 'scripts', 'use-cocoapods-cdn.js')).run(release.REPO_ROOT)) {
    release.fail('a CocoaPods/Specs git source survived — refusing to start a 4.9 GB clone on a billed macOS runner');
  }

  if (!fs.existsSync(platformDir)) {
    release.run(`cordova platform add ios@${release.CORDOVA_IOS_VERSION}`, { env, dryRun });
  } else {
    console.log('iOS platform already added');
  }

  release.run('cordova prepare ios', { env, dryRun });

  if (fs.existsSync(path.join(platformDir, 'Podfile')) || dryRun) {
    const podInstall = 'pod install --project-directory=./platforms/ios';
    if (dryRun) {
      console.log('> ' + podInstall);
    } else {
      try {
        release.run(podInstall, { env });
      } catch (_) {
        console.log('\npod install failed — retrying with --repo-update');
        release.run(podInstall + ' --repo-update', { env });
      }
    }
  }
}

function findIpa() {
  const buildDir = path.join(release.REPO_ROOT, 'platforms', 'ios', 'build', 'Release-iphoneos');
  if (!fs.existsSync(buildDir)) return null;
  const ipa = fs.readdirSync(buildDir).find(f => f.endsWith('.ipa'));
  return ipa ? path.join(buildDir, ipa) : null;
}

function verifyIpa(ipaPath, versions) {
  const tmp = path.join(release.WORK_DIR, 'ipa-check');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  release.capture(`unzip -o -q "${ipaPath}" 'Payload/*.app/Info.plist' -d "${tmp}"`, { quiet: true });

  const appDir = fs.readdirSync(path.join(tmp, 'Payload')).find(d => d.endsWith('.app'));
  const plistPath = path.join(tmp, 'Payload', appDir, 'Info.plist');
  const shortVersion = release.capture(`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${plistPath}"`, { quiet: true });
  const bundleVersion = release.capture(`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${plistPath}"`, { quiet: true });

  const problems = [];
  if (shortVersion !== versions.version) problems.push(`CFBundleShortVersionString ${shortVersion} != ${versions.version}`);
  if (bundleVersion !== String(versions.build)) problems.push(`CFBundleVersion ${bundleVersion} != ${versions.build}`);
  if (problems.length) release.fail('the built .ipa does not carry the release version', problems);

  const signed = release.capture(`unzip -l "${ipaPath}"`, { quiet: true, soft: true }) || '';
  if (!/_CodeSignature/.test(signed)) release.fail('the built .ipa contains no _CodeSignature — it is not signed');

  console.log(`Verified .ipa: ${shortVersion} (${bundleVersion}), signed`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function run(args) {
  args = args || [];
  if (release.hasFlag(args, '--help', '-h')) return usage();

  const dryRun = release.hasFlag(args, '--dry-run');
  const allowDirty = release.hasFlag(args, '--allow-dirty');
  const outputDir = path.resolve(release.flagValue(args, '--output', release.DIST_DIR));

  const versions = release.assertReleaseReady('ios', { allowDirty });

  release.ensureWorkDirs();
  fs.mkdirSync(outputDir, { recursive: true });

  let restoreCredentials = () => {};
  let profile = null;
  try {
    release.section('Setting up signing');
    const identity = importCertificate(dryRun) || 'Apple Distribution';
    if (process.env.IOS_PROVISIONING_PROFILE_BASE64) {
      profile = installProvisioningProfile(dryRun);
    }
    const buildConfigPath = writeBuildConfig(identity, profile, dryRun);

    release.section('Injecting credentials');
    restoreCredentials = release.injectCredentials('ios', dryRun);

    const env = release.buildEnv();
    process.env.PATH = env.PATH;

    release.section('Building the web app');
    release.run('ionic build', { env, dryRun });

    release.section('Preparing the iOS platform');
    ensurePlatform(env, dryRun);

    release.section('Archiving and exporting');
    release.run(
      `cordova build ios --release --device --buildConfig "${buildConfigPath}"`,
      { env, dryRun }
    );

    if (dryRun) {
      console.log('\n(dry run) would copy the .ipa to ' + path.join(outputDir, release.artifactName(versions.version, versions.build, 'ipa')));
      return;
    }

    const ipa = findIpa();
    if (!ipa) release.fail('cordova reported success but no .ipa was produced in platforms/ios/build/Release-iphoneos');

    verifyIpa(ipa, versions);

    const target = path.join(outputDir, release.artifactName(versions.version, versions.build, 'ipa'));
    fs.copyFileSync(ipa, target);

    release.section('Done');
    console.log(`Signed archive: ${target}`);
    console.log(`Version ${versions.version} build ${versions.build}`);
  } finally {
    restoreCredentials();
    if (!dryRun) {
      deleteKeychain();
      for (const p of (profile && (profile.paths || [profile.path])) || []) {
        if (p) fs.rmSync(p, { force: true });
      }
      release.cleanWorkDir();
    }
  }
}

module.exports = { run, usage };
