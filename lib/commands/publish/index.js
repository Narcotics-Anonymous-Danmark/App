"use strict";

const path = require('path');

const SUBCOMMANDS = ['testflight', 'play'];

function usage() {
  console.log('Usage: na publish <subcommand> [options]');
  console.log('Subcommands:');
  console.log('  testflight  Upload a signed .ipa to App Store Connect (internal testing)');
  console.log('  play        Upload a signed .aab to Google Play (internal testing track)');
}

function run(args) {
  if (!args || args.length === 0) return usage();

  const sub = args[0];
  if (SUBCOMMANDS.indexOf(sub) === -1) {
    console.error(`Unknown subcommand: ${sub}`);
    return usage();
  }

  // cli.js turns a rejected promise into a readable error + exit 1.
  const mod = require(path.join(__dirname, sub));
  return mod.run(args.slice(1));
}

module.exports = { run, usage };
