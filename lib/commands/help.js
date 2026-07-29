"use strict";

const path = require('path');

function run(args) {
  const cli = require(path.join(__dirname, '..', 'cli'));

  if (!args || args.length === 0) {
    return cli.usage();
  }

  const command = args[0];
  const commandPath = path.join(__dirname, command);

  try {
    const mod = require(commandPath);
    if (typeof mod.usage === 'function') return mod.usage();
    if (typeof mod.help === 'function') return mod.help();
    console.log(`No detailed help available for '${command}'.`);
  } catch (err) {
    console.error(`Unknown command: ${command}`);
    cli.usage();
  }
}

module.exports = { run };
