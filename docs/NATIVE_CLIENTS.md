# Native clients

Brocante ships the same web application inside Capacitor wrappers for Android and iOS. The native projects are committed under `apps/web/android` and `apps/web/ios` and are rebuilt in CI from the lockfile-pinned Capacitor dependencies.

## Supported baseline

- Android: Capacitor 8, minimum API 24; CI builds a debug-signed APK for testing.
- iOS: Capacitor 8, minimum iOS 15; CI builds the Xcode project for an iOS Simulator without code signing.
- Production API access from native clients requires HTTPS.
- The native wrappers do not relax Android cleartext policy or Apple App Transport Security.

## API configuration

A packaged native application cannot use the PWA's same-origin `/api` default because its content is served from the local Capacitor WebView origin. Brocante therefore starts native clients with an empty API address and requires the user to configure an explicit HTTPS API URL in **Réglages** before analysis.

Examples of acceptable API bases:

```text
https://brocante.example/api
https://api.example/brocante
```

HTTP URLs are rejected by the client in native mode. Credentials, query parameters and fragments are also rejected in the API base URL. The optional bearer token remains stored only in the app's local preferences, with the same security limitations documented for the PWA.

## CORS for native WebViews

The API uses an exact origin allowlist. A server intended to accept both native wrappers should include the Capacitor WebView origins in `CORS_ORIGINS`:

```dotenv
CORS_ORIGINS=https://localhost,capacitor://localhost
```

Add another browser origin only when that separate-origin browser deployment is intentional. Do not replace the allowlist with a wildcard.

The Android Capacitor origin is `https://localhost`; the iOS Capacitor origin is `capacitor://localhost`. The production PWA should still prefer same-origin `/api` behind its HTTPS reverse proxy and does not need CORS in that topology.

## Camera permission

The Android manifest declares `android.permission.CAMERA`. The iOS project declares `NSCameraUsageDescription`. Browser/WebView permission is still requested only when the user opens **Mode rafale**; importing existing images does not require camera access.

## Android test APK

CI runs `assembleDebug` and exposes `brocante-android-test.apk` as a short-lived workflow artifact. This APK is debug-signed and is intended only for device testing. It is not the production-signed artifact for Play Store or long-term distribution.

Before the stable `v1.0.0` release, choose and document a release-signing strategy, keep the signing key outside the repository, and ensure the release workflow never prints or uploads signing secrets.

## iPhone testing

The committed Xcode project can be opened on macOS and run on a connected personal iPhone using an Apple development team. A free Personal Team can be used for personal-device development testing but requires periodic reprovisioning. TestFlight/App Store distribution requires Apple Developer Program signing and is a separate release step.

The first release candidate should therefore provide both:

1. the installable PWA for immediate iPhone testing; and
2. the reproducible iOS/Xcode project for native-device testing.

A signed distributable IPA/TestFlight build is added only after the signing/distribution strategy is configured without exposing credentials.

## Local native development

From the repository root:

```bash
npm ci
npm run build -w @brocante/web
cd apps/web
npx cap sync
```

Android:

```bash
cd android
./gradlew assembleDebug
```

iOS requires macOS/Xcode:

```bash
cd ios
xcodebuild -project App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Do not edit generated web assets under the native projects. Change the PWA source, rebuild it, then run `npx cap sync`.
