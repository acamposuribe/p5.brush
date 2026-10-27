# Standalone Adapter

Runs p5.brush without p5.js, on any WebGL2 canvas. It provides the same
rendering and runtime services as `src/adapters/p5/`: canvas targets
(`target.js`), the WebGL renderer and compositor, transforms and angle mode
(`runtime.js`), the frame lifecycle (`frame.js`), and custom-tip surfaces
(`stroke.js`).

Built as `dist/brush*.js` and published as `p5.brush/standalone`. Usage is
documented in [docs/standalone.md](../../../docs/standalone.md).
