# Security

Security fixes are supported on `main` and the latest release. The engineering threat model is maintained in `docs/THREAT_MODEL.md`; deployment and incident procedures are in `docs/OPERATIONS.md` and native-client procedures are in `docs/NATIVE_CLIENTS.md`.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Use GitHub private vulnerability reporting for this repository when enabled. Include the affected version/commit, impact, reproduction steps and the smallest practical proof of concept. Do not include real credentials, production data or personal photos.

Avoid destructive testing against systems or marketplace accounts you do not own. Give maintainers a reasonable opportunity to investigate and fix before public disclosure.

## Deployment baseline

The API is designed to sit behind HTTPS on a reverse proxy. In production:

- keep host port `8787` bound to localhost;
- set a long random `API_TOKEN` unless access is already enforced by a trusted private network or identity-aware proxy;
- set `TRUST_PROXY=1` only when exactly one trusted reverse proxy is in front of the API;
- set `CORS_ORIGINS` only for intentional cross-origin clients; native wrappers use the exact Capacitor origins documented in `docs/NATIVE_CLIENTS.md`;
- keep Ollama private and unreachable from the public internet;
- run the supplied container as non-root and read-only;
- keep `no-new-privileges`, `cap_drop: ALL`, the PID limit and the supplied seccomp profile enabled;
- re-add only `SYS_CHROOT`, which Chromium needs for its filesystem sandbox step;
- do not give Chromium privileged mode, host networking, `SYS_ADMIN` or broad capabilities;
- restrict browser egress from loopback, private/link-local, internal names and infrastructure metadata endpoints;
- install OS, base-image and dependency security updates regularly.

Chromium runs as a non-root user with its sandbox enabled. The seccomp profile permits the additional user-namespace syscalls needed to keep that sandbox active in Docker, while the container capability set is reduced to `SYS_CHROOT` only after dropping all capabilities. CI smoke-tests a sandboxed browser under the same hardened runtime flags.

The browser URL policy is defense in depth, not a replacement for network policy. Hardened/public deployments should also use host/cloud firewall rules that prevent the container from reaching unrelated LAN/control-plane services. See the browser-isolation ADR for residual risks.

## Application privacy boundary

The production PWA should reverse-proxy `/api` so its application traffic remains same-origin. Native Capacitor wrappers cannot use that same-origin path, so they require an explicit HTTPS API base configured by the user. Brocante does not enable Android cleartext traffic or weaken Apple App Transport Security for native production use.

The PWA CSP permits outbound `connect-src` to HTTPS so a generic native package can reach the explicitly configured API. This is broader than the same-origin PWA path, so the application keeps third-party scripts disabled and validates the native API base before requests. A script-injection vulnerability would still be security-sensitive and must be treated as capable of reading local configuration and making allowed HTTPS requests.

Photos and scan history stay on the device unless the user explicitly requests analysis. The API has no durable user database. Request logging excludes bodies, search terms, authorization data and image payloads.

The browser/native token is a shared secret for this small private deployment, not a full identity system. Brocante may store it on the device to preserve configuration, so compromise of the application origin or device can expose it. Use HTTPS, a trusted API origin and no third-party scripts.

## Native package permissions and signing

The Android wrapper requests only internet and camera access. The iOS wrapper declares a camera usage description. Camera access is requested by the WebView only when the user enters camera mode.

The CI-produced Android debug APK is a test artifact, not a production-signed release. Stable Android signing keys and Apple distribution credentials must remain outside the repository and logs. TestFlight/App Store or other signed iOS distribution is not produced until a controlled signing strategy is configured.

## Untrusted external content

Marketplace pages, URLs and AI output are untrusted input. Main Chromium navigation is restricted to exact provider hosts and obvious local/private browser targets are blocked. Provider errors fail closed rather than enabling anti-abuse bypasses.

Brocante intentionally does not implement CAPTCHA bypasses, fingerprint spoofing, proxy rotation or similar circumvention.

## Supply chain

Dependency installs are lockfile-driven with `npm ci`, npm lifecycle scripts are explicitly allowlisted, Actions are pinned to immutable SHAs, CodeQL runs on changes/schedule and releases include checksums plus a CycloneDX SBOM. Native Capacitor dependencies are exact-version pinned; CI compiles both Android and iOS projects from the committed lockfile.

Repository-level controls such as Dependency Graph, private vulnerability reporting, secret scanning/push protection and branch rules are documented in `docs/GITHUB_SETTINGS.md` because they must be enabled in GitHub settings.
