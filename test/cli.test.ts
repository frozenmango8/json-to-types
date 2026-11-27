import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { helpText, runCli } from "../src/cli.js";
import type { CliIO } from "../src/cli.js";
import { source } from "./helpers.js";

function createIO(options: {
  files?: Record<string, string>;
  stdin?: string;
  stdinIsTTY?: boolean;
  fail?: "ENOENT" | "EISDIR";
}): { io: CliIO; written: Map<string, string> } {
  const written = new Map<string, string>();
  const files = options.files ?? {};
  const io: CliIO = {
    version: "0.0.0-test",
    stdinIsTTY: options.stdinIsTTY ?? false,
    readStdin: () => options.stdin ?? "",
    readFile: (path) => {
      if (options.fail !== undefined) {
        const error = new Error(options.fail) as Error & { code: string };
        error.code = options.fail;
        throw error;
      }
      if (!Object.hasOwn(files, path)) {
        const error = new Error(`missing ${path}`) as Error & { code: string };
        error.code = "ENOENT";
        throw error;
      }
      return files[path] ?? "";
    },
    writeFile: (path, contents) => {
      written.set(path, contents);
    },
  };
  return { io, written };
}

describe("cli", () => {
  it("prints help and version", () => {
    const help = runCli(["--help"], createIO({}).io);
    expect(help.code).toBe(0);
    expect(help.stdout).toBe(helpText);
    expect(help.stdout).toContain("https://frozenmango8.github.io/json-to-types/");
    const version = runCli(["-v"], createIO({}).io);
    expect(version.stdout).toBe("0.0.0-test\n");
  });

  it("converts a file", () => {
    const { io } = createIO({ files: { "user.json": '{"id":1,"name":"Ada"}\n' } });
    const result = runCli(["user.json", "--name", "User"], io);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(source(`
      export interface User {
        id: number;
        name: string;
      }
    `));
  });

  it("reads stdin when no file is given", () => {
    const { io } = createIO({ stdin: "[1, null]" });
    const result = runCli(["--format", "type", "--no-export"], io);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(source(`type Root = (number | null)[];`));
  });

  it("accepts equals-style flags and a dash for stdin", () => {
    const { io } = createIO({
      files: { "a.json": '{"id":1}' },
      stdin: '{"id":2,"name":"Ada"}',
    });
    const result = runCli(["--name=Account", "--format=interface", "a.json", "-"], io);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("interface Account ");
    expect(result.stdout).toContain("name?: string;");
  });

  it("merges multiple files and can write the result", () => {
    const { io, written } = createIO({
      files: {
        "a.json": '{"id":1,"name":"Ada"}',
        "b.json": '{"id":2,"name":null,"active":true}',
      },
    });
    const result = runCli(["a.json", "b.json", "-o", "out.ts"], io);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(written.get("out.ts")).toBe(source(`
      export interface Root {
        id: number;
        name: string | null;
        active?: boolean;
      }
    `));
  });

  it("reports a missing file, a directory, and invalid JSON with the path", () => {
    const missing = runCli(["nope.json"], createIO({}).io);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("File not found: nope.json");

    const directory = runCli(["dir"], createIO({ fail: "EISDIR" }).io);
    expect(directory.stderr).toContain("Not a file: dir");

    const broken = runCli(["bad.json"], createIO({ files: { "bad.json": "{" } }).io);
    expect(broken.code).toBe(1);
    expect(broken.stderr).toContain("bad.json: Invalid JSON:");
  });

  it("explains an empty tty and empty stdin", () => {
    const tty = runCli([], createIO({ stdinIsTTY: true }).io);
    expect(tty.code).toBe(1);
    expect(tty.stderr).toContain("No input");

    const empty = runCli([], createIO({ stdin: " \n" }).io);
    expect(empty.code).toBe(1);
    expect(empty.stderr).toContain("input is empty");
  });

  it("rejects unknown options, a bad format, and a missing value", () => {
    expect(runCli(["--nope"], createIO({}).io).stderr).toContain("Unknown option: --nope");
    expect(runCli(["--format", "class"], createIO({ stdin: "{}" }).io).stderr).toContain("Expected --format");
    expect(runCli(["--name"], createIO({}).io).stderr).toContain("Missing value for --name");
  });

  it("treats arguments after -- as files", () => {
    const { io } = createIO({ files: { "-n": '{"ok":true}' } });
    const result = runCli(["--", "-n"], io);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("ok: boolean;");
  });

  it("round-trips a temp file through the real filesystem reader", () => {
    const directory = mkdtempSync(join(tmpdir(), "json-to-types-"));
    const input = join(directory, "payload.json");
    const output = join(directory, "payload.ts");
    writeFileSync(input, '{"count":3}\n');
    const result = runCli([input, "-o", output, "-n", "Payload"], {
      version: "test",
      stdinIsTTY: false,
      readStdin: () => "",
      readFile: (path) => readFileSync(path, "utf8"),
      writeFile: (path, contents) => writeFileSync(path, contents),
    });
    expect(result.code).toBe(0);
    expect(readFileSync(output, "utf8")).toBe(source(`
      export interface Payload {
        count: number;
      }
    `));
  });
});
