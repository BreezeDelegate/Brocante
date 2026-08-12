# Contributing

Brocante stays deliberately small. Changes should make the product safer, simpler or more reliable without adding infrastructure by default.

Start with `AGENTS.md` for repository-wide guardrails and `docs/ENGINEERING_STANDARDS.md` for the review bar. Security-sensitive architecture is documented under `docs/decisions/`.

## Development baseline

Use the Node version in `.node-version` and npm 11. Before opening a pull request, run:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
```

If Docker, browser execution, networking, authentication, CI or release behavior changes, also verify the relevant container/security workflow. Never hide a failed gate with `continue-on-error` or a broad disable without documenting why.

## Scope and risk

Keep pull requests focused and classify them low, normal or high risk using `docs/ENGINEERING_STANDARDS.md`. Authentication, secrets, CORS/proxy trust, browser isolation, Docker permissions, persistence formats, dependency lifecycle scripts, workflows and releases are high-risk surfaces.

Normal/high-risk PRs must state the rollback path. High-risk PRs also need explicit security/privacy impact and negative-path tests where testable.

## Engineering rules

- Never commit credentials, tokens, real user photos, production data or marketplace sessions.
- Validate untrusted data at process boundaries. Marketplace markup, URLs and model output are untrusted.
- Do not add CAPTCHA bypasses, fingerprint spoofing, proxy rotation or other anti-abuse circumvention.
- Keep marketplace integrations behind providers. UI code must not depend on marketplace-specific HTML.
- Browser traffic must not be allowed to reach loopback, private/link-local networks, internal names or metadata endpoints.
- Never use privileged containers, host networking, `SYS_ADMIN` or broad capabilities to make Chromium work.
- Prefer local processing and storage when it materially reduces data exposure or server load.
- Preserve bounded queues, caches, timeouts and conservative provider pacing unless measurements justify a change.
- Do not log request bodies, image payloads, authorization headers, search terms or secrets.
- New network-facing behavior needs input limits, timeouts and an explicit failure path.
- Security-sensitive changes require tests for both accepted and rejected paths.
- GitHub Actions must use least-privilege permissions and immutable commit SHAs.
- Keep documentation current in the same change. Stale instructions are a defect.

## Dependencies

Avoid dependencies for small standard-library problems. When a dependency changes:

- explain why it is needed;
- review the direct/transitive change in `package-lock.json`;
- review any new install/lifecycle scripts;
- update the explicit `allowScripts` list only after reviewing the exact package/version;
- run the production audit.

Do not hand-edit the lockfile.

## Provider changes

Marketplace connectors are expected to break when external DOM or access policy changes. Keep selectors/parsing inside the provider, preserve conservative pacing and fail cleanly. A provider block is not permission to add anti-bot bypass behavior.

Changes that broaden browser navigation or subresource access require a threat-model review.

## Pull requests and commits

The PR description must explain what changed, why, user-visible impact, verification, risk, security/privacy impact and rollback when applicable. Review the complete diff before requesting merge, including lockfiles, workflows and generated output.

Commit messages and PR titles should describe the change plainly. Conventional prefixes are welcome but not required. Avoid mixing unrelated formatting/refactors with behavior changes.

## Definition of done

A change is complete only when implementation, tests, docs, configuration and operations agree and required CI/security checks are green. See `AGENTS.md` for the full repository contract.

## Security reports

Do not open a public issue for an exploitable vulnerability. Follow `SECURITY.md` and use GitHub private vulnerability reporting when enabled.

By contributing, you agree that your contribution is distributed under the repository's PolyForm Noncommercial 1.0.0 license.
