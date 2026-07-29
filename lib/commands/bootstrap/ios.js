"use strict";

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

function runCmd(cmd, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function platformStatus() {
  // Returns an object { cordovaListed: bool, dirExists: bool }
  let cordovaListed = false;
  let dirExists = fs.existsSync('platforms/ios');

  if (commandAvailable('cordova')) {
    try {
      const out = execSync('cordova platforms ls', { encoding: 'utf8', shell: true });
      cordovaListed = out.includes('ios');
    } catch (_) {
      cordovaListed = false;
    }
  }

  return { cordovaListed, dirExists };
}

function addPlatformIos(dryRun, force) {
  const status = platformStatus();

  // If cordova reports the platform and the directory exists, skip unless forced
  if (status.cordovaListed && status.dirExists && !force) {
    console.log('iOS platform already added, skipping');
    return;
  }

  // If cordova lists the platform but the directory is missing, treat as inconsistent
  if (status.cordovaListed && !status.dirExists) {
    console.warn('cordova lists iOS platform but platforms/ios is missing — will re-add platform');
    if (commandAvailable('cordova') && force) {
      runCmd('cordova platform rm ios', dryRun);
    }
  }

  // Otherwise, add the platform
  runCmd('cordova platform add ios@7.1.0', dryRun);
}

function ensureIosDeploy(dryRun, force) {
  if (!force && commandAvailable('ios-deploy')) {
    console.log('ios-deploy already available');
    return;
  }
  runCmd('npm install -g ios-deploy', dryRun);
}

function podRepoUpdate(dryRun) {
  if (!commandAvailable('pod')) {
    console.warn('`pod` command not available — please install CocoaPods if you need iOS pods');
    return;
  }
  runCmd('pod repo update', dryRun);
}

function podInstall(dryRun) {
  runCmd('pod install --project-directory=./platforms/ios', dryRun);
}

function prepareIos(dryRun) {
  runCmd('cordova prepare ios', dryRun);
}

function commandAvailable(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: true });
    return true;
  } catch (_) {
    return false;
  }
}

function run(args) {
  const dryRun = args && args.indexOf('--dry-run') !== -1;
  const force = args && args.indexOf('--force') !== -1;

  // First run the generic bootstrap steps
  const bootstrap = require(path.join(__dirname, 'bootstrap'));
  bootstrap.run(args);

  console.log('\nRunning iOS-specific bootstrap' + (dryRun ? ' (dry-run)' : '') + (force ? ' (force)' : '') + '\n');

  addPlatformIos(dryRun, force);
  ensureIosDeploy(dryRun, force);
  podRepoUpdate(dryRun);
  podInstall(dryRun);
  prepareIos(dryRun);

  console.log('\nIOS bootstrap complete.');
}

function usage() {
  console.log('Usage: na bootstrap ios [--dry-run] [--force]');
}

module.exports = { run, usage, addPlatformIos, ensureIosDeploy };
