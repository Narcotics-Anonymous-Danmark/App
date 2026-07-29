"use strict";

const path = require('path');

const SUBCOMMANDS = ['android', 'ios', 'version', 'check'];

function usage() {
  console.log('Usage: na release <subcommand> [options]');
  console.log('Subcommands:');
  console.log('  version   Set the release version + build number across config.xml/package.json/environment.ts');
  console.log('  check     Report whether this checkout can build a signed release (exits non-zero if not)');
  console.log('  android   Build a signed .aab for Google Play');
  console.log('  ios       Build a signed .ipa for App Store Connect (macOS only)');
  console.log('');
  console.log('The android/ios builds refuse to run unless every condition is met: signing secrets and');
  console.log('API credentials in the environment, a clean git worktree and consistent version numbers.');
  console.log('See the "Automated releases" section of the README for the full list.');
}

function run(args) {
  if (!args || args.length === 0) return usage();

  const sub = args[0];
  if (SUBCOMMANDS.indexOf(sub) === -1) {
    console.error(`Unknown subcommand: ${sub}`);
    return usage();
  }

  const mod = require(path.join(__dirname, sub));
  return mod.run(args.slice(1));
}

module.exports = { run, usage };
