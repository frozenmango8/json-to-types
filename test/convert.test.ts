import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { JsonToTypesError, jsonToTypes, jsonToTypesFromSamples, jsonToTypesFromString } from "../src/index.js";
import type { JsonToTypesOptions } from "../src/types.js";
import { expectCompiles, source } from "./helpers.js";

const users = {
  users: [
    {
      id: 1,
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "admin",
      profile: { bio: "Mathematician", website: null },
    },
    {
      id: 2,
      name: "Grace Hopper",
      email: null,
      role: "engineer",
      active: true,
      profile: { bio: "Rear admiral", website: "https://example.com", title: "Dr." },
    },
  ],
  "next-page": 2,
  tags: ["json", "types"],
};

const usersTypes = source(`
  export interface Root {
    users: User[];
    "next-page": number;
    tags: string[];
  }

  export interface User {
    id: number;
    name: string;
    email: string | null;
    role: string;
    profile: Profile;
    active?: boolean;
  }

  export interface Profile {
    bio: string;
    website: string | null;
    title?: string;
  }
`);

describe("primitives and objects", () => {
  it("types primitives", () => {
    expect(jsonToTypes("hello")).toBe(source(`export type Root = string;`));
    expect(jsonToTypes(1)).toBe(source(`export type Root = number;`));
    expect(jsonToTypes(true)).toBe(source(`export type Root = boolean;`));
    expect(jsonToTypes(null)).toBe(source(`export type Root = null;`));
  });

  it("treats a JSON string as data, and parses text separately", () => {
    expect(jsonToTypes('{"id":1}')).toBe(source(`export type Root = string;`));
    expect(jsonToTypesFromString('{"id":1}')).toBe(source(`
      export interface Root {
        id: number;
      }
    `));
  });

  it("names nested objects and preserves key order", () => {
    expect(jsonToTypes({ id: 1, user: { name: "Ada" } })).toBe(source(`
      export interface Root {
        id: number;
        user: User;
      }

      export interface User {
        name: string;
      }
    `));
  });

  it("skips undefined fields and types odd values as unknown", () => {
    expect(jsonToTypes({ a: 1, b: undefined })).toBe(source(`
      export interface Root {
        a: number;
      }
    `));
    expect(jsonToTypes({ at: new Date("2020-01-01T00:00:00Z") })).toBe(source(`
      export interface Root {
        at: unknown;
      }
    `));
    class Box {
      x = 1;
    }
    expect(jsonToTypes(new Box())).toBe(source(`export type Root = unknown;`));
  });

  it("types plain objects created in another realm", () => {
    const context = createContext({ jsonToTypes });
    const generated = runInContext("jsonToTypes({ id: 1, name: 'Ada' })", context);
    expect(generated).toBe(source(`
      export interface Root {
        id: number;
        name: string;
      }
    `));
  });

  it("reads dictionaries created with a null prototype", () => {
    const record = Object.create(null) as Record<string, unknown>;
    record.id = 1;
    expect(jsonToTypes(record)).toBe(source(`
      export interface Root {
        id: number;
      }
    `));
  });

  it("emits an empty object as an empty interface", () => {
    expect(jsonToTypes({})).toBe(source(`export interface Root {}`));
    expect(jsonToTypes({}, { format: "type" })).toBe(source(`export type Root = {};`));
  });
});

describe("arrays, null, and unions", () => {
  it("merges mixed object elements into optional fields", () => {
    expect(jsonToTypes([{ id: 1, name: "Ada" }, { id: 2, email: "ada@example.com" }])).toBe(source(`
      export type Root = RootItem[];

      export interface RootItem {
        id: number;
        name?: string;
        email?: string;
      }
    `));
  });

  it("singularizes a plural root name for the element", () => {
    expect(
      jsonToTypes([{ id: 1, name: "Ada" }, { id: 2, email: "ada@example.com" }], { rootName: "Users" }),
    ).toBe(source(`
      export type Users = User[];

      export interface User {
        id: number;
        name?: string;
        email?: string;
      }
    `));
  });

  it("names nested array elements from the key", () => {
    expect(jsonToTypes({ children: [{ name: "Ada" }, { name: "Grace", age: 1 }] })).toBe(source(`
      export interface Root {
        children: Child[];
      }

      export interface Child {
        name: string;
        age?: number;
      }
    `));
  });

  it("distinguishes null, missing, and both", () => {
    expect(jsonToTypes([{ a: "x" }, { a: null }])).toBe(source(`
      export type Root = RootItem[];

      export interface RootItem {
        a: string | null;
      }
    `));
    expect(jsonToTypes([{ a: "x" }, {}])).toBe(source(`
      export type Root = RootItem[];

      export interface RootItem {
        a?: string;
      }
    `));
    expect(jsonToTypes([{ a: "x" }, { a: null }, {}])).toBe(source(`
      export type Root = RootItem[];

      export interface RootItem {
        a?: string | null;
      }
    `));
    expect(jsonToTypes({ a: null })).toBe(source(`
      export interface Root {
        a: null;
      }
    `));
  });

  it("orders union members independently of sample order", () => {
    const left = jsonToTypes([{ a: null }, { a: "x" }, { a: 1 }]);
    const right = jsonToTypes([{ a: 1 }, { a: "x" }, { a: null }]);
    expect(left).toBe(right);
    expect(left).toContain("a: string | number | null;");
  });

  it("unions mixed array elements and parenthesizes them", () => {
    expect(jsonToTypes([1, null, "a", true])).toBe(source(`export type Root = (string | number | boolean | null)[];`));
    expect(jsonToTypes([{ id: 1 }, "nope", { id: 2, extra: true }])).toBe(source(`
      export type Root = (RootItem | string)[];

      export interface RootItem {
        id: number;
        extra?: boolean;
      }
    `));
  });

  it("types empty arrays as unknown until an element appears", () => {
    expect(jsonToTypes([])).toBe(source(`export type Root = unknown[];`));
    expect(jsonToTypes({ tags: [] })).toBe(source(`
      export interface Root {
        tags: unknown[];
      }
    `));
    expect(jsonToTypesFromSamples([{ tags: [] }, { tags: ["a", "b"] }])).toBe(source(`
      export interface Root {
        tags: string[];
      }
    `));
  });

  it("keeps nested arrays inline", () => {
    expect(jsonToTypes({ matrix: [[1, 2], [3]] })).toBe(source(`
      export interface Root {
        matrix: number[][];
      }
    `));
    expect(jsonToTypes({ matrix: [[{ x: 1 }], [{ x: 2, y: 3 }]] })).toBe(source(`
      export interface Root {
        matrix: Matrix[][];
      }

      export interface Matrix {
        x: number;
        y?: number;
      }
    `));
  });

  it("skips holes and undefined array elements", () => {
    const sparse: string[] = [];
    sparse[1] = "a";
    expect(jsonToTypes(sparse)).toBe(source(`export type Root = string[];`));
    expect(jsonToTypes(["a", undefined, "b"])).toBe(source(`export type Root = string[];`));
  });

  it("merges separate samples", () => {
    expect(jsonToTypesFromSamples([{ id: 1, name: "Ada" }, { id: 2, name: null, active: true }])).toBe(source(`
      export interface Root {
        id: number;
        name: string | null;
        active?: boolean;
      }
    `));
    expect(jsonToTypesFromSamples([{ id: 1 }, "nope"])).toBe(source(`
      export type Root = RootObject | string;

      export interface RootObject {
        id: number;
      }
    `));
  });

  it("rejects an empty sample list", () => {
    expect(() => jsonToTypesFromSamples([])).toThrow(JsonToTypesError);
  });
});

describe("names, quoting, and options", () => {
  it("converts the readme example", () => {
    expect(jsonToTypes(users)).toBe(usersTypes);
    expectCompiles(usersTypes);
  });

  it("quotes invalid identifiers and leaves legal ones alone", () => {
    const generated = jsonToTypes({
      id: 1,
      class: "admin",
      default: true,
      名前: "Ada",
      "user-name": "ada",
      "123": 4,
      "say \"hi\"": false,
      constructor: { ok: true },
      new: false,
      readonly: "no",
    });
    expect(generated).toBe(source(`
      export interface Root {
        "123": number;
        id: number;
        class: string;
        default: boolean;
        名前: string;
        "user-name": string;
        "say \\"hi\\"": boolean;
        "constructor": Constructor;
        "new": boolean;
        "readonly": string;
      }

      export interface Constructor {
        ok: boolean;
      }
    `));
    expectCompiles(generated);
  });

  it("disambiguates colliding type names", () => {
    expect(jsonToTypes({ user: { id: 1 }, users: [{ id: 2, name: "Ada" }] })).toBe(source(`
      export interface Root {
        user: User;
        users: RootUser[];
      }

      export interface User {
        id: number;
      }

      export interface RootUser {
        id: number;
        name: string;
      }
    `));
  });

  it("singularizes hyphenated array keys", () => {
    expect(
      jsonToTypes({
        "line-items": [
          { sku: "A", qty: 1 },
          { sku: "B", qty: 2, note: "rush" },
        ],
      }),
    ).toBe(source(`
      export interface Root {
        "line-items": LineItem[];
      }

      export interface LineItem {
        sku: string;
        qty: number;
        note?: string;
      }
    `));
  });

  it("emits type aliases when asked", () => {
    expect(jsonToTypes(users, { format: "type", exported: false, rootName: "Account" })).toBe(source(`
      type Account = {
        users: User[];
        "next-page": number;
        tags: string[];
      };

      type User = {
        id: number;
        name: string;
        email: string | null;
        role: string;
        profile: Profile;
        active?: boolean;
      };

      type Profile = {
        bio: string;
        website: string | null;
        title?: string;
      };
    `));
  });

  it("sanitizes the root name", () => {
    expect(jsonToTypes({ ok: true }, { rootName: "my-root" })).toContain("interface MyRoot ");
    expect(jsonToTypes({ ok: true }, { rootName: "APIResponse" })).toContain("interface APIResponse ");
    expect(jsonToTypes({ ok: true }, { rootName: "class" })).toContain("interface Class ");
    expect(jsonToTypes({ ok: true }, { rootName: "string" })).toContain("interface StringValue ");
    expect(jsonToTypes({ ok: true }, { rootName: "123" })).toContain("interface N123 ");
    expect(jsonToTypes({ ok: true }, { rootName: "   " })).toContain("interface Root ");
  });

  it("rejects invalid options", () => {
    const badFormat = { format: "class" } as unknown as JsonToTypesOptions;
    expect(() => jsonToTypes({}, badFormat)).toThrow(/Format must be/);
    const badExport = { exported: "yes" } as unknown as JsonToTypesOptions;
    expect(() => jsonToTypes({}, badExport)).toThrow(/exported must be/);
    const badName = { rootName: 12 } as unknown as JsonToTypesOptions;
    expect(() => jsonToTypes({}, badName)).toThrow(/rootName must be/);
  });

  it("refuses circular structures", () => {
    const box: { self?: unknown } = {};
    box.self = box;
    expect(() => jsonToTypes(box)).toThrow(/circular/);
  });

  it("strips a leading BOM and rejects empty or broken JSON", () => {
    expect(jsonToTypesFromString('\uFEFF{"id":1}')).toContain("id: number;");
    expect(() => jsonToTypesFromString("")).toThrow(/empty/);
    expect(() => jsonToTypesFromString("   ")).toThrow(/empty/);
    expect(() => jsonToTypesFromString("{")).toThrow(/Invalid JSON:/);
  });

  it("is deterministic", () => {
    expect(jsonToTypes(users)).toBe(jsonToTypes(users));
  });

  it("does not follow __proto__ into the prototype", () => {
    const generated = jsonToTypes(JSON.parse('{"__proto__":{"x":1}}') as unknown);
    expect(generated).toContain("__proto__: Proto;");
    expect(generated).toContain("x: number;");
    expectCompiles(generated);
  });
});

describe("generated TypeScript compiles", () => {
  const fixtures: unknown[] = [
    null,
    1,
    "a",
    true,
    [],
    [1, null, "a", false],
    {},
    { a: 1, "b-c": true, "": null },
    users,
    [{ a: 1 }, { b: "x" }, { a: null }],
    { data: [] },
    { data: [{ id: 1 }, { id: 2, label: "a" }] },
    { users: [{ name: "a" }, { name: null, id: 1 }] },
    { matrix: [[{ x: 1 }], [{ x: 2, y: null }]] },
    { events: [{ type: "click" }, { type: "key", key: "Enter" }] },
    { record: { id: 1 }, string: { id: "a" }, error: { message: "no" } },
  ];

  it("compiles interface and type output, with and without export", () => {
    for (const value of fixtures) {
      for (const format of ["interface", "type"] as const) {
        for (const exported of [true, false]) {
          expectCompiles(jsonToTypes(value, { format, exported, rootName: "Sample" }));
        }
      }
    }
  });
});
