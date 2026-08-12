# Security

Security fixes are supported on `main` and the latest release.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Use GitHub's private vulnerability reporting for this repository when available. Include the affected version, impact, reproduction steps and a minimal proof of concept. Do not include real credentials or personal photos.

## Deployment baseline

The API is designed to sit behind HTTPS on a reverse proxy. In production:

- keep port `8787` bound to localhost;
- set a long random `API_TOKEN` unless access is already enforced by a trusted private network or identity-aware proxy;
- set `TRUST_PROXY=1` only when exactly one trusted reverse proxy is in front of the API;
- set `CORS_ORIGINS` only when the PWA and API intentionally use different origins;
- keep Ollama private and unreachable from the public internet;
- run the supplied container non-root, read-only and with bounded process/shared-memory resources;
- do not give Chromium privileged mode, host networking or broad capabilities;
- restrict browser egress from loopback, private/link-local and infrastructure metadata endpoints;
- install OS and dependency security updates regularly.

The production PWA should reverse-proxy `/api` to the API so its CSP can keep browser connections same-origin. There are no analytics or third-party scripts. Photos stay on the device except when a scan is explicitly sent to the self-hosted API for identification; request logging excludes bodies, search terms and authorization data.

The browser token is a shared secret for this small private deployment, not a full identity system. Brocante stores it on the device to preserve the selected configuration, so a compromised application origin could read it.

Marketplace pages and AI output are untrusted input. Chromium runs as a non-root user with its sandbox enabled. Brocante intentionally does not implement CAPTCHA bypasses, fingerprint spoofing, proxy rotation or other anti-abuse circumvention.
