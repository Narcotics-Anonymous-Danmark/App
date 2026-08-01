#!/usr/bin/env node
/**
 * Removes cordova-plugin-advanced-http's direct imports of <netinet6/in6.h>,
 * which stop the build outright from Xcode 26 / the iOS 26 SDK:
 *
 *   SM_AFNetworkReachabilityManager.m:26:9: error: Use of private header from
 *   outside its module: 'netinet6/in6.h'
 *
 * in6.h is a *private* header of the Darwin module. Importing it directly is
 * illegal under -fmodules, which cordova-ios builds with. Older toolchains let
 * it pass; Xcode 26's clang does not, and there is no way round it from build
 * settings short of turning modules off for the whole target.
 *
 * Deleting the import is safe, and is what AFNetworking itself did upstream:
 *
 *   - netinet/in.h already does #include <netinet6/in6.h> (line 657 of the SDK
 *     header), and both files import netinet/in.h immediately above, so every
 *     declaration stays visible. SM_AFNetworkReachabilityManager.m keeps its
 *     struct sockaddr_in6 / sin6_len / sin6_family.
 *   - SM_AFHTTPSessionManager.m references no in6 symbol at all; the import is
 *     vestigial there.
 *
 * The vendored copy is called SM_AFNetworking (the plugin renames AFNetworking
 * to avoid colliding with an app that ships its own), so upstream's fix will
 * never arrive here on its own.
 *
 * Runs as a before_compile hook: cordova prepare re-copies the plugin into
 * platforms/ on every build, so this re-applies (idempotently) after each copy,
 * and it also patches the plugin source at rest. Exits non-zero if an import
 * survives, so a plugin upgrade that reintroduces one fails loudly rather than
 * costing another 10x-billed macOS run.
 */
const fs = require('fs');
const path = require('path');

const PLUGIN = 'cordova-plugin-advanced-http';
const FILES = ['SM_AFNetworkReachabilityManager.m', 'SM_AFHTTPSessionManager.m'];

// Matches the whole line, #import or #include, with or without trailing space.
const PRIVATE_IMPORT_RE = /^[ \t]*#(?:import|include)[ \t]*<netinet6\/in6\.h>[ \t]*\r?\n/gm;

const REPLACEMENT =
    '// <netinet6/in6.h> deliberately not imported: it is private to the Darwin\n' +
    '// module, so a direct import is a hard error under -fmodules from Xcode 26.\n' +
    '// netinet/in.h (above) already includes it. See scripts/patch-advanced-http.js.\n';

/**
 * Every copy of a plugin file cordova may compile: the sources at rest and the
 * platform copy. Only paths that exist are returned — which of them are present
 * depends on how far through install/prepare cordova is, and a hook that throws
 * takes the whole build down with it.
 */
function targetsFor(root, name) {
    const out = [
        path.join(root, 'plugins', PLUGIN, 'src', 'ios', 'SM_AFNetworking', name),
        path.join(root, 'node_modules', PLUGIN, 'src', 'ios', 'SM_AFNetworking', name)
    ].filter(p => fs.existsSync(p));
    // platforms/ios/<App>/Plugins/<plugin>/<file> — the app directory name is
    // the project name, so discover it rather than hard-coding "NA Danmark".
    const iosDir = path.join(root, 'platforms', 'ios');
    let entries = [];
    try {
        entries = fs.readdirSync(iosDir, { withFileTypes: true });
    } catch (_) {
        entries = [];
    }
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        const candidate = path.join(iosDir, e.name, 'Plugins', PLUGIN, name);
        if (fs.existsSync(candidate)) out.push(candidate);
    }
    return out;
}

function patch(src) {
    if (src.indexOf('deliberately not imported') !== -1) return src;   // already done
    PRIVATE_IMPORT_RE.lastIndex = 0;
    return src.replace(PRIVATE_IMPORT_RE, REPLACEMENT);
}

function run(projectRoot) {
    const root = projectRoot || process.cwd();
    const changed = [];
    const survivors = [];

    for (const name of FILES) {
        for (const file of targetsFor(root, name)) {
            const before = fs.readFileSync(file, 'utf8');
            const after = patch(before);
            if (after !== before) {
                fs.writeFileSync(file, after, 'utf8');
                changed.push(path.relative(root, file));
            }
            PRIVATE_IMPORT_RE.lastIndex = 0;
            if (PRIVATE_IMPORT_RE.test(fs.readFileSync(file, 'utf8'))) {
                survivors.push(path.relative(root, file));
            }
        }
    }

    for (const rel of changed) console.log('[patch-advanced-http] removed <netinet6/in6.h> from ' + rel);
    if (!changed.length) console.log('[patch-advanced-http] no <netinet6/in6.h> imports left to remove');

    if (survivors.length) {
        console.error('[patch-advanced-http] ERROR: a direct <netinet6/in6.h> import survived in: ' +
            survivors.join(', ') + '. Xcode 26 will fail the build with "Use of private header ' +
            'from outside its module". Re-check the anchors in this script.');
        return false;
    }
    return true;
}

module.exports = (context) => {
    const root = (context && context.opts && context.opts.projectRoot) || process.cwd();
    if (!run(root)) process.exitCode = 1;
};
module.exports.run = run;

if (require.main === module) {
    if (!run(process.cwd())) process.exitCode = 1;
}
