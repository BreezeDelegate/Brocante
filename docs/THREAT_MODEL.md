# Threat model

This document records the security assumptions and residual risks that matter when changing or deploying Brocante. It is an engineering threat model, not a claim of perfect security.

## Assets

- User photos and local scan history
- API bearer token for private deployments
- Optional eBay client secret and application access token
- Host/VPS integrity
- Private Ollama endpoint and model service
- Browser process/container boundary
- Marketplace queries and parsed results
- Native Android/iOS package integrity and future signing credentials
- Source repository, lockfile, CI credentials and release artifacts

## Trust boundaries

1. Mobile browser/PWA to reverse proxy/API
2. Capacitor Android/iOS WebView to an explicitly configured external HTTPS API
3. Public reverse proxy to the local API port
4. API process to Playwright/Chromium
5. Chromium to untrusted marketplace pages and their subresources
6. API process to private Ollama
7. API process to external HTTPS provider APIs such as eBay OAuth/Browse
8. Repository source to npm/Gradle/Swift Package Manager/Docker/GitHub Actions supply chains
9. Release pipeline to Android/iOS signing and distribution systems

Anything crossing a boundary is untrusted unless explicitly validated or authenticated.

## Primary attacker models

### Unauthenticated internet client

Goals: abuse CPU/browser capacity, submit oversized payloads, enumerate internals, bypass authentication or consume provider quotas.

Controls: localhost-bound host port, reverse proxy/TLS, bearer token by default in production, exact CORS policy, JSON size limit, rate limit, bounded provider queues, input schemas, timeouts and generic errors.

### Malicious or compromised native API configuration

Goals/effects: send photos, search queries or the API bearer token to an unintended server; downgrade traffic to cleartext; abuse a malformed URL to redirect requests.

Controls: native clients start without a guessed API endpoint; the user must configure an explicit URL; native mode rejects non-HTTPS URLs plus credentials, query parameters and fragments in the API base; Android cleartext traffic and Apple transport-security exceptions are not enabled; the server uses an exact CORS allowlist for Capacitor origins.

Residual risk: a user can intentionally configure an HTTPS server they do not control, and device/application compromise can expose locally stored configuration. The PWA/native CSP permits HTTPS connections for the generic native deployment, so script injection remains high impact even though third-party application scripts are not used.

### Malicious or compromised marketplace page

Goals: escape browser isolation, reach the host/LAN/Ollama, force downloads/background activity, redirect main navigation or exhaust resources.

Controls: non-root runtime, Chromium sandbox, Playwright seccomp profile, read-only container, `cap_drop: ALL` followed by the single `SYS_CHROOT` capability required for Chromium's filesystem sandbox step, `no-new-privileges`, bounded pids/shared memory, downloads disabled, service workers blocked, media/images/fonts blocked, exact main-navigation host allowlist and browser URL policy rejecting obvious private/local targets.

Residual risk: hostname policy alone cannot cryptographically eliminate DNS rebinding or every browser/runtime vulnerability. High-assurance deployments should additionally apply host/cloud firewall egress policy, isolate the browser workload/network namespace or place it in a dedicated VM/container service with only required internet access.

### Compromised or malicious external provider API

Goals/effects: return malformed or misleading marketplace data, induce resource exhaustion, redirect users to an unexpected host or trigger repeated credential/token requests.

Controls: bounded request timeouts, provider pacing and shared cache, strict parsing of external responses, exact HTTPS marketplace-link validation, currency/price validation, generic provider failures and finite token reuse. eBay OAuth credentials remain server-side, tokens are cached in memory only, and a 401 causes at most one token refresh/retry for that search.

Residual risk: provider availability, API-policy changes, account approval and upstream correctness remain outside Brocante's control. Provider failure must degrade only that source and must not cause credentials, raw responses or internal error details to be exposed.

### Malicious/incorrect AI output

Goals: inject misleading labels or content into later processing.

Controls: model output is treated as untrusted advisory text, bounded before use, and never grants authority or executes code.

### Compromised dependency or CI action

Goals: execute code during install/build, steal credentials or modify artifacts.

Controls: committed npm lockfile, `npm ci`, exact Capacitor versions, explicit lifecycle-script allowlist, production dependency audit, CodeQL, Dependabot, immutable action SHAs, least-privilege workflow permissions, native Android/iOS compile gates, release checksums and SBOM.

Residual risk: npm, Gradle/Maven, Swift Package Manager registries and base images remain external trust dependencies. Critical dependency/base-image updates should be treated as high-risk maintenance and reviewed promptly.

### Package signing/distribution compromise

Goals: publish a modified APK/IPA, steal signing credentials or make an untrusted build appear official.

Controls: the current CI APK is explicitly debug-signed and test-only; no stable signing secrets are committed. Stable Android/iOS distribution remains blocked until a documented external-secret/signing process is implemented. Release artifacts receive checksums and an SBOM.

### Operator/configuration error

Goals/effects: accidental public API/Ollama exposure, trusting spoofed forwarding headers, leaking a token or provider credential, partially configuring eBay credentials, misconfiguring native CORS or disabling authentication.

Controls: secure defaults, production token requirement, paired eBay credential validation, localhost Compose port binding, explicit `TRUST_PROXY`, exact `CORS_ORIGINS`, `.env.example`, deployment checklist and incident/rollback runbook.

## Security invariants

- No secrets or user photos in Git history, logs or releases.
- Production API authentication is enabled unless an explicit trusted access layer replaces it.
- Native production API traffic uses HTTPS; no generic cleartext/ATS bypass is added.
- Native CORS remains an exact allowlist, never a wildcard convenience setting.
- Stable Android/iOS signing secrets remain outside the repository and logs.
- Public host port remains bound to loopback in the supplied Compose setup.
- Ollama remains private.
- Provider credentials and application tokens remain server-side and are never returned to the client.
- Browser execution never requires privileged container mode or `SYS_ADMIN` in production.
- Container capabilities follow a drop-all baseline with only `SYS_CHROOT` re-added for the Chromium sandbox.
- Main browser navigation remains host-allowlisted.
- Network-facing operations remain bounded by size, time and queue limits.
- Marketplace blocking/DOM/API changes cause provider failure, not anti-abuse bypasses.

## Privacy properties

Captured photos and scan history live in local browser/WebView storage. The API has no durable user database. An image is transmitted only when analysis is requested. Logs contain request metadata only. There are no analytics or third-party application scripts by default.

The optional API token stored by the PWA/native client is a shared deployment secret, not per-user identity. A compromise of the application origin or device can expose it; use a trusted HTTPS API, strong CSP and no third-party scripts.

Marketplace search queries necessarily leave the API for the selected provider. eBay OAuth credentials are not search data and are never sent to the client; the client secret is sent only to eBay's token endpoint over HTTPS as required by the client-credentials flow.

## Review triggers

Update this threat model when adding authentication/identity, server persistence, new providers, browser/native capabilities, file uploads/downloads, third-party scripts/analytics, new outbound services, cloud metadata access, background workers, public APIs, signing/distribution credentials or a materially different deployment topology.
