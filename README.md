# NA Danmark Mobile App - BMLT Meeting Search

## Quick Start Guide

### Ubuntu 22.04

1. Download the master.zip file:

https://github.com/bmlt-enabled/BMLTSearch3/archive/master.zip

or clone this project:

```
git clone https://github.com/Narcotics-Anonymous-Danmark/App.git
```

2. Install curl

```
sudo apt-get install curl
```

3. Install nvm (v0.39.3) so we can use node.js (v10.13.0) and npm (v6.4.1)

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc
nvm install 10.13.0
nvm use v10.13.0 
nvm alias default 10.13.0
```

4. Install Ionic Framework

```
npm install -g ionic@4.0.0
```

5. Install package.json dependencies

```
npm install
```

6. Install Java

```
sudo apt-get install openjdk-8-jdk
```

#### Browser platform

1. Add platform (browser)

```
ionic cordova platform add browser
```

2. Add browsersync for auto-refresh during development

```
ionic cordova plugin add cordova-plugin-browsersync
```

3. Install Cordova/PhoneGap plugins (Cordova Plugins package.json branch dependencies)

```
ionic cordova build browser
```

4. Run the app using the browser

```
ionic cordova run browser -l
```

#### Android platform

1. Add platform (android)

```
ionic cordova platform add android
```

2. Add browsersync for auto-refresh during development

```
ionic cordova plugin add cordova-plugin-browsersync
```

3. Install Android SDK and Emulator

```
sudo snap install androidsdk
androidsdk "build-tools;28.0.0"
androidsdk "platforms;android-28"
androidsdk "system-images;android-28;google_apis_playstore;x86"
~/AndroidSDK/tools/bin/avdmanager create avd -n test -k "system-images;android-28;google_apis_playstore;x86"
sudo apt install gradle
sudo apt install adb
sudo apt install google-android-emulator-installer
```

4. Install Cordova/PhoneGap plugins (Cordova Plugins package.json branch dependencies)

```
ANDROID_SDK_ROOT=~/AndroidSDK ionic cordova build android
```

5. Start android emulator

```
ANDROID_SDK_ROOT=~/AndroidSDK emulator @test
```

6. Run the app using the android emulator

```
ANDROID_SDK_ROOT=~/AndroidSDK ionic cordova run android --livereload-url=http://10.0.2.2:8100 -l
```

or if you have issues with "Application Error // There was a network error. (IP:ADDRESS)" or "Application Error // net::ERR_CONNECTION_REFUSED (IP:ADDRESS)" try:

```
ANDROID_SDK_ROOT=~/AndroidSDK ionic cordova run android --emulator --target=test --livereload --debug --verbose --external --host=0.0.0.0 --port=8100
```


## Apple iphone/ipad app link

TODO: link will be here after it will be published on AppStore

## Android phone/tablet link

TODO: link will be here after it will be published on Google Play

## Install Google Maps plugin #multiple_maps

We need `cordova-fetch3.0.1`:

```
npm install cordova-fetch@3.0.1
```

We also need `properties-parser@0.5.1`

```
npm install properties-parser@0.5.1
```

Add `mapsplugin` plugin:

```
ionic cordova plugin add "git+ssh://git@github.com:mapsplugin/cordova-plugin-googlemaps.git#multiple_maps"
```

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

Remember nadanmark.dk API credentials!!!

Remember to change version number in:
- config.xml: android-versionCode + version (new version - minor: 1)
- package.json: version (new version - minor: 1)
- package-lock.json: version
- environment.unstable.ts: currentVersion
- environment.prod.ts: currentVersion
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
- Download apj after aab upload
- adb install the download apk on emulator/device to test new release: version number + all changes


### iOS

Replace/rename the following configuration files from android to ios:
- config.ios.xml -> config.xml
- package.ios.json -> package.json
- package.lock.ios.json -> package.lock.json

Remember nadanmark.dk API credentials!!!

Remember to change version number in:
- config.xml: version
- package.json: version
- package-lock.json: version
- environment.unstable.ts: currentVersion
- environment.prod.ts: currentVersion
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