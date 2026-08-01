#!/usr/bin/env node
/**
 * Raises CordovaLib's IPHONEOS_DEPLOYMENT_TARGET to match the app's.
 *
 * cordova's prepare reads <preference name="deployment-target"> and applies it
 * to the *app* project only (cordova-ios lib/prepare.js -> updateBuildProperty).
 * CordovaLib.xcodeproj ships with 11.0 hard-coded in all four build
 * configurations and nothing ever touches it, so every build carries:
 *
 *   CordovaLib.xcodeproj: warning: The iOS deployment target
 *   'IPHONEOS_DEPLOYMENT_TARGET' is set to 11.0, but the range of supported
 *   deployment target versions is 12.0 to 18.5.99.
 *
 * That was only a warning under Xcode 16. Each Xcode raises the floor, and a
 * target far enough below it stops being a warning and starts being an error —
 * which on a 10x-billed macOS runner is an expensive way to find out. The app
 * itself is on 16.0, and CordovaLib is linked into that same app, so there is
 * nothing to lose by aligning them.
 *
 * Only ever raises: a project already at or above the app's target is left
 * alone, so this cannot silently narrow device support. Runs as a before_compile
 * hook; idempotent.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_TARGET = '16.0';

/** The ios <platform> block's deployment-target, or null. */
function appDeploymentTarget(root) {
    let xml;
    try {
        xml = fs.readFileSync(path.join(root, 'config.xml'), 'utf8');
    } catch (_) {
        return null;
    }
    // Scope to <platform name="ios"> so an android preference cannot win.
    const block = /<platform\s+name=["']ios["'][\s\S]*?<\/platform>/i.exec(xml);
    const scope = block ? block[0] : xml;
    const m = /<preference\s+name=["']deployment-target["']\s+value=["']([^"']+)["']/i.exec(scope);
    return m ? m[1] : null;
}

/** Compares dotted version strings numerically: 11.0 < 9.0 is false, 9.0 < 11.0 is true. */
function isLower(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] || 0;
        const y = pb[i] || 0;
        if (x !== y) return x < y;
    }
    return false;
}

function run(projectRoot) {
    const root = projectRoot || process.cwd();
    const target = appDeploymentTarget(root) || DEFAULT_TARGET;

    const pbxproj = path.join(root, 'platforms', 'ios', 'CordovaLib', 'CordovaLib.xcodeproj', 'project.pbxproj');
    if (!fs.existsSync(pbxproj)) return true;   // platform not added yet

    const before = fs.readFileSync(pbxproj, 'utf8');
    const raised = [];
    const after = before.replace(
        /(IPHONEOS_DEPLOYMENT_TARGET\s*=\s*)([0-9][0-9.]*)(\s*;)/g,
        (whole, lead, current, tail) => {
            if (!isLower(current, target)) return whole;
            raised.push(current);
            return lead + target + tail;
        }
    );

    if (after === before) {
        console.log(`[align-deployment-target] CordovaLib already at >= ${target}`);
        return true;
    }
    fs.writeFileSync(pbxproj, after, 'utf8');
    console.log(`[align-deployment-target] CordovaLib ${raised.join(', ')} -> ${target} ` +
        `(${raised.length} build configuration${raised.length === 1 ? '' : 's'})`);
    return true;
}

module.exports = (context) => {
    const root = (context && context.opts && context.opts.projectRoot) || process.cwd();
    run(root);
};
module.exports.run = run;

if (require.main === module) run(process.cwd());
