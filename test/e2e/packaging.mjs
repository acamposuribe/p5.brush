// Packaging regression: a consumer that imports p5.brush only for its side
// effects (p5 global mode: `import "p5.brush"` registers the addon) must keep
// the library when bundled. The package is installed into a temporary
// node_modules exactly as a consumer would see it. Run after npm run build.
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rollup } from "rollup";
import resolve from "@rollup/plugin-node-resolve";

const dir = await mkdtemp(join(tmpdir(), "p5brush-consumer-"));
try {
  const pkg = join(dir, "node_modules", "p5.brush");
  await mkdir(pkg, { recursive: true });
  await cp("package.json", join(pkg, "package.json"));
  await cp("dist", join(pkg, "dist"), { recursive: true });

  for (const specifier of ["p5.brush", "p5.brush/standalone"]) {
    const entry = join(dir, "entry.js");
    await writeFile(entry, `import "${specifier}";\n`);
    const bundle = await rollup({
      input: entry,
      external: ["p5"],
      plugins: [resolve({ browser: true, rootDir: dir })],
      onwarn: () => {},
    });
    const { output } = await bundle.generate({ format: "esm" });
    await bundle.close();
    const size = output[0].code.length;
    assert.ok(size > 10_000, `import "${specifier}" was tree-shaken away (${size} bytes)`);
    console.log(`PASS side-effect import "${specifier}" kept by bundler (${(size / 1024).toFixed(0)} KiB)`);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
