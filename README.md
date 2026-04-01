# nbsvis

[![Build](https://github.com/Bentroen/nbsvis/actions/workflows/check.yml/badge.svg)](https://github.com/Bentroen/nbsvis/actions/workflows/check.yml)

Web player and visualizer for Note Block Studio songs

## Single entrypoint

`@opennbs/nbsvis` is a single entrypoint.
Viewer classes are exported directly, and `pixi.js` is provided by the consuming app.

## Configurable worker/worklet URL base

The audio engine no longer derives worker/worklet URLs from `document.baseURI`.
Pass `urlBase`, or explicit `workerUrl` / `workletUrl`, via `Player` options:

```ts
const player = new Player(viewer, {
  audioEngine: {
    urlBase: import.meta.env.BASE_URL,
  },
});
```

## Release

Automated releases are handled with semantic-release on pushes to `main`.
See `docs/releasing.md` for commit conventions, required repository secrets, and workflow behavior.

Why don't we bundle?
https://e18e.dev/blog/bundling-dependencies
