# Threat model

This document records the security assumptions and residual risks that matter when changing or deploying Brocante. It is an engineering threat model, not a claim of perfect security.

## Assets

- User photos and local scan history
- API bearer token for private deployments
- Host/VPS integrity
- Private Ollama endpoint and model service
- Browser process/container boundary
- Marketplace queries and parsed results
- Source repository, lockfile, CI credentials and release artifacts

## Trust boundaries

1. Mobile browser/PWA to reverse proxy/API
2. Public reverse proxy to the local API port
3. API process to Playwright/Chromium
4. Chromium to untrusted marketplace pages and their subresources
5. API process to private Ollama
6. Repository source to npm/Docker/GitHub Actions supply chain

Anything crossing a boundary is untrusted unless explicitly validated or authenticated.

## Primary attacker models

### Unauthenticated internet client

Goals: abuse CPU/browser capacity, submit oversized payloads, enumerate internals, bypass authentication or consume provider quotas.

Controls: localhost-bound host port, reverse proxy/TLS, bearer token by default in production, CORS policy, JSON size limit, rate limit, bounded provider queues, input schemas, timeouts and generic errors.

### Malicious or compromised marketplace page

Goals: escape browser isolation, reach the host/LAN/Ollama, force downloads/background activity, redirect main navigation or exhaust resources.

Controls: non-root runtime, Chromium sandbox, Playwright seccomp profile, read-only container, dropped Linux capabilities, `no-new-privileges`, bounded pids/shared memory, downloads disabled, service workers blocked, media/images/fonts blocked, exact main-navigation host allowlist and browser URL policy rejecting obvious private/local targets.

Residual risk: hostname policy alone cannot cryptographically eliminate DNS rebinding or every browser/runtime vulnerability. High-assurance deployments should additionally apply host/cloud firewall egress policy, isolate the browser workload/network namespace or place it in a dedicated VM/container service with only required internet access.

### Malicious/incorrect AI output

Goals: inject misleading labels or content into later processing.

Controls: model output is treated as untrusted advisory text, bounded before use, and never grants authority or executes code.

### Compromised dependency or CI action

Goals: execute code during install/build, steal credentials or modify artifacts.

Controls: committed npm lockfile, `npm ci`, explicit lifecycle-script allowlist, production dependency audit, CodeQL, Dependabot, immutable action SHAs, least-privilege workflow permissions, release checksums and SBOM.

Residual risk: upstream package registries and base images remain external trust dependencies. Critical dependency/base-image updates should be treated as high-risk maintenance and reviewed promptly.

### Operator/configuration error

Goals/effects: accidental public API/Ollama exposure, trusting spoofed forwarding headers, leaking a token or disabling authentication.

Controls: secure defaults, production token requirement, localhost Compose port binding, explicit `TRUST_PROXY`, `.env.example`, deployment checklist and incident/rollback runbook.

## Security invariants

- No secrets or user photos in Git history, logs or releases.
- Production API authentication is enabled unless an explicit trusted access layer replaces it.
- Public host port remains bound to loopback in the supplied Compose setup.
- Ollama remains private.
- Browser execution never requires privileged container mode or `SYS_ADMIN` in production.
- Main browser navigation remains host-allowlisted.
- Network-facing operations remain bounded by size, time and queue limits.
- Marketplace blocking/DOM changes cause provider failure, not anti-abuse bypasses.

## Privacy properties

Captured photos and scan history live in browser storage. The API has no durable user database. An image is transmitted only when analysis is requested. Logs contain request metadata only. There are no analytics or third-party application scripts by default.

The optional API token stored by the PWA is a shared deployment secret, not per-user identity. A compromise of the application origin can expose it; use a trusted same-origin deployment, strong CSP and no third-party scripts.

## Review triggers

Update this threat model when adding authentication/identity, server persistence, new providers, browser capabilities, file uploads/downloads, third-party scripts/analytics, new outbound services, cloud metadata access, background workers, public APIs or a materially different deployment topology.
