#!/usr/bin/env node
/**
 * Points CocoaPods at the CDN instead of the CocoaPods/Specs git repository.
 *
 * cordova-plugin-googlemaps-2 declares its spec source in plugin.xml as
 *
 *     <podspec><config><source url="https://github.com/CocoaPods/Specs.git"/>
 *
 * and cordova copies that verbatim into platforms/ios/Podfile. A Podfile with a
 * git source makes CocoaPods clone the whole Specs repository before it can
 * resolve a single pod — 4.9 GB and ~812,000 files, of which this app needs
 * exactly one podspec (GoogleMaps). On the 3-core macOS runner that is tens of
 * minutes of checkout, billed at 10x, and it is what the iOS job was hanging on
 * at "Cloning into 'cocoapods'...".
 *
 * The CDN (the default for CocoaPods >= 1.8) serves the same trunk index over
 * HTTP and fetches only the shards a Podfile actually references, so the same
 * resolve is a couple of small requests. Nothing else about the build changes:
 * it is the same index and therefore the same GoogleMaps 10.0.0.
 *
 * WHY IT PATCHES plugin.xml AND NOT JUST THE PODFILE
 *
 * cordova-ios runs `pod install` from two places: prepare (lib/prepare.js), and
 * plugin installation (lib/Api.js — addSource() then install()). On a clean
 * checkout `cordova platform add` installs the plugins and pod-installs *there*,
 * before any before_prepare hook gets a chance, so fixing only the Podfile would
 * still pay for the clone on precisely the run that hurts — CI. Patching the
 * declared source means the git URL never reaches the Podfile at all.
 *
 * The Podfile and pods.json are patched too, so an existing platforms/ios (a
 * cached CI workspace, or a developer's checkout) is repaired in place rather
 * than needing `cordova platform rm ios`. That is safe because cordova's
 * Podfile class re-parses the file for its `source` lines and re-emits what it
 * finds (lib/Podfile.js __parseForSources -> write), so the CDN URL survives
 * every subsequent prepare.
 *
 * Runs as a before_platform_add + before_prepare hook, and is called directly by
 * `na release ios` before it adds the platform. Idempotent; exits non-zero if a
 * git Specs source survives, so a plugin upgrade that reintroduces one fails
 * loudly instead of quietly costing another 40 minutes of macOS time.
 */
const fs = require('fs');
const path = require('path');

const CDN = 'https://cdn.cocoapods.org/';

// The forms the Specs repo is written in the wild: with or without .git, http or
// https, git@ scheme, and the legacy "master" alias.
const GIT_SPECS_RE = /(?:https?:\/\/|git@)github\.com[:/]+CocoaPods\/Specs(?:\.git)?\/?/gi;

function isGitSpecs(url) {
    GIT_SPECS_RE.lastIndex = 0;
    return typeof url === 'string' && GIT_SPECS_RE.test(url);
}

// ---------------------------------------------------------------------------
// targets
// ---------------------------------------------------------------------------

/** plugin.xml — the declaration cordova reads when it installs the plugin. */
function patchPluginXml(src) {
    return src.replace(
        /(<source\s+url=)(["'])([^"']*)\2/gi,
        (whole, lead, quote, url) => (isGitSpecs(url) ? `${lead}${quote}${CDN}${quote}` : whole)
    );
}

/** Podfile — `source 'https://github.com/CocoaPods/Specs.git'`. */
function patchPodfile(src) {
    const out = src.replace(
        /^([ \t]*source[ \t]+)(["'])([^"']*)\2/gim,
        (whole, lead, quote, url) => (isGitSpecs(url) ? `${lead}${quote}${CDN}${quote}` : whole)
    );
    // Replacing two different git sources with the CDN would leave duplicates,
    // and CocoaPods treats a repeated source as an error.
    const seen = new Set();
    return out
        .split('\n')
        .filter(line => {
            const m = /^[ \t]*source[ \t]+["']([^"']*)["']/.exec(line);
            if (!m) return true;
            if (seen.has(m[1])) return false;
            seen.add(m[1]);
            return true;
        })
        .join('\n');
}

/**
 * pods.json — cordova's record of which sources it has added, keyed by URL. It
 * is what decides whether addSource() runs again on the next plugin install, so
 * a stale git entry here would put the git URL back into the Podfile.
 */
function patchPodsJson(src) {
    let json;
    try {
        json = JSON.parse(src);
    } catch (_) {
        return src; // not ours to repair
    }
    if (!json.sources || typeof json.sources !== 'object') return src;

    const sources = {};
    let changed = false;
    for (const key of Object.keys(json.sources)) {
        const entry = json.sources[key] || {};
        const newKey = isGitSpecs(key) ? CDN : key;
        if (newKey !== key) changed = true;
        if (isGitSpecs(entry.source)) {
            entry.source = CDN;
            changed = true;
        }
        // Two git spellings collapsing onto the CDN must not double-count.
        if (sources[newKey]) {
            sources[newKey].count = (sources[newKey].count || 1) + (entry.count || 1);
        } else {
            sources[newKey] = entry;
        }
    }
    if (!changed) return src;

    json.sources = sources;
    const trailingNewline = /\n$/.test(src) ? '\n' : '';
    return JSON.stringify(json, null, 4) + trailingNewline;
}

// ---------------------------------------------------------------------------
// driver
// ---------------------------------------------------------------------------

function pluginXmlPaths(root) {
    const out = [];
    for (const dir of ['node_modules', 'plugins']) {
        const base = path.join(root, dir);
        let entries;
        try {
            entries = fs.readdirSync(base);
        } catch (_) {
            continue;
        }
        for (const name of entries) {
            if (!/^cordova-plugin-/.test(name)) continue;
            const xml = path.join(base, name, 'plugin.xml');
            if (fs.existsSync(xml)) out.push(xml);
        }
    }
    return out;
}

function patchFile(file, patchFn) {
    if (!fs.existsSync(file)) return false;
    const before = fs.readFileSync(file, 'utf8');
    const after = patchFn(before);
    if (after === before) return false;
    fs.writeFileSync(file, after, 'utf8');
    return true;
}

function run(projectRoot) {
    const root = projectRoot || process.cwd();
    const changed = [];

    for (const xml of pluginXmlPaths(root)) {
        if (patchFile(xml, patchPluginXml)) changed.push(path.relative(root, xml));
    }
    const podfile = path.join(root, 'platforms', 'ios', 'Podfile');
    if (patchFile(podfile, patchPodfile)) changed.push('platforms/ios/Podfile');
    const podsJson = path.join(root, 'platforms', 'ios', 'pods.json');
    if (patchFile(podsJson, patchPodsJson)) changed.push('platforms/ios/pods.json');

    for (const rel of changed) {
        console.log('[use-cocoapods-cdn] ' + rel + ' -> ' + CDN);
    }

    // A surviving git source means the next `pod install` clones 4.9 GB. Say so
    // now, while it is one grep, rather than after 40 minutes of runner time.
    const survivors = [];
    for (const file of pluginXmlPaths(root).concat([podfile, podsJson])) {
        if (!fs.existsSync(file)) continue;
        const text = fs.readFileSync(file, 'utf8');
        GIT_SPECS_RE.lastIndex = 0;
        if (GIT_SPECS_RE.test(text)) survivors.push(path.relative(root, file));
    }
    if (survivors.length) {
        console.error('[use-cocoapods-cdn] ERROR: a CocoaPods/Specs git source survived in: ' +
            survivors.join(', ') + '. `pod install` would clone the full 4.9 GB Specs ' +
            'repository. Re-check the anchors in this script.');
        return false;
    }
    if (!changed.length) console.log('[use-cocoapods-cdn] already on the CDN');
    return true;
}

// Works as a cordova hook, as a library, and standalone (node scripts/...).
module.exports = (context) => {
    const root = (context && context.opts && context.opts.projectRoot) || process.cwd();
    if (!run(root)) process.exitCode = 1;
};
module.exports.run = run;

if (require.main === module) {
    if (!run(process.cwd())) process.exitCode = 1;
}
