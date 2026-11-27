import {
  formatPropertyName,
  sanitizeTypeName,
  singularizeIdentifier,
  typeNameFromKey,
} from "./names.js";
import type { ResolvedOptions } from "./options.js";
import type { ObjectNode, TypeNode } from "./types.js";

interface NameState {
  readonly used: Set<string>;
  readonly names: Map<TypeNode, string>;
  readonly objects: ObjectNode[];
}

/** Print a type tree as TypeScript source, ending with a newline. */
export function emitTypes(root: TypeNode, options: ResolvedOptions): string {
  const rootName = sanitizeTypeName(options.rootName);
  const state: NameState = { used: new Set(), names: new Map(), objects: [] };

  if (root.kind === "object") {
    collect(root, rootName, rootName, state);
  } else {
    state.used.add(rootName);
    collectLoose(root, rootName, state);
  }

  const blocks = state.objects.map((object) =>
    emitObjectDeclaration(objectName(object, state.names), object, options, state.names),
  );

  if (root.kind !== "object") {
    blocks.unshift(emitAlias(rootName, emitTypeExpr(root, state.names), options));
  }

  if (blocks.length === 0) {
    return `${options.exported ? "export " : ""}type ${rootName} = unknown;\n`;
  }
  return `${blocks.join("\n\n")}\n`;
}

function collect(node: TypeNode, suggested: string, parent: string, state: NameState): void {
  switch (node.kind) {
    case "object": {
      if (state.names.has(node)) return;
      const name = claimName(suggested, parent, state.used);
      state.names.set(node, name);
      state.objects.push(node);
      for (const field of node.fields) {
        const child = typeNameFromKey(field.key, shouldSingularize(field.type));
        collect(field.type, child, name, state);
      }
      return;
    }
    case "array":
      collect(node.element, suggested, parent, state);
      return;
    case "union":
      for (const member of node.members) collect(member, suggested, parent, state);
      return;
    default:
      return;
  }
}

function collectLoose(node: TypeNode, rootName: string, state: NameState): void {
  switch (node.kind) {
    case "array":
      collect(node.element, arrayElementName(rootName, state.used), rootName, state);
      return;
    case "union":
      for (const member of node.members) collectLoose(member, rootName, state);
      return;
    case "object":
      collect(node, `${rootName}Object`, rootName, state);
      return;
    default:
      return;
  }
}

function shouldSingularize(node: TypeNode): boolean {
  switch (node.kind) {
    case "array":
      return true;
    case "union":
      return node.members.some((member) => shouldSingularize(member));
    default:
      return false;
  }
}

function arrayElementName(rootName: string, used: Set<string>): string {
  const singular = sanitizeTypeName(singularizeIdentifier(rootName));
  if (singular !== rootName && !used.has(singular)) return singular;
  const item = sanitizeTypeName(`${rootName}Item`);
  if (!used.has(item)) return item;
  let index = 2;
  while (used.has(`${item}${index}`)) index += 1;
  return `${item}${index}`;
}

function claimName(suggested: string, parent: string, used: Set<string>): string {
  const base = sanitizeTypeName(suggested);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const prefixed = sanitizeTypeName(`${parent}${base}`);
  if (prefixed !== base && !used.has(prefixed)) {
    used.add(prefixed);
    return prefixed;
  }
  let index = 2;
  while (used.has(`${base}${index}`)) index += 1;
  const numbered = `${base}${index}`;
  used.add(numbered);
  return numbered;
}

function emitObjectDeclaration(
  name: string,
  node: ObjectNode,
  options: ResolvedOptions,
  names: Map<TypeNode, string>,
): string {
  const lead = options.exported ? "export " : "";
  const body = emitObjectBody(node, names);
  if (options.format === "interface") return `${lead}interface ${name} ${body}`;
  return `${lead}type ${name} = ${body};`;
}

function emitAlias(name: string, expression: string, options: ResolvedOptions): string {
  const lead = options.exported ? "export " : "";
  return `${lead}type ${name} = ${expression};`;
}

function emitObjectBody(node: ObjectNode, names: Map<TypeNode, string>): string {
  if (node.fields.length === 0) return "{}";
  const lines = node.fields.map((field) => {
    const optional = field.required ? "" : "?";
    return `  ${formatPropertyName(field.key)}${optional}: ${emitTypeExpr(field.type, names)};`;
  });
  return `{\n${lines.join("\n")}\n}`;
}

function emitTypeExpr(node: TypeNode, names: Map<TypeNode, string>): string {
  switch (node.kind) {
    case "string":
    case "number":
    case "boolean":
    case "null":
    case "unknown":
      return node.kind;
    case "never":
      return "unknown";
    case "array": {
      const element = node.element.kind === "never" ? "unknown" : emitTypeExpr(node.element, names);
      return node.element.kind === "union" ? `(${element})[]` : `${element}[]`;
    }
    case "object":
      return objectName(node, names);
    case "union":
      return node.members.map((member) => emitTypeExpr(member, names)).join(" | ");
  }
}

function objectName(node: ObjectNode, names: Map<TypeNode, string>): string {
  const name = names.get(node);
  if (name === undefined) {
    throw new Error("Internal error: object type was not named.");
  }
  return name;
}
