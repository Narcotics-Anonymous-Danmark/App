# NA Danmark Mobile App - BMLT Meeting Search

## Quick Start Guide

### Ubuntu 22.04

1. Download the master.zip file:

https://github.com/Narcotics-Anonymous-Danmark/App/archive/master.zip

or clone this project:

```
git clone https://github.com/Narcotics-Anonymous-Danmark/App.git
```

2. Install curl

```
sudo apt-get install curl
```

3. Install nvm (v0.39.3) so we can use node.js (v16.13.0) and npm (v8.1.0)

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc
nvm install 16.13.0
nvm use v16.13.0
nvm alias default 16.13.0
npm install npm@8.1.0 -g
```

4. Install Ionic Framework & Cordova

```
npm install -g ionic@4.0.0
npm install -g cordova@12.0.0
```

5. Install package.json dependencies

```
npm install
```

6. Install Java

```
sudo apt-get install openjdk-17-jdk
```

#### Android platform

The Android build is driven entirely by the `na` CLI — see
[Using the na CLI](#using-the-na-cli) below. You only need the Android SDK, an
emulator (or a connected device) and a Google Maps API key in place first.

1. Install the Android SDK and an emulator

```
sudo snap install androidsdk
sdkmanager "build-tools;35.0.0"
sdkmanager "platforms;android-35"
sdkmanager "system-images;android-28;google_apis_playstore;x86"
~/AndroidSDK/tools/bin/avdmanager create avd -n test -k "system-images;android-28;google_apis_playstore;x86"
```

Install gradle 8.14.3 (download from https://gradle.org/next-steps/?version=8.14.3&format=bin):

```
sudo ln -s ~/Downloads/gradle-8.14.3/bin/gradle /usr/bin/gradle
sudo apt install adb
sudo apt install google-android-emulator-installer
```

2. Tell the tooling where the SDK is

`na bootstrap android` / `na run android` read `ANDROID_SDK_ROOT`, then
`ANDROID_HOME`, then fall back to `~/AndroidSDK`. Export it once, for example:

```
export ANDROID_SDK_ROOT=~/AndroidSDK
```

3. Configure the Google Maps API key (required for maps to render)

`cordova-plugin-googlemaps-2` is fetched from GitHub over HTTPS and restored
automatically when the Android platform is added — you do **not** add it by hand.
It needs an Android Maps SDK key. The plugin only reads the key from a
**top-level** (`<widget>`-scoped) preference, so edit the active `config.xml` and
replace the placeholder value there (not inside `<platform name="android">`):

```
<preference name="GOOGLE_MAPS_ANDROID_API_KEY" value="YOUR_ANDROID_MAPS_API_KEY" />
<preference name="GOOGLE_MAPS_PLAY_SERVICES_VERSION" value="17.0.0" />
```

4. Bootstrap the Android platform

```
./bin/na bootstrap android
```

This installs the global toolchain (npm 8.1.0, ionic 4, cordova 12), installs the
project dependencies, adds `cordova-android@14.0.1`, restores all plugins
(including Google Maps over HTTPS) and runs `cordova prepare android`. It does not
build an APK — `na run android` builds when you actually run the app.

5. Run on an emulator or device

```
./bin/na run android
```

`na run android` auto-detects a connected device; otherwise it boots an emulator
(the highest-API AVD it finds). Be explicit when needed:

```
./bin/na run android --device      # force a connected device
./bin/na run android --emulator    # force an emulator (auto-picks an AVD)
./bin/na run android --target test # use a specific AVD
./bin/na run android --no-build    # skip the rebuild
```

## Using the na CLI

`./bin/na` centralises the per-platform workflow (it pins Node 16.13.0 via nvm and
the system **npm 8.1.0**):

```
./bin/na bootstrap android   # install toolchain + deps, add platform, cordova prepare
./bin/na run android         # build (if sources changed) and run on device/emulator
./bin/na bootstrap ios       # iOS equivalent (adds ios platform, runs pod install)
./bin/na run ios             # build and run on simulator/device
```

Add `--dry-run` to print the steps without executing, or `--force` to re-run steps
that would otherwise be skipped.


## Apple iphone/ipad app link

https://apps.apple.com/dk/app/na-danmark/id6739226092

## Android phone/tablet link

https://play.google.com/store/apps/details?id=dk.nadanmark.app

## Google Maps plugin #multiple_maps

`na bootstrap android` handles Google Maps for you: it installs the
`cordova-fetch@3.0.1` and `properties-parser@0.5.1` helpers and, when the Android
platform is added, restores `cordova-plugin-googlemaps-2` (pinned to
`#v2.9.1`) from GitHub over HTTPS.

You only need to provide the API key — see step 3 of the
[Android platform](#android-platform) section above.

> The plugin is fetched with the system **npm 8** (the nvm npm), which clones over
> HTTPS. Don't reintroduce `cordova-plugin-browsersync`: it depends on `npm@2`,
> which would land in `node_modules` and make cordova-fetch hang on the dead
> `git://` protocol when restoring Google Maps.

## Android Gradle issue

```
vim platforms/android/gradlew
```

remove `--illegal-access=permit`

## Install android-version

```
npm install android-versions --save
```

## Fix voley@1.1.1

```
vim platforms/android/cordova-plugin-googlemaps/app-tbxml-android.gradle
```

change:

```
  implementation(name:'tbxml-android', ext:'aar')
```

with:

```
  implementation(name:'tbxml-android', ext:'aar') {
    exclude group: 'com.android.volley'
  }

  implementation 'com.android.volley:volley:1.2.1'
```

## Cold start android emulator

```
emulator @test -no-snapshot-load
```

## Change location using Android Emulator

Herning:
```
adb emu geo fix 8.9579 56.13504
```


## Release

### Android

First time:
```
keytool -v -genkey -v -keystore nadanmarkapp.keystore -alias nadanmarkapp -keyalg RSA -validity 10000
```

First time:
```
java -jar pepk.jar --keystore=nadanmarkapp.keystore --alias=nadanmarkapp --output=output.zip --include-cert --rsa-aes-encryption 
--encryption-key-path=encryption_public_key.pem
```

Remember nadanmark.dk API and Google Maps credentials!!!

Remember to change version number in:
- config.xml: android-versionCode + version (new version - minor: 1)
- package.json: version (new version - minor: 1)
- package-lock.json: version
- environment.ts: currentVersion

We need to make a regular build before a production build to make sure files are updated and ready
```
ANDROID_SDK_ROOT=~/AndroidSDK ionic cordova build android
```

```
ANDROID_SDK_ROOT=~/AndroidSDK ionic cordova build android --prod --release
```

```
cd platforms/android/app/build/outputs/bundle/release/
```

```
cp app-release.aab nadanmark.aab
```

```
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ../../../../../../../keys/nadanmarkapp.keystore nadanmark.aab nadanmarkapp
```

IUFormand's password

Upload to Play Console

Remember to check apk from Play Console:
- Download apk after aab upload
- adb install the old APK first
- adb install the download apk on emulator/device to test new release: version number + all changes
- check that settings are persisted - cleantime most important


### iOS

Replace/rename the following configuration files from android to ios:
- config.ios.xml -> config.xml
- package.ios.json -> package.json
- package.lock.ios.json -> package.lock.json

Remember nadanmark.dk API and Google Maps credentials!!!

Remember to change version number in:
- config.xml: version
- package.json: version
- package-lock.json: version
- environment.ts: currentVersion

```
ionic cordova build ios
open -a Xcode platforms/ios
```

Build and test on simulator and real phone

Create a new archive using Product -> Archive

Validate and Distribute

Login on Apple Store Connect

Create a new version

We are not using any special algorithm

Submit to review