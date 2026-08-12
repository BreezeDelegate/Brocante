# GitHub repository settings

Several important controls live in GitHub settings rather than source. Treat this file as the repository-level hardening checklist and revisit it when ownership or plan features change.

## Main branch ruleset

Create a ruleset for `main` with:

- require pull requests before merge;
- require the current CI quality, Docker and CodeQL checks;
- require all review conversations to be resolved;
- block force pushes and branch deletion;
- require linear history if the team uses squash/rebase-only merges;
- require CODEOWNERS review when there is at least one independent reviewer available.

For a single-maintainer repository, do not configure a required approval count that makes all merges impossible. Keep the PR/check/conversation rules, then raise the approval requirement when a second maintainer exists.

Do not enable mandatory signed commits until maintainer signing is configured and tested; otherwise it becomes an availability failure rather than a security control.

## Security and analysis

Enable:

- Dependency graph;
- Dependabot alerts;
- Dependabot security updates;
- private vulnerability reporting;
- secret scanning and push protection when available for the repository/plan.

Dependency graph is especially important because GitHub's Dependency Review action cannot operate without it. Once enabled, add a required Dependency Review PR check that fails on high/critical vulnerable dependency introductions.

The repository already runs CodeQL from a pinned workflow. Keep code scanning results visible and triage real alerts rather than suppressing queries globally.

## Actions

Recommended repository Actions settings:

- default `GITHUB_TOKEN` permission: read repository contents;
- workflows may elevate only the specific permissions they require;
- do not allow Actions to approve pull requests unless a future workflow genuinely requires it;
- prefer selected/trusted actions and keep every action reference pinned to an immutable full SHA;
- review Dependabot updates for Actions before merging.

Release workflows legitimately need `contents: write`; ordinary CI does not.

## Merge hygiene

Prefer squash merge for this small repository so each PR becomes one understandable main-branch change. Automatically delete merged head branches. Keep release tags immutable and use semantic version tags matching `vMAJOR.MINOR.PATCH`.

## Ownership

`CODEOWNERS` documents sensitive surfaces, but it only becomes an enforcement control when branch/ruleset settings require code-owner review. Add teams rather than individual accounts when the maintainer group grows.

## Release protection

For a team deployment, add a tag ruleset for `v*` that prevents deletion/rewriting and limits tag creation to maintainers/release automation. Release tags should point only to revisions whose required checks passed.

## Periodic review

Quarterly, verify that required check names still match real workflows, removed maintainers no longer have write/admin access, installed GitHub Apps remain necessary, secrets are still scoped/used, and security features have not been disabled during troubleshooting.
