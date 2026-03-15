"use strict";

const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: na <command> [subcommand] [options]');
  console.log('Commands:');
  console.log('  help             Show general or command-specific help');
  console.log('  bootstrap ios    Run iOS bootstrap steps');
  console.log('  run ios          Build and run on device or simulator');
}

function run(argv) {
  if (!argv || argv.length === 0) {
    usage();
    process.exit(1);
  }

  const command = argv[0];
  const sub = argv[1];

  const commandPath = path.join(__dirname, 'commands', command);

  // command module can be a file or a folder with index.js
  try {
    if (!fs.existsSync(commandPath) && !fs.existsSync(commandPath + '.js')) {
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(2);
    }

    const cmdModule = require(commandPath);

    if (!sub) {
      if (typeof cmdModule.run === 'function') return cmdModule.run(argv.slice(1));
      console.error('Subcommand required');
      process.exit(3);
    }

    // expect subcommand module under command/<sub>.js or command/<sub>/index.js
    const subPath1 = path.join(commandPath, sub + '.js');
    const subPath2 = path.join(commandPath, sub, 'index.js');

    let subModulePath = null;
    if (fs.existsSync(subPath1)) subModulePath = subPath1;
    else if (fs.existsSync(subPath2)) subModulePath = subPath2;
    else {
      // maybe command file can handle subcommands
      if (typeof cmdModule.runSub === 'function') return cmdModule.runSub(sub, argv.slice(2));
      console.error(`Unknown subcommand: ${sub}`);
      usage();
      process.exit(4);
    }

    const subModule = require(subModulePath);
    if (typeof subModule.run !== 'function') {
      console.error('Invalid subcommand module, missing run()');
      process.exit(5);
    }

    return subModule.run(argv.slice(2));
  } catch (err) {
    console.error('Error running command:', err.message);
    console.error(err.stack);
    process.exit(10);
  }
}

module.exports = { run, usage };

if (require.main === module) {
  run(process.argv.slice(2));
}
