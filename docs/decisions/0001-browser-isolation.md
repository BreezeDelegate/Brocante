# ADR 0001: Browser isolation for untrusted marketplaces

Status: Accepted

## Context

Brocante uses Playwright/Chromium to visit marketplace pages that must be treated as untrusted web content. Chromium's sandbox should remain active, but Docker's default seccomp profile blocks user-namespace syscalls needed by the sandbox.

Granting `--privileged`, `SYS_ADMIN` or host networking would make the container boundary materially weaker and is not an acceptable production workaround.

Playwright's Docker guidance for crawling/scraping recommends a separate non-root user together with a seccomp profile that allows `clone`, `setns` and `unshare` for Chromium user namespaces.

## Decision

The supplied runtime:

- runs as the non-root `node` user;
- launches Chromium with `chromiumSandbox: true`;
- applies `.docker/seccomp_profile.json`, based on the Docker default profile with the user-namespace syscalls Chromium requires;
- runs with a read-only filesystem and temporary `/tmp`;
- drops all Linux capabilities;
- sets `no-new-privileges`;
- limits PIDs and shared memory;
- blocks downloads and service workers;
- restricts main navigation to exact marketplace hosts;
- blocks obvious loopback/private/link-local/internal browser targets.

CI must prove both API health and a successful sandboxed Chromium launch under the same hardening flags.

## Consequences

The project maintains both Chromium's internal sandbox and a least-privilege container boundary. The seccomp profile is security-sensitive and should be reviewed when Docker/Playwright changes.

The URL policy is defense in depth, not a complete network firewall. DNS rebinding and unknown browser/runtime vulnerabilities remain residual risks. High-assurance deployments should also restrict container egress at the host/cloud/network layer or isolate browser execution into a dedicated worker/VM with only required internet access.

## Rejected alternatives

### Privileged container or `SYS_ADMIN`

Rejected for production because it broadens privileges specifically around code that renders untrusted internet content. `SYS_ADMIN` may be useful for local debugging only and must not become the deployment baseline.

### Disable Chromium sandbox

Rejected while the supported seccomp/non-root approach works. A browser launch failure should fail closed and be diagnosed rather than silently disabling the sandbox.

### Host networking

Rejected because it unnecessarily removes network isolation and makes internal services easier for a compromised browser to reach.

## Review triggers

Revisit this decision when changing browser engine/version strategy, base OS, container runtime, seccomp profile, provider architecture, network topology or moving browser execution to a dedicated service.
