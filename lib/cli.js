"use strict";

const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: na <command> [subcommand] [options]');
  console.log('Commands:');
  console.log('  help             Show general or command-specific help');
  console.log('  bootstrap ios     Run iOS bootstrap steps');
  console.log('  bootstrap android Run Android bootstrap steps');
  console.log('  run ios           Build and run on device or simulator');
  console.log('  run android       Build and run on device or emulator');
  console.log('  release version   Set the release version/build number everywhere it is recorded');
  console.log('  release check     Report whether a signed release can be built here');
  console.log('  release android   Build a signed .aab for Google Play');
  console.log('  release ios       Build a signed .ipa for App Store Connect');
  console.log('  publish testflight Upload an .ipa to TestFlight internal testing');
  console.log('  publish play      Upload an .aab to the Play internal + closed tracks');
}

// Async commands (the store uploads) must fail the process with a readable
// message instead of an unhandled rejection dump.
function settle(result) {
  if (result && typeof result.catch === 'function') {
    return result.catch(err => {
      console.error('\nError: ' + (err && err.message ? err.message : err));
      process.exit(1);
    });
  }
  return result;
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
      if (typeof cmdModule.run === 'function') return settle(cmdModule.run(argv.slice(1)));
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

    return settle(subModule.run(argv.slice(2)));
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
