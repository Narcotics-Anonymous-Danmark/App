"use strict";

const path = require('path');

function run(args) {
  // If no subcommand provided, show usage
  if (!args || args.length === 0) {
    console.log('Usage: na run [subcommand] [options]');
    console.log('Subcommands: ios, android');
    return;
  }

  const sub = args[0];
  if (sub === 'ios') {
    const mod = require(path.join(__dirname, 'ios'));
    return mod.run(args.slice(1));
  }

  if (sub === 'android') {
    const mod = require(path.join(__dirname, 'android'));
    return mod.run(args.slice(1));
  }

  console.log('Usage: na run [subcommand] [options]');
  console.log('Subcommands: ios, android');
}

module.exports = { run };
