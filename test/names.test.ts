import { describe, expect, it } from "vitest";

import {
  formatPropertyName,
  sanitizeTypeName,
  singularize,
  typeNameFromKey,
} from "../src/names.js";

describe("singularize", () => {
  it("drops a regular plural s", () => {
    expect(singularize("users")).toBe("user");
    expect(singularize("items")).toBe("item");
    expect(singularize("menus")).toBe("menu");
    expect(singularize("taxis")).toBe("taxi");
  });

  it("handles ies, es, and irregulars", () => {
    expect(singularize("categories")).toBe("category");
    expect(singularize("addresses")).toBe("address");
    expect(singularize("statuses")).toBe("status");
    expect(singularize("boxes")).toBe("box");
    expect(singularize("buses")).toBe("bus");
    expect(singularize("children")).toBe("child");
    expect(singularize("people")).toBe("person");
    expect(singularize("indices")).toBe("index");
  });

  it("keeps words whose trailing s is not a plural", () => {
    expect(singularize("series")).toBe("series");
    expect(singularize("species")).toBe("species");
    expect(singularize("status")).toBe("status");
    expect(singularize("data")).toBe("data");
    expect(singularize("bus")).toBe("bus");
    expect(singularize("news")).toBe("news");
    expect(singularize("virus")).toBe("virus");
    expect(singularize("analysis")).toBe("analysis");
    expect(singularize("address")).toBe("address");
  });

  it("singularizes words that already end in ie", () => {
    expect(singularize("cookies")).toBe("cookie");
    expect(singularize("movies")).toBe("movie");
    expect(singularize("Cookies")).toBe("Cookie");
  });

  it("preserves case for irregulars", () => {
    expect(singularize("Children")).toBe("Child");
    expect(singularize("PEOPLE")).toBe("PERSON");
  });
});

describe("type names", () => {
  it("builds pascal names from keys", () => {
    expect(typeNameFromKey("user-name", false)).toBe("UserName");
    expect(typeNameFromKey("line_items", true)).toBe("LineItem");
    expect(typeNameFromKey("users", true)).toBe("User");
    expect(typeNameFromKey("children", true)).toBe("Child");
    expect(typeNameFromKey("data", true)).toBe("Data");
    expect(typeNameFromKey("statuses", true)).toBe("Status");
    expect(typeNameFromKey("URL", false)).toBe("URL");
    expect(typeNameFromKey("🚀", false)).toBe("Value");
    expect(typeNameFromKey("", false)).toBe("Value");
  });

  it("keeps a legal root name and rewrites everything else", () => {
    expect(sanitizeTypeName("APIResponse")).toBe("APIResponse");
    expect(sanitizeTypeName("myRoot")).toBe("myRoot");
    expect(sanitizeTypeName("  Root  ")).toBe("Root");
    expect(sanitizeTypeName("my-root")).toBe("MyRoot");
    expect(sanitizeTypeName("class")).toBe("Class");
    expect(sanitizeTypeName("string")).toBe("StringValue");
    expect(sanitizeTypeName("Record")).toBe("RecordValue");
    expect(sanitizeTypeName("123abc")).toBe("N123abc");
    expect(sanitizeTypeName("123")).toBe("N123");
    expect(sanitizeTypeName("")).toBe("Value");
    expect(sanitizeTypeName("🚀")).toBe("Value");
  });
});

describe("property names", () => {
  it("quotes keys that are not identifiers", () => {
    expect(formatPropertyName("id")).toBe("id");
    expect(formatPropertyName("$id")).toBe("$id");
    expect(formatPropertyName("_private")).toBe("_private");
    expect(formatPropertyName("class")).toBe("class");
    expect(formatPropertyName("default")).toBe("default");
    expect(formatPropertyName("名前")).toBe("名前");
    expect(formatPropertyName("foo-bar")).toBe('"foo-bar"');
    expect(formatPropertyName("123")).toBe('"123"');
    expect(formatPropertyName("a b")).toBe('"a b"');
    expect(formatPropertyName("")).toBe('""');
    expect(formatPropertyName('say "hi"')).toBe('"say \\"hi\\""');
    expect(formatPropertyName("constructor")).toBe('"constructor"');
    expect(formatPropertyName("new")).toBe('"new"');
    expect(formatPropertyName("readonly")).toBe('"readonly"');
  });
});
