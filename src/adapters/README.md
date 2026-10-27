# Adapters

Each adapter connects the shared drawing core to a host runtime.

- `p5/` integrates with p5.js (the `p5.brush` build).
- `standalone/` runs without p5 on any WebGL2 canvas (the `p5.brush/standalone`
  build, `dist/brush*.js`). See [docs/standalone.md](../../docs/standalone.md).

Core drawing logic should depend on adapter-provided services rather than
on either host directly.
