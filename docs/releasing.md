# Releasing

This repository uses semantic-release to automate versioning, npm publishing, and GitHub Releases.

## Trigger

- Workflow: `.github/workflows/release.yml`
- Trigger: push to `main` (and manual `workflow_dispatch`)
- Branch policy in semantic-release: only `main` can release

## What gets released

- The library package (`packages/nbsvis`) is the production artifact and publishes to `@opennbs/nbsvis`.
- A git tag (`vX.Y.Z`) and GitHub Release are created automatically.
- No release commit is created and no `CHANGELOG.md` file is written by semantic-release.

## Required secrets

- `GITHUB_TOKEN` (provided by GitHub Actions)
- `NPM_TOKEN` (automation token for npm)

## npm package setup

1. Create scope `@opennbs` on npm (if not already created).
2. Ensure token owner has publish access to `@opennbs`.
3. Add repository secret `NPM_TOKEN`.

## Commit conventions

semantic-release calculates version bumps from Conventional Commits:

- `feat:` -> minor release
- `fix:` -> patch release
- `feat!:` or `BREAKING CHANGE:` -> major release
- `chore:`, `docs:`, `refactor:` etc. typically do not release unless marked breaking

## First run checklist

1. Ensure `main` is protected and PR-only.
2. Ensure CI must pass before merge.
3. Confirm `packages/nbsvis/package.json` has `name: @opennbs/nbsvis` and `version: 0.1.0`.
4. Optional sanity check locally:
   - `pnpm release:dry`

## First publish as 0.1.0

If you want the first published version to be exactly `0.1.0`, bootstrap once manually:

1. Build package:
   - `pnpm --filter @opennbs/nbsvis build`
2. Publish initial version:
   - `pnpm --filter @opennbs/nbsvis publish --access public --no-git-checks`
3. Create and push the starting tag:
   - `git tag v0.1.0`
   - `git push origin v0.1.0`

After this bootstrap, semantic-release will continue from `v0.1.0` automatically.

## Notes for monorepo scope

- This setup treats `packages/nbsvis` as production code for release purposes.
- `apps/nbsvis-demo` is a consumer/demo app and is not versioned/published by semantic-release.
- You can still deploy the demo app independently using your existing deploy workflow.

## Why this mode

- Avoids commit/push complexity during release runs (branch protection and CI loops).
- Keeps `package.json` versions unchanged in git history.
- Uses tags + GitHub Releases as the source of truth for released versions.
