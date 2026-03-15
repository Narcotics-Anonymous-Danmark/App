"use strict";

const { execSync } = require('child_process');
const fs = require('fs');

function runCmd(cmd, dryRun) {
  console.log('> ' + cmd);
  if (dryRun) return;
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function cmdExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: true });
    return true;
  } catch (_) {
    return false;
  }
}

function npmVersionMatches(version) {
  try {
    const out = execSync('npm -v', { encoding: 'utf8', shell: true }).trim();
    return out === version;
  } catch (_) {
    return false;
  }
}

function ensureNpm(version, dryRun, force) {
  if (!force && npmVersionMatches(version)) {
    console.log(`npm ${version} already installed`);
    return;
  }
  runCmd(`npm install npm@${version} -g`, dryRun);
}

function ensureIonic(version, dryRun, force) {
  if (!force && cmdExists('ionic')) {
    console.log('ionic already available');
    return;
  }
  runCmd(`npm install -g ionic@${version}`, dryRun);
}

function ensureCordova(version, dryRun, force) {
  if (!force && cmdExists('cordova')) {
    console.log('cordova already available');
    return;
  }
  runCmd(`npm install -g cordova@${version}`, dryRun);
}

function ensureNodeModules(dryRun, force) {
  if (!force && fs.existsSync('node_modules')) {
    console.log('node_modules exists, skipping npm ci');
    return;
  }
  runCmd('npm ci', dryRun);
}

function ensureLocalPackage(nameWithVersion, dryRun, force) {
  const pkg = nameWithVersion.split('@')[0];
  if (!force && fs.existsSync(`node_modules/${pkg}`)) {
    console.log(`${pkg} already installed locally`);
    return;
  }
  runCmd(`npm install ${nameWithVersion}`, dryRun);
}

function ionicBuild(dryRun, force) {
  if (!force && fs.existsSync('www')) {
    console.log('www directory exists, skipping ionic build');
    return;
  }
  runCmd('ionic build', dryRun);
}

function run(args) {
  const dryRun = args && args.indexOf('--dry-run') !== -1;
  const force = args && args.indexOf('--force') !== -1;

  console.log('Running general bootstrap' + (dryRun ? ' (dry-run)' : '') + (force ? ' (force)' : '') + '\n');

  ensureNpm('8.1.0', dryRun, force);
  ensureIonic('4.0.0', dryRun, force);
  ensureCordova('12.0.0', dryRun, force);
  ensureNodeModules(dryRun, force);
  ensureLocalPackage('cordova-fetch@3.0.1', dryRun, force);
  ensureLocalPackage('properties-parser@0.5.1', dryRun, force);
  ionicBuild(dryRun, force);

  console.log('\nGeneral bootstrap complete.');
}

function usage() {
  console.log('Usage: na bootstrap [--dry-run] [--force]');
}

module.exports = { run, usage, ensureNpm, ensureIonic, ensureCordova };
