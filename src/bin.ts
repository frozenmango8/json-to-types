#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

import { runCli } from "./cli.js";

function readVersion(): string {
  const url = new URL("../package.json", import.meta.url);
  const parsed = JSON.parse(readFileSync(url, "utf8")) as { version?: unknown };
  return typeof parsed.version === "string" ? parsed.version : "0.0.0";
}

function main(): void {
  try {
    const result = runCli(process.argv.slice(2), {
      version: readVersion(),
      stdinIsTTY: process.stdin.isTTY === true,
      readStdin: () => readFileSync(0, "utf8"),
      readFile: (path) => readFileSync(path, "utf8"),
      writeFile: (path, contents) => writeFileSync(path, contents),
    });
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr);
    process.exitCode = result.code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`json-to-types: ${message}\n`);
    process.exitCode = 1;
  }
}

main();
