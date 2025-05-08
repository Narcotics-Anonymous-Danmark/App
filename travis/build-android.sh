#!/bin/bash -v

echo "***build-android.sh****"

# Build Ionic App for Android
ionic cordova platform add android@latest

ionic cordova plugin add cordova-plugin-splashscreen
ionic cordova plugin add cordova-plugin-statusbar
ionic cordova plugin add https://github.com/mapsplugin/cordova-plugin-googlemaps.git#multiple_maps
ionic cordova plugin add com-badrit-base64
ionic cordova plugin add cordova-plugin-ionic-webview@latest
ionic cordova plugin add cordova-plugin-inappbrowser
ionic cordova plugin add cordova-plugin-advanced-http

if [[ "$TRAVIS_BRANCH" != "master" ]]
then
    ionic cordova build android
else
    ionic cordova build android --prod --release
fi
