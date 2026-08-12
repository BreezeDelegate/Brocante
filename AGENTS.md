# Repository guardrails

`AGENTS.md` is the local operating contract for humans and coding agents working on Brocante. Read it with `CONTRIBUTING.md` and the documents under `docs/` before changing a security-sensitive surface.

## Priority order

When goals conflict, optimize in this order: security and privacy, correctness, reliability and recoverability, simplicity and maintainability, performance, then delivery speed. Never weaken a higher-priority property merely to make a check pass.

## Non-negotiable rules

- Never commit secrets, credentials, production data, real user photos or copied marketplace session material.
- Treat request bodies, marketplace HTML and URLs, AI output, environment variables and browser content as untrusted at their boundaries.
- Never add CAPTCHA bypasses, fingerprint spoofing, proxy rotation or other anti-abuse circumvention.
- Never make a container privileged, add `SYS_ADMIN`, use host networking or broaden capabilities just to make Chromium work. Browser isolation follows `docs/decisions/0001-browser-isolation.md`.
- Keep production runtime non-root, read-only, least-capability and bounded in processes/resources.
- Browser traffic must not be allowed to reach loopback, private/link-local networks, internal hostnames or infrastructure metadata endpoints.
- Do not add a dependency when a small standard-library solution is clear. Dependency and lifecycle-script changes require explicit review of `package-lock.json`.
- GitHub Actions must use least-privilege permissions and immutable commit SHAs for external actions.
- Never log authorization headers, request bodies, photos, search terms, secrets or model payloads containing user data.
- Marketplace-specific DOM/parsing logic stays behind providers under `apps/api/src/providers/`.
- New network-facing behavior requires validation, finite limits, finite timeouts, explicit failure handling and negative tests.
- Security-sensitive changes require rejected-path tests, not only happy-path tests.
- Documentation and operational instructions must change in the same PR as the behavior they describe.

## Required workflow

For normal code changes, run:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
```

For Docker, browser, authentication, networking, CI or release changes, also verify the relevant container/security job. Review the complete diff before merge and confirm lock/generated files only changed intentionally.

PRs must state the user-visible effect, risk classification, verification, security/privacy impact and rollback path when applicable. Durable architecture/security tradeoffs require an ADR update.

## Definition of done

A change is done only when code, tests, configuration, documentation and operational consequences agree and required CI/security checks are green. A workaround that knowingly leaves the repository inconsistent is not done.
