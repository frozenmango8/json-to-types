import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const version = spawnSync(process.execPath, ["dist/bin.js", "--version"], { encoding: "utf8" });
assert(version.status === 0, version.stderr || version.stdout);
assert(version.stdout.trim() === "0.1.0", `unexpected version: ${version.stdout}`);

const converted = spawnSync(process.execPath, ["dist/bin.js", "--name", "Health"], {
  encoding: "utf8",
  input: '{"ok":true}\n',
});
assert(converted.status === 0, converted.stderr);
assert(converted.stdout.includes("interface Health"), converted.stdout);
assert(converted.stdout.includes("ok: boolean"), converted.stdout);

const bundle = readFileSync("web/json-to-types.js", "utf8");
const sandbox = {};
runInContext(bundle, createContext(sandbox), { filename: "json-to-types.js" });
const generated = sandbox.JsonToTypes.jsonToTypes({ id: 1 }, { rootName: "Item" });
assert(typeof generated === "string" && generated.includes("interface Item"), generated);
assert(generated.includes("id: number"), generated);

console.log("smoke ok");
