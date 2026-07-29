"use strict";

// `na release version` — the single place that decides what a release is
// numbered. iOS and Android share the version and the build number so a
// release candidate is one number for both stores.

const path = require('path');
const fs = require('fs');
const release = require(path.join(__dirname, '..', '..', 'util', 'release'));

function usage() {
  console.log('Usage: na release version [<x.y.z>] [--bump patch|minor|major|none] [--build <n>] [--print] [--github-output]');
  console.log('');
  console.log('Writes the release version + build number into every file that has to agree:');
  console.log('  config.xml (version, android-versionCode, ios-CFBundleVersion), package.json,');
  console.log('  package-lock.json and src/environments/environment.ts');
  console.log('');
  console.log('  <x.y.z>           Explicit version. Omit to derive one from --bump.');
  console.log('  --bump <kind>     Bump the current config.xml version (default: patch when no version is given).');
  console.log('  --build <n>       Build number 1-999 for this version (default: 1). Bump it to re-release the');
  console.log('                    same version after a rejected/failed upload — both stores need a fresh build.');
  console.log('  --print           Only print what the numbers would be; change nothing.');
  console.log('  --github-output   Append version/build/version_code/tag to $GITHUB_OUTPUT.');
}

function run(args) {
  args = args || [];

  if (release.hasFlag(args, '--help', '-h')) return usage();

  const current = release.readVersions();
  const explicit = args.find(a => /^\d+\.\d+\.\d+$/.test(a));
  const bump = release.flagValue(args, '--bump', explicit ? 'none' : 'patch');
  const build = release.flagValue(args, '--build', '1');
  const printOnly = release.hasFlag(args, '--print');

  let version;
  try {
    version = explicit || release.bumpVersion(current.config, bump);
  } catch (err) {
    return release.fail(err.message);
  }

  let result;
  try {
    const versionCode = release.computeVersionCode(version, build);
    result = { version, build: Number(build), versionCode };
  } catch (err) {
    return release.fail(err.message);
  }

  console.log(`Current: ${current.config} (versionCode ${current.versionCode}, iOS build ${current.iosBuild || 'unset'})`);
  console.log(`Release: ${result.version} build ${result.build} (versionCode ${result.versionCode})`);

  if (!printOnly) {
    release.applyVersion(result.version, result.build);
    console.log('Updated config.xml, package.json, package-lock.json and src/environments/environment.ts');
  }

  if (release.hasFlag(args, '--github-output') && process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, [
      `version=${result.version}`,
      `build=${result.build}`,
      `version_code=${result.versionCode}`,
      // Existing releases are tagged with the bare version (1.2.3). A repeat
      // build of the same version needs its own tag, hence the suffix.
      `tag=${result.build === 1 ? result.version : result.version + '-b' + result.build}`,
      `previous_version=${current.config}`,
      ''
    ].join('\n'), 'utf8');
  }

  return result;
}

module.exports = { run, usage };
