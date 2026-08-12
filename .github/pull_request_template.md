## Summary

<!-- What changed and why? Keep this user-focused. -->

## User impact

<!-- Visible behavior, migration/compatibility impact, or "none". -->

## Risk classification

- [ ] Low
- [ ] Normal
- [ ] High

<!-- Use docs/ENGINEERING_STANDARDS.md. High-risk changes need explicit threat/failure analysis. -->

## Verification

- [ ] `npm run check` (or N/A explained below)
- [ ] `npm audit --omit=dev --audit-level=high` (or N/A explained below)
- [ ] Relevant negative/failure paths tested
- [ ] Docker/browser/security workflow verified when relevant
- [ ] Complete diff reviewed, including lock/workflow/generated files

Verification notes:

## Security and privacy

<!-- New ingress/egress? secrets? logs? browser permissions? persistence? third-party code/data? Say "none" if none. -->

- [ ] No secrets, personal photos, production data or marketplace sessions added
- [ ] Documentation/threat model/ADR updated when assumptions changed

## Rollback

<!-- Required for normal/high-risk changes. What exact revision/config/action restores service? -->
