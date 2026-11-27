/** `interface` declarations, or `type` aliases, for object shapes. */
export type OutputFormat = "interface" | "type";

/**
 * Options for converting a JSON sample.
 *
 * Non-object roots (arrays, unions, primitives) are always emitted as type
 * aliases, because an interface cannot describe them.
 */
export interface JsonToTypesOptions {
  /**
   * Name of the top-level type. Defaults to `"Root"`.
   * Invalid identifiers are rewritten to a PascalCase type name.
   */
  rootName?: string;
  /**
   * Emit `interface` or `type` for object shapes. Defaults to `"interface"`.
   */
  format?: OutputFormat;
  /**
   * Prefix declarations with `export`. Defaults to `true`.
   */
  exported?: boolean;
}

/** A single property discovered on an object sample. */
export interface Field {
  readonly key: string;
  readonly type: TypeNode;
  /** False when at least one merged sample omitted this key. */
  readonly required: boolean;
}

/**
 * Internal type tree. `never` is the bottom type used for an empty array
 * element so it disappears as soon as a real element is seen.
 */
export type TypeNode =
  | { readonly kind: "never" }
  | { readonly kind: "unknown" }
  | { readonly kind: "null" }
  | { readonly kind: "string" }
  | { readonly kind: "number" }
  | { readonly kind: "boolean" }
  | { readonly kind: "array"; readonly element: TypeNode }
  | { readonly kind: "object"; readonly fields: readonly Field[] }
  | { readonly kind: "union"; readonly members: readonly TypeNode[] };

export interface ObjectNode {
  readonly kind: "object";
  readonly fields: readonly Field[];
}
