const fs = require('fs');
var moment = require('moment');
var ts = moment().format("YYMMDDHHmmss");

module.exports = (ctx) => {
    console.log(ctx);

    if (ctx.build && ctx.build.configuration && (ctx.build.configuration === "production" || ctx.build.configuration === "unstable")) {
        console.log("Production or unstable build: performing version bump...");

        // update package.json:
        let packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf-8').toString());
        let versionArray = packageJSON.version.split(".");
        versionArray[2] = (parseInt(versionArray[2]) + 1).toString(); //parseInt removes "+123456"
        packageJSON.version = versionArray.join("."); // + "+" + ts;
        console.log("New version: " + packageJSON.version);
        fs.writeFileSync('package.json', JSON.stringify(packageJSON, null, "\t"), 'utf-8');
        console.log("package.json app version updated");

        let prodEnvData = fs.readFileSync(`src/environments/environment.prod.ts`, 'utf-8');
        prodEnvData = prodEnvData.replace(/CURRENT_VERSION: ".*"/, `CURRENT_VERSION: "${packageJSON.version}"`);
        fs.writeFileSync('src/environments/environment.prod.ts', prodEnvData, 'utf-8');
        console.log("environments.prod.ts app version updated");

        let unstableEnvData = fs.readFileSync(`src/environments/environment.unstable.ts`, 'utf-8');
        unstableEnvData = unstableEnvData.replace(/CURRENT_VERSION: ".*"/, `CURRENT_VERSION: "${packageJSON.version}"`);
        fs.writeFileSync('src/environments/environment.unstable.ts', unstableEnvData, 'utf-8');
        console.log("environments.unstable.ts app version updated");

        //let localEnvData = fs.readFileSync(`src/environments/environment.local.ts`, 'utf-8');
        //localEnvData = localEnvData.replace(/CURRENT_VERSION: ".*"/, `CURRENT_VERSION: "${packageJSON.version}"`);
        //fs.writeFileSync('src/environments/environment.local.ts', localEnvData, 'utf-8');
        //console.log("environments.local.ts app version updated");

        let defaultEnvData = fs.readFileSync(`src/environments/environment.ts`, 'utf-8');
        defaultEnvData = defaultEnvData.replace(/CURRENT_VERSION: ".*"/, `CURRENT_VERSION: "${packageJSON.version}"`);
        fs.writeFileSync('src/environments/environment.ts', defaultEnvData, 'utf-8');
        console.log("environments.ts app version updated");

        let configXmlData = fs.readFileSync('config.xml', 'utf-8');
        configXmlData = configXmlData.replace(/id="dk.nadanmark.app" version=".*"/, `id="dk.nadanmark.app" version="${packageJSON.version}"`);
        fs.writeFileSync('config.xml', configXmlData, 'utf-8');
        console.log("config.xml app version updated");
    };
};