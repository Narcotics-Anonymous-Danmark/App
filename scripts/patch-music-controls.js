#!/usr/bin/env node
/**
 * cordova-plugin-music-controls2@3.0.7 predates Android 14 (API 34) hardening
 * and breaks on this app's target SDK (35) in two ways. This app can't ship
 * the plugin unpatched, and 3.0.7 is the latest published version, so we patch
 * it here:
 *
 *   1. registerReceiver() is called without the RECEIVER_EXPORTED /
 *      RECEIVER_NOT_EXPORTED flag Android 14 makes mandatory -> SecurityException
 *      on initialize, so the media notification / foreground service never start.
 *      Fix: route the calls through androidx ContextCompat.registerReceiver with
 *      RECEIVER_EXPORTED (handles the API-level branching, compiles to minSdk 26).
 *
 *   2. The notification actions and the media-button receiver build PendingIntents
 *      from *implicit* intents (new Intent("music-controls-...")) with FLAG_MUTABLE.
 *      Android 14 disallows mutable + implicit PendingIntents -> IllegalArgumentException
 *      that crashes the activity in a restart loop. Fix: make the intents explicit
 *      by setting the package; explicit + mutable is allowed, so the media button
 *      keeps the mutability it needs, and the broadcasts are delivered to our own
 *      dynamically-registered receiver.
 *
 * Runs as a cordova before_compile hook: `cordova prepare` re-copies the plugin
 * into platforms/android on every build, so this re-applies (idempotently) after
 * each copy. It also patches the plugin source at rest so a fresh checkout is
 * correct before the first build. See docs/media-player.md.
 */
const fs = require('fs');
const path = require('path');

const CONTEXTCOMPAT_IMPORT = 'import androidx.core.content.ContextCompat;';
const REGISTER_RE =
    /context\.registerReceiver\(\(BroadcastReceiver\)mMessageReceiver, new IntentFilter\(([^;]*?)\)\);/g;
// Implicit "music-controls-*" intents that must become explicit. Matches both
// new Intent("music-controls-play") and new Intent(SomeVar) is NOT matched — only
// the string-action form the plugin uses.
const IMPLICIT_INTENT_RE = /new Intent\((\"music-controls-[a-z-]+\")\)(?!\.setPackage)/g;

function patchRegisterReceiver(src) {
    if (src.indexOf('ContextCompat.registerReceiver') !== -1 || !REGISTER_RE.test(src)) {
        return src;
    }
    REGISTER_RE.lastIndex = 0;
    src = src.replace(
        REGISTER_RE,
        'ContextCompat.registerReceiver(context, (BroadcastReceiver)mMessageReceiver, new IntentFilter($1), ContextCompat.RECEIVER_EXPORTED);'
    );
    if (src.indexOf(CONTEXTCOMPAT_IMPORT) === -1) {
        src = src.replace(
            'package com.homerours.musiccontrols;',
            'package com.homerours.musiccontrols;\n\n' + CONTEXTCOMPAT_IMPORT
        );
    }
    return src;
}

function patchImplicitIntents(src) {
    // context is in scope everywhere these intents are built.
    return src.replace(IMPLICIT_INTENT_RE, 'new Intent($1).setPackage(context.getPackageName())');
}

function patchFile(file) {
    if (!fs.existsSync(file)) {
        return false;
    }
    const before = fs.readFileSync(file, 'utf8');
    let after = patchRegisterReceiver(before);
    after = patchImplicitIntents(after);
    if (after === before) {
        return false;
    }
    fs.writeFileSync(file, after, 'utf8');
    return true;
}

function run(projectRoot) {
    const targets = [
        'plugins/cordova-plugin-music-controls2/src/android/MusicControls.java',
        'plugins/cordova-plugin-music-controls2/src/android/MusicControlsNotification.java',
        'platforms/android/app/src/main/java/com/homerours/musiccontrols/MusicControls.java',
        'platforms/android/app/src/main/java/com/homerours/musiccontrols/MusicControlsNotification.java'
    ];
    targets.forEach((rel) => {
        if (patchFile(path.join(projectRoot, rel))) {
            console.log('[patch-music-controls] patched ' + rel);
        }
    });
}

// Works both as a cordova hook (module.exports) and standalone (node scripts/...).
module.exports = (context) => {
    const root = (context && context.opts && context.opts.projectRoot) || process.cwd();
    run(root);
};

if (require.main === module) {
    run(process.cwd());
}
