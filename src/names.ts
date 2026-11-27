/**
 * Identifier and type-name helpers.
 *
 * Singularization is deliberately small and best-effort. It covers the
 * plurals that show up constantly in JSON (`users`, `categories`,
 * `addresses`, `children`) and leaves odd words alone rather than guessing.
 */

const IDENTIFIER = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

/**
 * Words that are uncountable, or singulars whose last letter is s
 * (`virus`, `analysis`, `address` is handled by the "ss" rule).
 * A blanket "ends with us/is" check would also swallow real plurals
 * such as `menus` and `taxis`.
 */
const INVARIANT = new Set([
  "alias",
  "analysis",
  "atlas",
  "axis",
  "basis",
  "bonus",
  "bus",
  "cactus",
  "campus",
  "canvas",
  "census",
  "chaos",
  "crisis",
  "data",
  "diagnosis",
  "focus",
  "fungus",
  "gas",
  "genius",
  "metadata",
  "news",
  "nucleus",
  "oasis",
  "radius",
  "series",
  "species",
  "status",
  "stimulus",
  "syllabus",
  "synopsis",
  "thesis",
  "virus",
]);

const IRREGULAR = new Map<string, string>([
  ["analyses", "analysis"],
  ["children", "child"],
  ["criteria", "criterion"],
  ["feet", "foot"],
  ["geese", "goose"],
  ["indices", "index"],
  ["matrices", "matrix"],
  ["men", "man"],
  ["mice", "mouse"],
  ["people", "person"],
  ["quizzes", "quiz"],
  ["teeth", "tooth"],
  ["vertices", "vertex"],
  ["women", "woman"],
]);

/** Plurals of words that already end in "ie" (`cookies` → `cookie`). */
const IE_STEMS = new Set(["auntie", "brownie", "cookie", "hoodie", "movie", "selfie"]);

/**
 * Names that are illegal as a type name, or that collide with a global
 * TypeScript type (declaring `interface String` would merge into the lib).
 */
const RESERVED = new Set([
  "any",
  "Array",
  "as",
  "asserts",
  "async",
  "await",
  "Awaited",
  "bigint",
  "boolean",
  "Boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "Date",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "Error",
  "Exclude",
  "export",
  "extends",
  "Extract",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "Function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "infer",
  "instanceof",
  "interface",
  "is",
  "keyof",
  "let",
  "Map",
  "module",
  "namespace",
  "never",
  "new",
  "NonNullable",
  "null",
  "number",
  "Number",
  "object",
  "Object",
  "of",
  "Omit",
  "out",
  "override",
  "package",
  "Parameters",
  "Partial",
  "Pick",
  "private",
  "Promise",
  "protected",
  "public",
  "readonly",
  "Readonly",
  "Record",
  "RegExp",
  "require",
  "Required",
  "return",
  "ReturnType",
  "satisfies",
  "set",
  "Set",
  "static",
  "string",
  "String",
  "super",
  "switch",
  "symbol",
  "Symbol",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unique",
  "unknown",
  "var",
  "void",
  "WeakMap",
  "WeakSet",
  "while",
  "with",
  "yield",
]);

/**
 * Keywords the TypeScript parser treats specially inside a type literal.
 * They are quoted even though they are identifier-shaped.
 */
const QUOTE_IN_TYPE = new Set(["asserts", "constructor", "get", "in", "infer", "is", "keyof", "new", "out", "readonly", "set", "unique"]);

export function isValidIdentifier(name: string): boolean {
  return IDENTIFIER.test(name);
}

export function isReservedTypeName(name: string): boolean {
  return RESERVED.has(name);
}

/** Quote keys that are not identifiers, and a few that break type syntax. */
export function formatPropertyName(key: string): string {
  if (isValidIdentifier(key) && !QUOTE_IN_TYPE.has(key)) return key;
  return JSON.stringify(key);
}

export function singularize(word: string): string {
  if (word.length === 0) return word;
  const lower = word.toLowerCase();
  if (INVARIANT.has(lower)) return word;

  const irregular = IRREGULAR.get(lower);
  if (irregular !== undefined) return matchCase(word, irregular);

  if (lower.endsWith("s")) {
    const stem = word.slice(0, -1);
    if (IE_STEMS.has(stem.toLowerCase())) return stem;
  }

  if (/(?:s|x|z|ch|sh)es$/i.test(word)) return word.slice(0, -2);

  if (/[bcdfghjklmnpqrstvwxyz]ies$/i.test(word)) {
    const y = word.endsWith("IES") ? "Y" : "y";
    return word.slice(0, -3) + y;
  }

  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
  return word;
}

/** Singularize the last word of a PascalCase or camelCase type name. */
export function singularizeIdentifier(name: string): string {
  const words = name.match(/[A-Z]+(?=[A-Z][a-z]|$)|[A-Z]?[a-z]+|[0-9]+|[\p{L}\p{N}]+/gu);
  if (words === null || words.length === 0) return name;
  const next = words.slice();
  const last = next[next.length - 1];
  if (last === undefined) return name;
  next[next.length - 1] = singularize(last);
  return next.join("");
}

/** Build a PascalCase type name from a JSON key. */
export function typeNameFromKey(key: string, singular: boolean): string {
  const parts = key.match(/[\p{L}\p{N}]+/gu);
  if (parts === null || parts.length === 0) return "Value";
  const words = parts.slice();
  if (singular) {
    const last = words[words.length - 1];
    if (last !== undefined) words[words.length - 1] = singularize(last);
  }
  return words.map(capitalize).join("") || "Value";
}

/** Turn arbitrary user input into a legal type name. */
export function sanitizeTypeName(input: string): string {
  const trimmed = input.trim();
  let name =
    trimmed.length > 0 && isValidIdentifier(trimmed) && !isReservedTypeName(trimmed)
      ? trimmed
      : toPascalCase(trimmed);

  if (name.length === 0) name = "Value";
  if (/^[0-9]/.test(name)) name = `N${name}`;
  if (!isValidIdentifier(name) || isReservedTypeName(name)) {
    const base = toPascalCase(name.replace(/Value$/, "")) || "Value";
    name = `${base}Value`;
  }
  if (!isValidIdentifier(name) || isReservedTypeName(name) || /^[0-9]/.test(name)) {
    return "Value";
  }
  return name;
}

export function toPascalCase(input: string): string {
  const parts = input.match(/[\p{L}\p{N}]+/gu);
  if (parts === null) return "";
  return parts.map(capitalize).join("");
}

function capitalize(word: string): string {
  if (word.length === 0) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function matchCase(original: string, next: string): string {
  if (original === original.toUpperCase()) return next.toUpperCase();
  const first = original.charAt(0);
  if (first !== first.toLowerCase() && first === first.toUpperCase()) {
    return next.charAt(0).toUpperCase() + next.slice(1);
  }
  return next;
}
