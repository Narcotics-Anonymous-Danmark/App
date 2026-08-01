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

It also drives releases — see [Automated releases](#automated-releases):

```
./bin/na release version 1.2.4   # set version + build number everywhere
./bin/na release check           # can this checkout build a signed release?
./bin/na release android         # signed .aab into dist/
./bin/na release ios             # signed .ipa into dist/ (macOS only)
./bin/na publish play --aab …    # upload to Play internal testing
./bin/na publish testflight --ipa …  # upload to TestFlight internal testing
```


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


## Automated releases

Releases are built and shipped by GitHub Actions on the free standard runners.
iOS and Android share **one release number**: one draft release carries both
signed artefacts, and publishing that release is what sends them to the stores.

### The two workflows

| Workflow | Trigger | What it does |
| --- | --- | --- |
| **Draft release candidate** (`release-draft.yml`) | manual (`workflow_dispatch`) | Sets the version + build number, commits and tags it, drafts a GitHub release with notes generated from the PRs/commits since the last release, builds the signed `.aab` (ubuntu-22.04) and signed `.ipa` (macos-15) from that tag and attaches both to the draft. |
| **Publish release to stores** (`release-publish.yml`) | a release goes draft → **published** | Downloads the artefacts *from the release* (nothing is rebuilt) and ships them: `.aab` → Google Play *internal testing*, `.ipa` → App Store Connect (the internal TestFlight group picks it up automatically once Apple finishes processing). |

**Internal testing only.** Neither store gets an external/closed-testing release
from the pipeline, so nothing it does is ever submitted to Google or Apple for
review. Promoting a build to closed/open testing or production is a manual
decision in the Play Console, and so is sending one to external TestFlight
testers.

The two build jobs live in their own reusable workflows (`build-android.yml`,
`build-ios.yml`) and can also be run on their own from the Actions tab to test
the pipeline without touching a release. Every build uploads its artefact with
**7 day** retention.

So the flow is:

1. Actions → **Draft release candidate** → pick `patch`/`minor`/`major` (or type
   an explicit version) → Run.
2. Wait for the draft release to appear with `nadanmark-<version>-<build>.aab`
   and `.ipa` attached (~15 min for Android, ~30-40 min for iOS).
3. Edit the release notes — the text between the `release-notes` markers is sent
   to Google Play as the release notes (when `PLAY_RELEASE_NOTES_LANGUAGE` is
   set). TestFlight's "What to Test" is *not* filled in automatically; write it
   in App Store Connect if the testers need it.
4. **Publish** the release. TestFlight and Play uploads start automatically.

Nothing is signed or uploaded until you publish, and a failed build leaves the
draft release in place so you can delete it (and its tag) and try again.

### Version numbering

`./bin/na release version <x.y.z> [--build n]` is the only thing that writes
version numbers. It updates all four places that have to agree — `config.xml`
(`version`, `android-versionCode`, `ios-CFBundleVersion`), `package.json`,
`package-lock.json` and `src/environments/environment.ts` — so they can never
drift apart again.

* Android `versionCode` = `1100000000 + (major*10000 + minor*100 + patch) * 1000 + build`
  (1.2.4 build 1 → `1110204001`). Monotonic, stays above the last manually
  uploaded code (`1022000001`) and well under Play's `2100000000` ceiling.
* iOS `CFBundleVersion` = the build number. TestFlight needs a fresh build number
  for every upload of the same version, so raise `--build` to re-release a
  version (the git tag then becomes `1.2.4-b2`).

### Secrets to add

Repository → Settings → Secrets and variables → Actions → **Secrets**:

| Secret | What it is |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Google Maps key, injected into `config.xml` and `src/index.html` at build time. Optional per-target overrides: `GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_MAPS_IOS_API_KEY`, `GOOGLE_MAPS_JS_API_KEY`. |
| `NA_API_BASIC_AUTH` | `user:password` for the nadanmark.dk API (the `btoa("username:password")` placeholders). |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 keys/nadanmarkapp.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_PASSWORD` | key password (usually the same) |
| `ANDROID_KEY_ALIAS` | optional, defaults to `nadanmarkapp` |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play service account key (whole JSON file, or base64 of it) |
| `IOS_DIST_CERT_BASE64` | base64 of a `.p12` holding the **Apple Distribution** certificate *and* its private key (an older `iPhone Distribution` certificate works too — the signing identity is read from the certificate, not assumed; `IOS_CODE_SIGN_IDENTITY` can override it) |
| `IOS_DIST_CERT_PASSWORD` | password used when exporting that `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | base64 of the App Store `.mobileprovision`. **Required.** cordova-ios pins `CODE_SIGN_IDENTITY = "iPhone Distribution"` in `build-release.xcconfig`, and Xcode refuses to combine any pinned identity with automatic signing — so the release build signs manually, which needs a profile. |
| `IOS_TEAM_ID` | Apple Developer team id (10 characters) |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect API key id |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect issuer id |
| `APP_STORE_CONNECT_PRIVATE_KEY` | contents of the `AuthKey_XXXXXXXX.p8` file, or base64 of that file — both are accepted, as are CRLF endings and `\n` escapes |

Optional **Variables** (same page, "Variables" tab — these are not secret):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PLAY_RELEASE_NOTES_LANGUAGE` | *(unset)* | e.g. `da-DK`. Play rejects notes for a language the listing does not have, so notes are only sent when this is set. |
| `XCODE_VERSION` | *(runner default)* | Pin Xcode, e.g. `16.4`, if the default image version ever breaks the build. |

If `PLAY_CLOSED_TESTING`, `PLAY_CLOSED_TRACK`, `PLAY_TRACKS` or
`TESTFLIGHT_INTERNAL_GROUP` are still set on that page from an earlier version of
this pipeline, delete them — nothing reads them any more.

Producing the credentials, once:

```
# Android keystore (the existing upload key from keys/)
base64 -w0 keys/nadanmarkapp.keystore          # Linux
base64 -i keys/nadanmarkapp.keystore | tr -d '\n'   # macOS

# iOS distribution certificate: Keychain Access -> right-click the *private key*
# of the "Apple Distribution: ..." certificate -> Export -> .p12
base64 -i dist-cert.p12 | tr -d '\n'

# iOS provisioning profile: developer.apple.com -> Profiles -> App Store profile
# for dk.nadanmark.ios.app -> Download
base64 -i NA_Danmark_App_Store.mobileprovision | tr -d '\n'
```

Google Play service account: Play Console → Users and permissions → invite the
service account and grant it **Release to testing tracks** (plus *View app
information*) on `dk.nadanmark.app`. The JSON key itself comes from the linked
Google Cloud project (IAM → Service accounts → Keys).

App Store Connect API key: App Store Connect → Users and Access → Integrations →
**App Store Connect API** → generate a team key with the **App Manager** role.
The `.p8` can only be downloaded once.

The Actions token needs to be allowed to push the version-bump commit and the
tag: Settings → Actions → General → Workflow permissions → **Read and write**.
If `master` is protected, allow `github-actions[bot]` to push to it.

### Running a release build locally

The same commands run locally, but they refuse to do anything unless *every*
condition is met — no half-signed artefacts, no accidental uploads:

```
./bin/na release check            # what is missing?
./bin/na release check android
./bin/na release android --dry-run
```

The conditions are: `node_modules` present, all credentials in the environment,
signing material available, a **clean git worktree** (pass `--allow-dirty` to
override) and version numbers that agree. `na publish` additionally requires
`--yes` outside CI, because it pushes builds to real testers.

Credentials are injected into the tracked placeholder files (`config.xml`,
`src/index.html`, `audio.service.ts`, `event.service.ts`) immediately before the
build and restored immediately after, so they never end up in a commit.

### Notes and caveats

* The release build uses the **default** Angular configuration, i.e. the same
  output that `na run` produces and the same output that has been shipping.
  `angular.json`'s `production` configuration is currently broken — it
  references `environment.prod.ts`, `app.component.prod.ts` and
  `ngsw-config.json`, none of which exist any more, and it writes to `www/prod`
  which cordova does not read. Fixing that (so releases get minified,
  AOT-optimised bundles without source maps) is worth doing separately, with a
  device test, rather than as part of the pipeline.
* iOS builds run on `macos-15`, the smallest free macOS runner. macOS minutes
  only count against the free allowance because this repository is public.
* `ITSAppUsesNonExemptEncryption=false` is declared in `config.xml` (the app only
  talks HTTPS), so App Store Connect does not hold every build for an export
  compliance answer.

## Manual release (fallback)

The steps below are the pre-automation process, kept for reference and for the
cases the pipeline cannot cover (uploading to production, Play Console checks).

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