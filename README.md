# nbsvis

[![Build](https://github.com/Bentroen/nbsvis/actions/workflows/check.yml/badge.svg)](https://github.com/Bentroen/nbsvis/actions/workflows/check.yml)

Web player and visualizer for Note Block Studio songs

## Packages

- **`@opennbs/nbsvis`** – Core orchestration (`Player`, song loading, `buildAudioPlaybackPayload`, `buildViewerRenderPayload`). No Pixi dependency.
- **`@opennbs/nbsvis-pixi-viewer`** – Reference `PixiViewer` implementing `NbsvisViewerBackend` (Pixi.js).
- **`@opennbs/nbsvis-viewer-api`** – Viewer contract types (`NbsvisViewerBackend`, `ViewerRenderPayload`).
- **`@opennbs/nbsvis-audio-api`** / **`@opennbs/nbsvis-web-audio`** – Audio contract and Web Audio implementation.

## Usage

Create a viewer backend (typically `PixiViewer` from `@opennbs/nbsvis-pixi-viewer`), mount it, initialize Pixi, then construct `Player` with `viewerBackend` and optional `webAudio` options:

```ts
import { Player } from '@opennbs/nbsvis';
import { PixiViewer } from '@opennbs/nbsvis-pixi-viewer';

const viewer = new PixiViewer();
viewer.mount(container);
viewer.setViewMode('piano-roll');
await viewer.init();

const player = new Player({
  viewerBackend: viewer,
  webAudio: { urlBase: import.meta.env.BASE_URL },
});
```

## Configurable worker/worklet URL base

Pass `urlBase`, or explicit `workerUrl` / `workletUrl`, via `webAudio` when using the default Web Audio engine, or inject a custom `audioBackend` that implements `NbsvisAudioBackend`.

## Release

Automated releases are handled with semantic-release on pushes to `main`.
See `docs/releasing.md` for commit conventions, required repository secrets, and workflow behavior.

Why don't we bundle?
https://e18e.dev/blog/bundling-dependencies
