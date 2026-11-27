import { JsonToTypesError } from "./errors.js";
import type { Field, TypeNode } from "./types.js";

/**
 * Infer a type tree from a JSON-compatible value.
 *
 * Objects that appear in the same position are merged, not kept as a union
 * of distinct shapes. An empty array has a `never` element so a later sample
 * (`[]` beside `["a"]`) collapses to `string[]` instead of `unknown[]`.
 */

const NEVER: TypeNode = { kind: "never" };

export function infer(value: unknown): TypeNode {
  return inferValue(value, new WeakSet());
}

export function inferSamples(values: readonly unknown[]): TypeNode {
  let combined: TypeNode | undefined;
  for (const value of values) {
    const next = infer(value);
    combined = combined === undefined ? next : unify(combined, next);
  }
  if (combined === undefined) {
    throw new JsonToTypesError("Expected at least one JSON sample.");
  }
  return combined;
}

export function unify(left: TypeNode, right: TypeNode): TypeNode {
  if (left.kind === "never") return right;
  if (right.kind === "never") return left;

  const merged: TypeNode[] = [];
  for (const member of flatten(left)) absorb(merged, member);
  for (const member of flatten(right)) absorb(merged, member);
  return normalize(merged);
}

function inferValue(value: unknown, seen: WeakSet<object>): TypeNode {
  if (value === null) return { kind: "null" };
  switch (typeof value) {
    case "string":
      return { kind: "string" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "undefined":
    case "bigint":
    case "symbol":
    case "function":
      return { kind: "unknown" };
    case "object":
      return inferContainer(value, seen);
    default:
      return { kind: "unknown" };
  }
}

function inferContainer(value: object, seen: WeakSet<object>): TypeNode {
  if (seen.has(value)) {
    throw new JsonToTypesError("Cannot convert a circular structure to TypeScript types.");
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) return inferArray(value, seen);
    if (!isPlainObject(value)) return { kind: "unknown" };
    return inferObject(value, seen);
  } finally {
    seen.delete(value);
  }
}

function inferArray(value: readonly unknown[], seen: WeakSet<object>): TypeNode {
  let element: TypeNode = NEVER;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) continue;
    const item = value[index];
    if (item === undefined) continue;
    element = unify(element, inferValue(item, seen));
  }
  return { kind: "array", element };
}

function inferObject(value: Record<string, unknown>, seen: WeakSet<object>): TypeNode {
  const fields: Field[] = [];
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child === undefined) continue;
    fields.push({ key, required: true, type: inferValue(child, seen) });
  }
  return { kind: "object", fields };
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null || proto === Object.prototype) return true;
  // A plain object from another realm (an iframe, or a vm) has that realm's
  // Object.prototype: its prototype is null and its constructor is Object.
  // Class instances sit one step further up, so they stay `unknown`.
  if (typeof proto !== "object") return false;
  if (Object.getPrototypeOf(proto) !== null) return false;
  const ctor: unknown = (proto as { constructor?: unknown }).constructor;
  return typeof ctor === "function" && ctor.name === "Object";
}

function flatten(node: TypeNode): TypeNode[] {
  if (node.kind === "never") return [];
  if (node.kind === "union") {
    const members: TypeNode[] = [];
    for (const member of node.members) members.push(...flatten(member));
    return members;
  }
  return [node];
}

function absorb(into: TypeNode[], member: TypeNode): void {
  const index = into.findIndex((existing) => existing.kind === member.kind);
  if (index === -1) {
    into.push(member);
    return;
  }
  const existing = into[index];
  if (existing === undefined) return;
  if (existing.kind === "object" && member.kind === "object") {
    into[index] = { kind: "object", fields: mergeFields(existing.fields, member.fields) };
    return;
  }
  if (existing.kind === "array" && member.kind === "array") {
    into[index] = { kind: "array", element: unify(existing.element, member.element) };
  }
}

function mergeFields(left: readonly Field[], right: readonly Field[]): Field[] {
  const rightByKey = new Map(right.map((field) => [field.key, field]));
  const seen = new Set<string>();
  const fields: Field[] = [];

  for (const field of left) {
    seen.add(field.key);
    const other = rightByKey.get(field.key);
    if (other === undefined) {
      fields.push({ key: field.key, type: field.type, required: false });
      continue;
    }
    fields.push({
      key: field.key,
      type: unify(field.type, other.type),
      required: field.required && other.required,
    });
  }

  for (const field of right) {
    if (seen.has(field.key)) continue;
    fields.push({ key: field.key, type: field.type, required: false });
  }

  return fields;
}

/**
 * Union member order is stable across sample order: objects, arrays,
 * string, number, boolean, then null. `null` stays at the end so the common
 * case reads `string | null`.
 */
function normalize(members: readonly TypeNode[]): TypeNode {
  const present = members.filter((member) => member.kind !== "never");
  present.sort((left, right) => rank(left.kind) - rank(right.kind));
  const only = present[0];
  if (only === undefined) return NEVER;
  if (present.length === 1) return only;
  return { kind: "union", members: present };
}

function rank(kind: TypeNode["kind"]): number {
  switch (kind) {
    case "object":
      return 0;
    case "array":
      return 1;
    case "string":
      return 2;
    case "number":
      return 3;
    case "boolean":
      return 4;
    case "null":
      return 5;
    case "unknown":
      return 6;
    case "never":
      return 7;
    case "union":
      return 8;
  }
}
