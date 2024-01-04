# NA Danmark Mobile App - BMLT Meeting Search

## Quick Start Guide

### Ubuntu 22.04

1. Download the master.zip file:

https://github.com/bmlt-enabled/BMLTSearch3/archive/master.zip

or clone this project:

```
git clone https://github.com/Narcotics-Anonymous-Danmark/App.git
```

2. Install nvm (v0.39.3) so we can use node.js (vv10.13.0) and npm (v6.4.1)

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc
nvm install 10.13.0
nvm use v10.13.0 
nvm alias default 10.13.0
```

3. Install Ionic Framework

```
npm install -g ionic@4.0.0
```

4. Install package.json dependencies

```
npm install
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
ionic cordova prepare
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

3. Install Cordova/PhoneGap plugins (Cordova Plugins package.json branch dependencies)

```
ANDROID_SDK_ROOT=/home/mcd/AndroidSDK ionic cordova emulate android
```

4. Install Android SDK and Emulator

```
sudo snap install androidsdk
androidsdk "build-tools;28.0.0"
androidsdk "platforms;android-28"
androidsdk "system-images;android-28;google_apis_playstore;x86"
~/AndroidSDK/tools/bin/avdmanager create avd -n test -k "system-images;android-28;google_apis_playstore;x86"
```

5. Run the app using the android emulator

```
ionic cordova emulate android
```


## Apple iphone/ipad app link

TODO: link will be here after it will be published on AppStore

## Android phone/tablet link

TODO: link will be here after it will be published on Google Play