import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import * as esbuild from "esbuild";

const binPath = "dist/bin.js";
const bin = readFileSync(binPath, "utf8");
if (!bin.startsWith("#!")) {
  writeFileSync(binPath, `#!/usr/bin/env node\n${bin}`);
}
chmodSync(binPath, 0o755);

await esbuild.build({
  entryPoints: ["src/browser.ts"],
  bundle: true,
  format: "iife",
  globalName: "JsonToTypes",
  outfile: "web/json-to-types.js",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  banner: {
    js: "/* json-to-types | MIT License | https://github.com/frozenmango8/json-to-types */",
  },
  footer: {
    js: "globalThis.JsonToTypes = JsonToTypes;",
  },
  logLevel: "info",
});
