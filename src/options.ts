import { JsonToTypesError } from "./errors.js";
import type { JsonToTypesOptions, OutputFormat } from "./types.js";

export interface ResolvedOptions {
  readonly rootName: string;
  readonly format: OutputFormat;
  readonly exported: boolean;
}

export function resolveOptions(options: JsonToTypesOptions | undefined): ResolvedOptions {
  const format = readFormat(options?.format);
  const exported = readExported(options?.exported);
  const rootName = readRootName(options?.rootName);
  return { format, exported, rootName };
}

function readFormat(value: unknown): OutputFormat {
  const format = value ?? "interface";
  if (format === "interface" || format === "type") return format;
  throw new JsonToTypesError('Format must be "interface" or "type".');
}

function readExported(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value === "boolean") return value;
  throw new JsonToTypesError("exported must be a boolean.");
}

function readRootName(value: unknown): string {
  if (value === undefined) return "Root";
  if (typeof value !== "string") throw new JsonToTypesError("rootName must be a string.");
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Root";
}
