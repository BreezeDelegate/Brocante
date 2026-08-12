# Engineering standards

These standards define the review and delivery bar for Brocante. They are intentionally stricter on security-sensitive surfaces than on ordinary product code.

## Risk classification

Every pull request uses its highest applicable risk level.

### Low risk

Documentation, copy, isolated styling or tests that do not change runtime behavior.

Expected: focused diff, relevant checks, documentation kept accurate.

### Normal risk

Product behavior, parsing, valuation logic, UI state, provider behavior, caching and ordinary refactors.

Expected: tests for changed behavior, `npm run check`, production dependency audit and failure-path review.

### High risk

Authentication, credentials, CORS/proxy trust, request limits, browser/network isolation, Docker/runtime permissions, persistence migrations, dependency install scripts, GitHub Actions, releases and supply-chain controls.

Expected:

- explicit threat/failure analysis in the PR;
- positive and negative tests where testable;
- rollback procedure;
- secrets/logging/privacy review;
- least-privilege and network-exposure review;
- relevant CI/security checks green;
- ADR update when a durable architecture/security decision changes.

## Design rules

- Prefer small modules with explicit boundaries over cross-cutting convenience.
- Validate untrusted data at the boundary and keep validated internal types narrow.
- Make failures bounded, observable and non-secret.
- Shared browsers, queues and caches need bounded lifetime/resource use.
- AI output is advisory input, never authority for security or deterministic valuation logic.
- Favor backward-compatible data changes. Storage schema changes require migration and downgrade behavior.
- New ingress or egress is a security change, even if the payload looks harmless.

## TypeScript and API rules

- Keep strict TypeScript enabled and avoid `any`; use `unknown` at untrusted boundaries.
- HTTP bodies, environment variables and marketplace data require explicit validation and bounds.
- Client-facing errors must not expose stack traces, filesystem paths, provider internals or secrets.
- Every external operation needs a finite timeout. Queues and caches need finite capacity.
- Trust `X-Forwarded-*` only for an explicitly configured proxy topology.
- Health endpoints must not expose configuration, internal addresses, tokens or dependency details.

## Security and privacy rules

- Data minimization is the default.
- Photos remain local until the user explicitly analyzes them; server logs never contain image payloads.
- The PWA origin is security-sensitive because a private deployment may store an API token locally.
- Marketplace content runs in an untrusted browser context. Main navigation is host-allowlisted and browser requests block obvious local/private targets.
- No third-party analytics/scripts by default.
- Secrets belong in runtime secret/environment management, never source, images, logs or release artifacts.

## Dependency and supply-chain rules

- `package-lock.json` is mandatory and reviewed.
- CI, release and Docker use `npm ci`, never floating installs.
- New dependencies need a clear reason and should minimize privilege, lifecycle scripts and transitive surface.
- npm lifecycle scripts are denied by default except explicitly reviewed entries in `allowScripts`.
- GitHub Actions use immutable commit SHAs and least-privilege permissions.
- Dependabot covers npm, Docker and GitHub Actions.
- High/critical production dependency findings block release unless an exception records owner, reason, mitigation and expiry.
- Releases include checksums and a CycloneDX SBOM.

## Test priorities

Defend invariants rather than implementation details. Prioritize authentication rejection, request validation/size limits, browser URL/egress safety, queue/cache bounds, timeouts, deterministic valuation behavior, provider parsing edge cases and persistence compatibility.

A regression fix should normally add a test that fails before the fix.

## Logging and observability

Structured request logs may include request id, method, normalized path, status and duration. They must not include bodies, search terms, authorization headers, photos or tokens.

Unexpected internal errors should remain discoverable in server logs while client responses stay generic. Provider failures should collapse to stable public categories such as busy, timeout or unavailable.

## Pull requests

Keep PRs reviewable and avoid mixing broad formatting/refactoring with behavior changes unless necessary. The PR body must state what changed and why, user-visible impact, risk classification, verification, security/privacy implications and rollback for normal/high-risk changes.

Do not merge with unexplained failed checks. Disabling or ignoring a check requires a documented rationale and follow-up.

## Definition of done

Code, tests, configuration, documentation, security controls and operational consequences must agree. Required checks are green, no accidental generated/lock changes remain, and rollback is understood for changes capable of disrupting production.
