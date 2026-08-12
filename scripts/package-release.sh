#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/release-out"
IOS_DERIVED_DATA="${RUNNER_TEMP:-/tmp}/brocante-ios-release-build"
GRADLE_WRAPPER_SHA256="7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172"

cd "${ROOT_DIR}"
rm -rf "${OUT_DIR}" "${IOS_DERIVED_DATA}"
mkdir -p "${OUT_DIR}"

npm run check
npm audit --omit=dev --audit-level=high
npm sbom --omit=dev --sbom-format=cyclonedx --sbom-type=application > "${OUT_DIR}/brocante-sbom.cdx.json"

(
  cd apps/web
  npx cap sync
)

echo "${GRADLE_WRAPPER_SHA256}  apps/web/android/gradle/wrapper/gradle-wrapper.jar" | shasum -a 256 -c -

(
  cd apps/web/android
  ./gradlew assembleDebug --no-daemon
)

(
  cd apps/web/ios
  xcodebuild \
    -project App/App.xcodeproj \
    -scheme App \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "${IOS_DERIVED_DATA}" \
    CODE_SIGNING_ALLOWED=NO \
    build
)

(
  cd apps/web/dist
  zip -qr "${OUT_DIR}/brocante-pwa.zip" .
)

cp apps/web/android/app/build/outputs/apk/debug/app-debug.apk \
  "${OUT_DIR}/brocante-android-test.apk"

zip -qr "${OUT_DIR}/brocante-ios-xcode.zip" \
  apps/web/ios \
  apps/web/capacitor.config.json \
  apps/web/package.json \
  package-lock.json \
  docs/NATIVE_CLIENTS.md \
  -x 'apps/web/ios/build/*' \
  -x 'apps/web/ios/**/build/*' \
  -x 'apps/web/ios/**/xcuserdata/*'

(
  cd "${OUT_DIR}"
  shasum -a 256 \
    brocante-pwa.zip \
    brocante-android-test.apk \
    brocante-ios-xcode.zip \
    brocante-sbom.cdx.json > SHA256SUMS
  shasum -a 256 -c SHA256SUMS
)

printf 'Release artifacts ready in %s\n' "${OUT_DIR}"
