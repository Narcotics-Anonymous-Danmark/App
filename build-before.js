const fs = require('fs');
var moment = require('moment');
var ts = moment().format("YYMMDDHHmmss");

module.exports = (ctx) => {
    console.log(ctx);

    if (ctx.build && ctx.build.configuration && (ctx.build.configuration === "production" || ctx.build.configuration === "unstable")) {

        // update package.json:
        let packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf-8').toString());
        let versionArray = packageJSON.version.split(".");


        if (ctx.build.configuration === "production") {
            console.log("Production build: performing version bump ...");
            versionArray[2] = (parseInt(versionArray[2]) + 1).toString(); //parseInt removes "+123456"
            packageJSON.version = versionArray.join(".");
        }
        else {
            console.log("Unstable build: updating timestamp ...");
            versionArray[2] = (parseInt(versionArray[2])).toString(); //parseInt removes "+123456"
            packageJSON.version = versionArray.join(".") + "+" + ts;
        }

        console.log("New version: " + packageJSON.version);
        fs.writeFileSync('package.json', JSON.stringify(packageJSON, null, "\t"), 'utf-8');
        console.log("package.json app version updated");

        let defaultEnvData = fs.readFileSync(`src/environments/environment.ts`, 'utf-8');
        defaultEnvData = defaultEnvData.replace(/currentVersion: ".*"/, `currentVersion: "${packageJSON.version}"`);
        fs.writeFileSync('src/environments/environment.ts', defaultEnvData, 'utf-8');
        console.log("environments.ts app version updated");

        let configXmlData = fs.readFileSync('config.xml', 'utf-8');
        configXmlData = configXmlData.replace(/id="dk.nadanmark.app" version=".*"/, `id="dk.nadanmark.app" version="${packageJSON.version}"`);
        fs.writeFileSync('config.xml', configXmlData, 'utf-8');
        console.log("config.xml app version updated");
    };
};