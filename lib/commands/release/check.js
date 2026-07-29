"use strict";

// `na release check <platform>` — the same guard the release build runs, but as
// a report. Handy locally ("what am I missing?") and as a fast CI pre-flight.

const path = require('path');
const release = require(path.join(__dirname, '..', '..', 'util', 'release'));

function usage() {
  console.log('Usage: na release check [android|ios] [--allow-dirty]');
  console.log('Lists everything that would stop a signed release build. Exits 1 if anything is missing.');
}

function run(args) {
  args = args || [];
  if (release.hasFlag(args, '--help', '-h')) return usage();

  const platforms = args.filter(a => a === 'android' || a === 'ios');
  const targets = platforms.length ? platforms : ['android', 'ios'];
  const allowDirty = release.hasFlag(args, '--allow-dirty');

  const versions = release.readVersions();
  console.log(`Version: ${versions.config} build ${versions.iosBuild || 'unset'} (versionCode ${versions.versionCode})`);
  console.log(`  package.json: ${versions.package}   environment.ts: ${versions.environment}`);

  let ready = true;
  for (const platform of targets) {
    const blockers = release.collectBlockers(platform, { allowDirty });
    if (blockers.length === 0) {
      console.log(`\n${platform}: ready`);
    } else {
      ready = false;
      console.log(`\n${platform}: NOT ready`);
      for (const b of blockers) console.log('  - ' + b);
    }
  }

  if (!ready) process.exit(1);
}

module.exports = { run, usage };
