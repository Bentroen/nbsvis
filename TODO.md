### Drawing

- [ ] Removing FPS cap
- [ ] Adjust app size to window size

### Note blocks/Piano

- [ ] Key press animations
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

# Audio

- [ ] Sync audio and animation
- [ ] Custom instrument loading
- [ ] Figure out a way to avoid sound dropoffs (likely limiting the maximum number of channels, make it a setting)

# Player

- [ ] Player class with song controls, callbacks etc.
- [ ] Playback speed/pitch controls (e.g. +1st, 1.5x, reverse)
- [ ] Keyboard controls (spacebar, left/right arrows)
- [ ] Master volume control
- [ ] React wrapper (may be part of another lib)
- [ ] Playlist support
- [ ] Tempo changer support
- [ ] Loop support
- [ ] Zipped song support

# Enhancements

- [ ] Rainbow mode
- [ ] Editor mode (not a priority)
- [ ] Set background color/gradient

# Project

- [ ] Move non-API stuff to demo folder
- [ ] Publish to npm
- [ ] CI/CD, documentation
- [ ] Settings manager + Saving and loading settings from local storage
- [ ] Publish API documentation + demo GitHub page

# Custom visualizers

- [ ] Refactor to allow adding custom visualizers
- [ ] No view (audio only)
- [ ] Piano mosaic (one window per instrument)
- [ ] Pulsing instrument blocks
- [ ] Single waveform (one window, overlapping instruments in each color)
- [ ] Waveform mosaic (one window per instrument)
- [ ] Player bar with bins (similar to Soundcloud player)
