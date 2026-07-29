"use strict";

// `na publish play` — uploads a signed .aab straight to the Google Play
// Developer API and rolls it out to the internal + closed testing tracks in a
// single edit (all or nothing: if any track fails, the edit is discarded and
// nothing changes in the Play Console).

const path = require('path');
const fs = require('fs');
const release = require(path.join(__dirname, '..', '..', 'util', 'release'));
const play = require(path.join(__dirname, '..', '..', 'util', 'play'));

const DEFAULT_TRACKS = ['internal', 'alpha'];

function usage() {
  console.log('Usage: na publish play --aab <file> [options]');
  console.log('');
  console.log('  --aab <file>       Signed .aab to upload (required)');
  console.log('  --tracks a,b       Tracks to release to (default: ' + DEFAULT_TRACKS.join(',') + ', or $PLAY_TRACKS)');
  console.log('  --version <x.y.z>  Version name (default: config.xml)');
  console.log('  --build <n>        Build number (default: config.xml ios-CFBundleVersion)');
  console.log('  --notes <file|->   Release notes; needs $PLAY_RELEASE_NOTES_LANGUAGE (e.g. da-DK) to be sent');
  console.log('  --draft            Create the track release as draft instead of rolling it out');
  console.log('  --yes              Required outside CI — this pushes a build to real testers');
  console.log('');
  console.log('Requires PLAY_SERVICE_ACCOUNT_JSON (the service account key, raw JSON or base64).');
  console.log('The service account needs "Release to testing tracks" on this app in the Play Console.');
}

function readNotes(args) {
  const notesArg = release.flagValue(args, '--notes', null);
  if (!notesArg) return '';
  const raw = notesArg === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(notesArg, 'utf8');
  return release.extractNotes(raw);
}

async function run(args) {
  args = args || [];
  if (release.hasFlag(args, '--help', '-h') || args.length === 0) return usage();

  const aabPath = release.flagValue(args, '--aab', null);
  if (!aabPath) return release.fail('--aab <file> is required');
  if (!fs.existsSync(aabPath)) return release.fail(`no such file: ${aabPath}`);
  if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) return release.fail('missing PLAY_SERVICE_ACCOUNT_JSON');

  if (!release.isCi() && !release.hasFlag(args, '--yes')) {
    return release.fail('refusing to upload to Google Play without --yes (this pushes a build to real testers)');
  }

  const configured = readConfig();
  const version = release.flagValue(args, '--version', configured.version);
  const build = release.flagValue(args, '--build', configured.build);
  const packageName = configured.packageName;

  const tracks = (release.flagValue(args, '--tracks', process.env.PLAY_TRACKS || DEFAULT_TRACKS.join(',')))
    .split(',').map(t => t.trim()).filter(Boolean);
  if (!tracks.length) return release.fail('no tracks to release to');

  const notes = readNotes(args);
  const notesLanguage = process.env.PLAY_RELEASE_NOTES_LANGUAGE || '';

  console.log(`Uploading ${path.basename(aabPath)} — ${packageName} ${version} (${build})`);
  console.log(`Tracks: ${tracks.join(', ')}`);

  const token = await play.accessToken();
  const api = play.client(token, packageName);

  const editId = await api.insertEdit();
  console.log('Opened Play edit ' + editId);

  try {
    const bundle = await api.uploadBundle(editId, aabPath);
    console.log(`Uploaded bundle: versionCode ${bundle.versionCode}`);

    const trackRelease = {
      name: `${version} (${build})`,
      versionCodes: [String(bundle.versionCode)],
      status: release.hasFlag(args, '--draft') ? 'draft' : 'completed'
    };

    // Play rejects release notes for a language the listing does not have, so
    // they are opt-in via PLAY_RELEASE_NOTES_LANGUAGE.
    if (notes && notesLanguage) {
      trackRelease.releaseNotes = notesLanguage.split(',').map(lang => ({
        language: lang.trim(),
        text: notes.slice(0, 500)
      }));
    } else if (notes) {
      console.log('PLAY_RELEASE_NOTES_LANGUAGE is not set — uploading without release notes');
    }

    for (const track of tracks) {
      await api.updateTrack(editId, track, trackRelease);
      console.log(`Track "${track}": ${trackRelease.status} — ${trackRelease.name}`);
    }

    await api.commit(editId);
    release.section('Done');
    console.log(`Google Play: ${version} (${build}), versionCode ${bundle.versionCode}, tracks ${tracks.join(', ')}`);
  } catch (err) {
    console.error('\nUpload failed — discarding the Play edit so nothing is left half-applied.');
    try {
      await api.deleteEdit(editId);
    } catch (cleanupErr) {
      console.error('Could not discard edit ' + editId + ': ' + cleanupErr.message);
    }
    throw err;
  }
}

function readConfig() {
  const xml = release.readFile('config.xml');
  return {
    packageName: release.widgetAttr(xml, 'id'),
    version: release.widgetAttr(xml, 'version'),
    build: release.widgetAttr(xml, 'ios-CFBundleVersion') || '1'
  };
}

module.exports = { run, usage };
