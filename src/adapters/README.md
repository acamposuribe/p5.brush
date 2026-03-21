# Adapters

This folder is the start of the host/runtime split for p5.brush.

- `p5/` contains the current p5-specific runtime integration.
- `standalone/` is reserved for a future host that does not depend on p5.

Core drawing logic should gradually move away from direct p5 assumptions and
depend on adapter-provided services instead.
