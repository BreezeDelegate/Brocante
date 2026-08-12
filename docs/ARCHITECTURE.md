# Architecture

Brocante is intentionally a small system with explicit trust boundaries. The mobile PWA performs capture, local storage and presentation. A self-hosted API performs optional visual identification and marketplace searches.

## Components

```text
Mobile browser / installed PWA
  |-- camera + image compression
  |-- IndexedDB scan history and preferences
  |
  | HTTPS, same-origin /api preferred
  v
Reverse proxy / TLS boundary
  v
Brocante API (Node.js, non-root container)
  |-- validation, authentication, rate limits, request IDs
  |-- search service: cache + bounded provider execution
  |-- Playwright Chromium: untrusted marketplace pages
  |     |-- exact main-navigation host allowlist
  |     |-- local/private target blocking
  |     `-- downloads/service workers/media disabled or blocked
  |
  |-- Ollama HTTP client (optional, private server/host endpoint)
  `-- provider adapters
        |-- Vinted
        |-- Leboncoin
        `-- eBay placeholder/provider surface
```

## Data ownership

The phone/browser owns scan history and captured images through IndexedDB. The API has no application database and no durable user-data store. Server-side cache entries are process-local, bounded and disposable.

An image leaves the phone only when the user explicitly requests analysis. Request logging is metadata-only and must not include bodies, images, search terms or credentials.

## Request flow

### Identification

The client compresses an image, sends a bounded data URL to `/identify`, the API validates it and calls the configured self-hosted Ollama endpoint with a timeout. Model output is treated as untrusted text and used only as an identification hint.

### Marketplace search

The client submits a bounded query and an explicit provider list to `/search`. The search service checks its TTL cache and invokes selected providers with conservative pacing, bounded queues and provider timeouts. Each provider owns its marketplace-specific DOM parsing.

Provider failures are returned as stable categories rather than leaking internals.

## Security boundaries

The browser/PWA, internet client, marketplace page, model output and external provider response are all untrusted. The reverse proxy controls public ingress. The Node API is the application trust boundary. The Chromium process is further isolated by a non-root container and its browser sandbox.

The container is intentionally not privileged. Its filesystem is read-only except temporary storage; process count/shared memory are bounded; Linux capabilities are dropped and privilege escalation is disabled. A seccomp profile permits the user-namespace syscalls Chromium needs for its sandbox.

## Architectural invariants

- The API is bound to localhost on the host by the supplied Compose deployment.
- Production access is authenticated unless a trusted private/IAP boundary is explicitly used.
- Ollama is private and never intentionally exposed through the API.
- Marketplace code cannot bypass provider abstractions.
- Provider crawling is conservative and does not implement anti-abuse circumvention.
- Server-side persistence is not required for normal operation.
- Browser main navigation cannot leave the configured marketplace host set.
- No release is produced from dependencies that were not installed from the committed lockfile.

## Failure model

Marketplace DOM changes or blocking are expected operational failures, not reasons to weaken security. Provider errors should degrade the affected source while preserving the API. Ollama can be absent; users may name items manually. Process-local cache loss is harmless. If the browser cannot launch safely, the provider should fail rather than running with elevated container privileges.

Durable changes to these boundaries or invariants require an ADR under `docs/decisions/`.
