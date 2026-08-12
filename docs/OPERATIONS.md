# Operations runbook

This runbook defines the supported production baseline, verification, rollback and incident actions for the self-hosted deployment.

## Supported topology

- Static PWA served over HTTPS
- Same-origin `/api` reverse proxy preferred
- Brocante API on a VPS/container host
- Docker Compose host mapping `127.0.0.1:8787:8787`
- Private Ollama endpoint on the host or trusted private network
- Optional eBay Browse API access using server-side application credentials
- No server-side application database

Do not expose port 8787 or Ollama directly to the public internet.

## Pre-deployment checklist

1. Review the exact commit/tag and required CI/CodeQL results.
2. Copy `.env.example` to `.env` outside source control.
3. Set a long random `API_TOKEN`, unless a trusted identity-aware/private access layer replaces it.
4. Configure `TRUST_PROXY=1` only for exactly one trusted reverse proxy; otherwise leave it `0`.
5. Set `CORS_ORIGINS` only for intentional cross-origin deployments.
6. Confirm host firewall policy and HTTPS termination.
7. Confirm Ollama is private and reachable only where required.
8. If eBay is enabled, store `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` in the operator's secret store, configure both together, and confirm the developer account has the production Buy/Browse access required by eBay.
9. Review dependency/security advisories and release notes before major updates.

## Deploy

```bash
docker compose build --pull
docker compose up -d
docker compose ps
```

Verify the local health endpoint from the host:

```bash
curl --fail http://127.0.0.1:8787/health
```

Then verify through the public HTTPS origin, including one authenticated request and one expected unauthorized request. Do not paste secrets into shared shell history or incident tickets.

If eBay is configured, enable it only for the smoke test, run one controlled search and confirm that a provider failure remains isolated from Vinted/Leboncoin. Do not print OAuth responses or credentials while debugging.

## Runtime security expectations

The supplied Compose configuration should remain non-root, read-only and `no-new-privileges`, bounded by a PID limit, and use the project seccomp profile so Chromium can keep its sandbox active. The capability model is `cap_drop: ALL` followed by `cap_add: SYS_CHROOT` only; that single capability is retained for Chromium's filesystem sandbox step.

A provider/browser launch failure is not a reason to add privileged mode, `SYS_ADMIN`, host networking or additional capabilities without a documented threat analysis. Diagnose kernel/seccomp/AppArmor support or isolate the browser workload more strongly instead.

## Health and monitoring

`/health` proves the API process can answer HTTP; it is intentionally shallow and does not expose internals. Production operators should additionally monitor reverse-proxy 5xx rate, container restart count, resource saturation, provider error rate and disk/system health using the host's normal monitoring stack.

Request logs are structured metadata. They must not be changed to include bodies, search terms, photos, authorization data, eBay credentials or OAuth tokens.

## Routine updates

At least monthly, and promptly for relevant security advisories:

- review Dependabot PRs;
- rebuild images with current base-image security fixes;
- run `npm audit --omit=dev --audit-level=high`;
- verify CI/CodeQL;
- test one real provider query in a controlled environment because marketplace DOM/API changes are not fully covered by unit tests;
- if eBay is enabled, review its current production-access/API requirements and rotate its client secret according to the operator's credential policy.

## Backup and recovery

The API has no durable application database. Server recovery therefore focuses on source/tag, deployment configuration and secrets. Keep `.env`/secret material in the operator's secure backup system, not in Git.

User scan history lives in browser IndexedDB and is device-local. Replacing a device/browser profile can lose that history; the server cannot restore it.

## Rollback

Rollback should be boring and fast:

1. Identify the last known-good tag/commit and the reason for rollback.
2. Restore that revision or previously retained image.
3. Rebuild/start with the unchanged secret configuration.
4. Verify local `/health`, public HTTPS, authentication and one safe provider path.
5. Record the incident/change and do not roll forward again until the regression is understood.

Because server state is disposable, rollback normally does not require data migration. If future versions add persistent data, this runbook must be updated before that feature is considered production-ready.

## Security incident response

### Suspected token or provider-credential leak

- Rotate `API_TOKEN` immediately if affected.
- Rotate the affected provider credential (including the eBay client secret) and invalidate/revoke related tokens through the provider's supported process when available.
- Restart/redeploy the API with the new secret configuration.
- Inspect metadata logs for unusual request volume/status patterns without copying sensitive data into tickets.
- Determine the leak source and invalidate any related reverse-proxy/IAP credentials.

### Suspected host/container compromise

- Remove the service from public reach.
- Preserve relevant host/reverse-proxy/container metadata logs and image/tag identifiers.
- Rotate API, provider and infrastructure secrets from a trusted machine.
- Rebuild a clean host/image from known-good source; do not rely on cleaning a potentially compromised container.
- Review browser/provider and dependency changes leading to the incident.

### Marketplace/provider incident

If a provider starts blocking, redirecting unexpectedly, rejecting API access or returning malformed content, disable/avoid that provider or let it fail closed. Do not add bypass behavior as an emergency fix.

## Post-incident review

For meaningful incidents, record timeline, impact, detection, root cause, contributing factors, containment, corrective actions and a test/control that prevents recurrence. Update `docs/THREAT_MODEL.md`, an ADR or these operations instructions when the incident changes an assumption.
