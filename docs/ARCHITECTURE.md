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
        |-- Vinted (Playwright)
        |-- Leboncoin (Playwright)
        `-- eBay Browse API (optional HTTPS/OAuth application client)
```

## Data ownership

The phone/browser owns scan history and captured images through IndexedDB. The API has no application database and no durable user-data store. Server-side cache entries are process-local, bounded and disposable.

An image leaves the phone only when the user explicitly requests analysis. Request logging is metadata-only and must not include bodies, images, search terms or credentials.

The optional eBay client secret and application access token remain server-side. The application token is cached only in process memory and is never returned by the Brocante API.

## Request flow

### Identification

The client compresses an image, sends a bounded data URL to `/identify`, the API validates it and calls the configured self-hosted Ollama endpoint with a timeout. Model output is treated as untrusted text and used only as an identification hint.

### Marketplace search

The client submits a bounded query and an explicit provider list to `/search`. The search service checks its TTL cache and invokes selected providers with conservative pacing, bounded queues and provider timeouts. Each provider owns its marketplace-specific parsing/protocol logic.

Vinted and Leboncoin use the isolated Playwright browser path. eBay uses the official Browse API directly over HTTPS when server-side credentials are configured. Its OAuth client-credentials token is reused until shortly before expiry, requests are bounded by an internal timeout and responses are validated before they become `Listing` values. Only fixed-price items deliverable in France, denominated in EUR and linking to the expected eBay France host are accepted.

Provider failures are returned as stable categories rather than leaking internals. The PWA keeps successful results when only some providers fail and displays those failed sources explicitly.

Client/API failures are classified before queue control:

- `transient`: network failures, timeouts, rate limits, 5xx responses, interrupted processing or a search where every requested provider failed. The batch pauses and the item remains eligible for a later explicit retry.
- `configuration`: authentication, CORS/origin/API-address problems or no enabled provider. The batch pauses immediately so following items do not repeat the same global failure; a later explicit retry is allowed after settings are fixed.
- `item`: invalid/oversized input or another failure confined to one scan. The failed scan is persisted but omitted from later batch retries, while the current batch continues. The user can still retry that card manually.

Per-scan IndexedDB writes are serialized so a slower stale write cannot overwrite a newer scan state or resurrect an item after deletion. A scan left in `processing` by a browser/app interruption is recovered as a transient retryable error on the next load and that recovery is persisted before normal queue processing resumes. Old scan records without an error classification remain retryable for backward compatibility.

## Security boundaries

The browser/PWA, internet client, marketplace page, model output and external provider response are all untrusted. The reverse proxy controls public ingress. The Node API is the application trust boundary. The Chromium process is further isolated by a non-root container and its browser sandbox. Direct HTTPS provider responses, including eBay OAuth/Browse responses, are validated as untrusted data before use.

The container is intentionally not privileged. Its filesystem is read-only except temporary storage; process count/shared memory are bounded; all Linux capabilities are dropped first and only `SYS_CHROOT` is re-added for Chromium's filesystem sandbox step; privilege escalation is disabled. A seccomp profile permits the user-namespace syscalls Chromium needs for its sandbox. `SYS_ADMIN`, host networking and privileged mode are not part of the supported production boundary.

## Architectural invariants

- The API is bound to localhost on the host by the supplied Compose deployment.
- Production access is authenticated unless a trusted private/IAP boundary is explicitly used.
- Ollama is private and never intentionally exposed through the API.
- Marketplace code cannot bypass provider abstractions.
- Provider crawling is conservative and does not implement anti-abuse circumvention.
- eBay credentials and application tokens remain server-side and are never logged or exposed to the PWA.
- Server-side persistence is not required for normal operation.
- Browser main navigation cannot leave the configured marketplace host set.
- No release is produced from dependencies that were not installed from the committed lockfile.
- The container capability set is limited to `SYS_CHROOT` after an explicit drop-all baseline.

## Failure model

Marketplace DOM changes or blocking are expected operational failures, not reasons to weaken security. Provider errors degrade only the affected source when usable results remain. Failures that can affect following items pause batch processing so the user can retry without multiplying requests or replacing successful prior items with a chain of identical failures. Item-local failures are isolated instead of blocking unrelated scans.

For eBay, missing credentials, token failures, production-access restrictions, malformed responses, upstream errors and timeouts fail the provider closed. A single Browse 401 invalidates the cached application token and retries once with a newly minted token; repeated failure is surfaced as provider unavailability rather than an authentication detail.

Local processing state is recoverable: interrupted `processing` records become transient retryable errors after reload rather than remaining permanently busy. Ollama can be absent; users may name items manually. Process-local cache loss is harmless. If the browser cannot launch safely, the provider should fail rather than running with elevated container privileges.

Durable changes to these boundaries or invariants require an ADR under `docs/decisions/`.
