# Contributing

Brocante stays deliberately small. Changes should make the product safer, simpler or more reliable without adding infrastructure by default.

## Before opening a pull request

Use Node.js 24 and npm 11, then run:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
```

Keep pull requests focused, explain the user-visible effect, and add tests for changed behavior. Update `package-lock.json` with dependency changes.

## Engineering rules

When goals conflict, prefer security/privacy, then correctness, reliability, maintainability, performance and delivery speed. Do not weaken a higher-priority property just to make a check pass.

- Never commit credentials, tokens, real user photos, production data or marketplace sessions.
- Validate untrusted data at process boundaries. Marketplace markup, URLs and model output are untrusted.
- Do not add CAPTCHA bypasses, fingerprint spoofing, proxy rotation or other anti-abuse circumvention.
- Keep marketplace integrations behind providers. UI code must not depend on marketplace-specific HTML.
- Browser traffic must not be allowed to reach loopback, private/link-local networks or metadata endpoints.
- Never use privileged containers, host networking or broad capabilities to make Chromium work.
- Prefer local processing and storage when it materially reduces data exposure or server load.
- Preserve bounded queues, caches, timeouts and conservative provider pacing unless measurements justify a change.
- Do not log request bodies, image payloads, authorization headers, search terms or secrets.
- New network-facing behavior needs input limits, timeouts and an explicit failure path.
- Security-sensitive changes require tests for both accepted and rejected paths.
- GitHub Actions must use least-privilege permissions and immutable commit SHAs.
- Keep documentation short and current. Remove stale instructions instead of adding contradictory notes.

Authentication, CORS/proxy trust, browser isolation, Docker permissions, persistence formats, dependency install scripts, workflows and releases are high-risk surfaces. Changes there should state the security/privacy impact and a rollback path in the pull request.

Commit messages and PR titles should describe the change plainly. Conventional prefixes are welcome but not required.

By contributing, you agree that your contribution is distributed under the repository's PolyForm Noncommercial 1.0.0 license.
