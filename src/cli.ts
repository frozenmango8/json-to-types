import { JsonToTypesError } from "./errors.js";
import { jsonToTypesFromSamples, parseJson } from "./index.js";
import type { JsonToTypesOptions, OutputFormat } from "./types.js";

export interface CliIO {
  readonly version: string;
  readonly stdinIsTTY: boolean;
  readStdin(): string;
  readFile(path: string): string;
  writeFile(path: string, contents: string): void;
}

export interface CliResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ParsedArgs {
  readonly files: string[];
  readonly rootName: string | undefined;
  readonly format: OutputFormat | undefined;
  readonly exported: boolean;
  readonly outFile: string | undefined;
  readonly help: boolean;
  readonly version: boolean;
}

export const helpText = `json-to-types — convert JSON samples into TypeScript types

Usage:
  json-to-types [files...] [options]
  cat data.json | json-to-types [options]

A file of "-" reads stdin. Multiple files are merged into one type:
fields missing from a sample become optional, and conflicting types
become unions.

Options:
  -n, --name <name>    Root type name (default: Root)
  -f, --format <kind>  interface or type (default: interface)
      --no-export      Omit the export keyword
  -o, --out <file>     Write output to a file instead of stdout
  -h, --help           Show this help
  -v, --version        Show the version

Examples:
  json-to-types payload.json
  json-to-types payload.json --name User --format type
  json-to-types success.json error.json -o api.ts
  curl -s https://api.example.com/me | json-to-types --name Profile

Playground:
  https://frozenmango8.github.io/json-to-types/
`;

/** Run the CLI and return output instead of exiting the process. */
export function runCli(argv: readonly string[], io: CliIO): CliResult {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    return fail(`${parsed.error}\nRun json-to-types --help for usage.`);
  }
  if (parsed.help) return ok(helpText);
  if (parsed.version) return ok(`${io.version}\n`);

  try {
    const samples = loadSamples(parsed.files, io);
    const options = buildOptions(parsed);
    const output = jsonToTypesFromSamples(samples, options);
    if (parsed.outFile !== undefined) {
      io.writeFile(parsed.outFile, output);
      return ok("");
    }
    return ok(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(message);
  }
}

function ok(stdout: string): CliResult {
  return { code: 0, stdout, stderr: "" };
}

function fail(message: string): CliResult {
  const text = message.endsWith("\n") ? message : `${message}\n`;
  return { code: 1, stdout: "", stderr: `json-to-types: ${text}` };
}

function buildOptions(args: ParsedArgs): JsonToTypesOptions {
  const options: JsonToTypesOptions = { exported: args.exported };
  if (args.rootName !== undefined) options.rootName = args.rootName;
  if (args.format !== undefined) options.format = args.format;
  return options;
}

function loadSamples(files: readonly string[], io: CliIO): unknown[] {
  if (files.length === 0) {
    if (io.stdinIsTTY) {
      throw new JsonToTypesError(
        "No input. Pass a JSON file or pipe JSON on stdin.\nRun json-to-types --help for usage.",
      );
    }
    return [parseJson(io.readStdin())];
  }

  let stdin: string | undefined;
  const readStdinOnce = (): string => {
    stdin ??= io.readStdin();
    return stdin;
  };

  return files.map((file) => {
    const text = file === "-" ? readStdinOnce() : readInput(file, io);
    try {
      return parseJson(text);
    } catch (error) {
      if (file === "-" || !(error instanceof JsonToTypesError)) throw error;
      throw new JsonToTypesError(`${file}: ${error.message}`);
    }
  });
}

function readInput(path: string, io: CliIO): string {
  try {
    return io.readFile(path);
  } catch (error) {
    const code = readErrorCode(error);
    if (code === "ENOENT") throw new JsonToTypesError(`File not found: ${path}`);
    if (code === "EISDIR") throw new JsonToTypesError(`Not a file: ${path}`);
    const message = error instanceof Error ? error.message : String(error);
    throw new JsonToTypesError(message);
  }
}

function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string") return code;
  }
  return "";
}

function parseArgs(argv: readonly string[]): ParsedArgs | { error: string } {
  const files: string[] = [];
  let rootName: string | undefined;
  let format: OutputFormat | undefined;
  let exported = true;
  let outFile: string | undefined;
  let help = false;
  let version = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === "--") {
      files.push(...argv.slice(index + 1));
      break;
    }
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "-v" || arg === "--version") {
      version = true;
      continue;
    }
    if (arg === "--no-export") {
      exported = false;
      continue;
    }
    if (arg === "--export") {
      exported = true;
      continue;
    }

    const name = readFlag(argv, index, arg, ["-n", "--name"], "--name=");
    if (name !== undefined) {
      if ("error" in name) return name;
      rootName = name.value;
      index += name.consumed;
      continue;
    }

    const formatFlag = readFlag(argv, index, arg, ["-f", "--format"], "--format=");
    if (formatFlag !== undefined) {
      if ("error" in formatFlag) return formatFlag;
      if (formatFlag.value !== "interface" && formatFlag.value !== "type") {
        return {
          error: `Expected --format to be "interface" or "type", got ${JSON.stringify(formatFlag.value)}.`,
        };
      }
      format = formatFlag.value;
      index += formatFlag.consumed;
      continue;
    }

    const out = readFlag(argv, index, arg, ["-o", "--out"], "--out=");
    if (out !== undefined) {
      if ("error" in out) return out;
      outFile = out.value;
      index += out.consumed;
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") return { error: `Unknown option: ${arg}` };
    files.push(arg);
  }

  return { files, rootName, format, exported, outFile, help, version };
}

interface FlagValue {
  readonly value: string;
  readonly consumed: number;
}

function readFlag(
  argv: readonly string[],
  index: number,
  arg: string,
  names: readonly string[],
  equalsPrefix: string,
): FlagValue | { error: string } | undefined {
  if (arg.startsWith(equalsPrefix)) {
    return { value: arg.slice(equalsPrefix.length), consumed: 0 };
  }
  if (!names.includes(arg)) return undefined;
  const value = argv[index + 1];
  if (value === undefined || (value.startsWith("-") && value !== "-")) {
    return { error: `Missing value for ${arg}.` };
  }
  return { value, consumed: 1 };
}
