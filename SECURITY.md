# Security

Security fixes are supported on `main` and the latest release. The engineering threat model is maintained in `docs/THREAT_MODEL.md`; deployment and incident procedures are in `docs/OPERATIONS.md`.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Use GitHub private vulnerability reporting for this repository when enabled. Include the affected version/commit, impact, reproduction steps and the smallest practical proof of concept. Do not include real credentials, production data or personal photos.

Avoid destructive testing against systems or marketplace accounts you do not own. Give maintainers a reasonable opportunity to investigate and fix before public disclosure.

## Deployment baseline

The API is designed to sit behind HTTPS on a reverse proxy. In production:

- keep host port `8787` bound to localhost;
- set a long random `API_TOKEN` unless access is already enforced by a trusted private network or identity-aware proxy;
- set `TRUST_PROXY=1` only when exactly one trusted reverse proxy is in front of the API;
- set `CORS_ORIGINS` only when the PWA and API intentionally use different origins;
- keep Ollama private and unreachable from the public internet;
- run the supplied container as non-root and read-only;
- keep `no-new-privileges`, `cap_drop: ALL`, the PID limit and the supplied seccomp profile enabled;
- do not give Chromium privileged mode, host networking, `SYS_ADMIN` or broad capabilities;
- restrict browser egress from loopback, private/link-local, internal names and infrastructure metadata endpoints;
- install OS, base-image and dependency security updates regularly.

Chromium runs as a non-root user with its sandbox enabled. The seccomp profile permits only the additional user-namespace syscalls needed to keep that sandbox active in Docker. CI smoke-tests a sandboxed browser under the hardened runtime flags.

The browser URL policy is defense in depth, not a replacement for network policy. Hardened/public deployments should also use host/cloud firewall rules that prevent the container from reaching unrelated LAN/control-plane services. See the browser-isolation ADR for residual risks.

## Application privacy boundary

The production PWA should reverse-proxy `/api` so its CSP can keep application browser connections same-origin. There are no analytics or third-party application scripts by default.

Photos and scan history stay on the device unless the user explicitly requests analysis. The API has no durable user database. Request logging excludes bodies, search terms, authorization data and image payloads.

The browser token is a shared secret for this small private deployment, not a full identity system. Brocante may store it on the device to preserve configuration, so compromise of the application origin can expose it. Use HTTPS, a trusted origin and no third-party scripts.

## Untrusted external content

Marketplace pages, URLs and AI output are untrusted input. Main Chromium navigation is restricted to exact provider hosts and obvious local/private browser targets are blocked. Provider errors fail closed rather than enabling anti-abuse bypasses.

Brocante intentionally does not implement CAPTCHA bypasses, fingerprint spoofing, proxy rotation or similar circumvention.

## Supply chain

Dependency installs are lockfile-driven with `npm ci`, npm lifecycle scripts are explicitly allowlisted, Actions are pinned to immutable SHAs, CodeQL runs on changes/schedule and releases include checksums plus a CycloneDX SBOM.

Repository-level controls such as Dependency Graph, private vulnerability reporting, secret scanning/push protection and branch rules are documented in `docs/GITHUB_SETTINGS.md` because they must be enabled in GitHub settings.
