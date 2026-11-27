import { JsonToTypesError } from "./errors.js";

/** Parse one JSON value. A leading BOM is ignored. */
export function parseJson(input: string): unknown {
  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (source.trim() === "") {
    throw new JsonToTypesError("Invalid JSON: input is empty.");
  }
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected token";
    throw new JsonToTypesError(`Invalid JSON: ${message}`);
  }
}
