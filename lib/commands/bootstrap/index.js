"use strict";

const path = require('path');

function run(args) {
  // If no subcommand provided, run the generic bootstrap
  if (!args || args.length === 0) {
    const mod = require(path.join(__dirname, 'bootstrap'));
    return mod.run([]);
  }

  const sub = args[0];
  if (sub === 'ios') {
    const mod = require(path.join(__dirname, 'ios'));
    return mod.run(args.slice(1));
  }

  console.log('Usage: na bootstrap [subcommand] [--dry-run]');
  console.log('Subcommands: ios');
}

module.exports = { run };
