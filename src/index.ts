import { emitTypes } from "./emit.js";
import { infer, inferSamples } from "./infer.js";
import { resolveOptions } from "./options.js";
import { parseJson } from "./parse.js";
import type { JsonToTypesOptions } from "./types.js";

export { JsonToTypesError } from "./errors.js";
export { parseJson } from "./parse.js";
export type { JsonToTypesOptions, OutputFormat } from "./types.js";

/**
 * Convert a JSON-compatible value into TypeScript type declarations.
 *
 * Nested objects become named interfaces (or type aliases). Objects in the
 * same position, including mixed elements of one array, are merged: a field
 * missing from any sample is optional, and conflicting types become a union.
 *
 * This function does not parse JSON text. A string value is the type
 * `string`. Use {@link jsonToTypesFromString} when you have source text.
 *
 * @example
 * ```ts
 * import { jsonToTypes } from "json-to-types";
 *
 * jsonToTypes({ id: 1, tags: ["a"] });
 * // export interface Root {
 * //   id: number;
 * //   tags: string[];
 * // }
 * ```
 */
export function jsonToTypes(value: unknown, options?: JsonToTypesOptions): string {
  return emitTypes(infer(value), resolveOptions(options));
}

/**
 * Merge several samples into one type declaration.
 * Equivalent to {@link jsonToTypes} for a single sample. An array passed
 * here is a list of samples, not a JSON array value — use {@link jsonToTypes}
 * when the array itself is the value.
 */
export function jsonToTypesFromSamples(
  samples: readonly unknown[],
  options?: JsonToTypesOptions,
): string {
  return emitTypes(inferSamples(samples), resolveOptions(options));
}

/** Parse JSON text and convert it. See {@link jsonToTypes}. */
export function jsonToTypesFromString(json: string, options?: JsonToTypesOptions): string {
  return jsonToTypes(parseJson(json), options);
}
