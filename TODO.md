### Drawing

- [ ] Removing FPS cap
- [x] Adjust app size to window size

### Note blocks/Piano

- [x] Key press animations
- [ ] Auto-distance scale calculation (to try and keep a consistent scrolling speed)
- [ ] Implement object pooling for note block sprites
- [ ] Pre-generate note block instrument sprites
- [ ] Let user provide the desired scrolling speed and adjust all songs to be in that range, based on the tempo (but always with a sensible default)
- [ ] Lato font in note blocks/piano
- [ ] Key names in piano
- [ ] Setting to toggle key names overall
- [ ] Instrument octave offset
- [ ] Auto-detect/allow overriding keyboard size (constructor: pianoRange = (0, 87))
- [ ] Piano keys lighting up in the color of the instrument
- [ ] Disabling/customizing note block colors
- [ ] Background filters (blur, glow etc.) https://pixijs.io/filters/docs/
- [ ] Setting to normalize pitch (should the pressed key be the note key, or the actual factored pitch)
- [ ] Dynamic resize based on performance (e.g. 50% using `app.stage.scale(2.0)`)

# Audio

- [x] Sync audio and animation
- [x] Custom instrument loading
- [ ] Figure out a way to avoid sound dropoffs (likely limiting the maximum number of channels, make it a setting)

# Player

- [x] Player class with song controls, callbacks etc.
- [ ] Playback speed/pitch controls (e.g. +1st, 1.5x, reverse)
- [ ] Keyboard controls (spacebar, left/right arrows)
- [ ] Master volume control
- [ ] React wrapper (may be part of another lib)
- [ ] Media API integration
- [ ] Playlist support
- [x] Tempo changer support
- [ ] Normalize duration representation as seconds instead of ticks (progress bar should move at a constant speed)
- [ ] Loop support
- [x] Zipped song support
- [ ] Keeping global state (e.g. song position, volume, etc.) between pages, as in Soundcloud, Spotify... (consider using a state management lib)

# Enhancements

- [ ] Rainbow mode
- [ ] Set background color/gradient

# Project

- [x] Move non-API stuff to demo folder
- [ ] Publish to npm
- [ ] CI/CD
- [ ] Documentation
- [ ] Settings manager + Saving and loading settings from local storage
- [ ] Publish API documentation + demo GitHub page

# Custom visualizers

- [ ] Editor mode view
- [ ] Vertical piano roll/different note scroll directions
- [ ] Refactor to allow adding custom visualizers
- [ ] No view (audio only)
- [ ] Piano mosaic (one window per instrument)
- [ ] Pulsing instrument blocks
- [ ] Single waveform (one window, overlapping instruments in each color)
- [ ] Waveform mosaic (one window per instrument)
- [ ] Player bar with bins (similar to Soundcloud player)
