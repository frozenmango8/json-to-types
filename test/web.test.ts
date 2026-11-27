import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("playground page", () => {
  const html = readFileSync("web/index.html", "utf8");

  it("loads assets with relative paths for GitHub project pages", () => {
    expect(html).toContain('href="./styles.css"');
    expect(html).toContain('src="./json-to-types.js"');
    expect(html).toContain('src="./main.js"');
    expect(html).not.toMatch(/\s(?:href|src)="\//);
  });

  it("documents the playground and the worked example", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("https://frozenmango8.github.io/json-to-types/");
    expect(readme).toContain('"next-page": number;');
    expect(readme).toContain("export type Events = Event[];");
    expect(readFileSync("CONTRIBUTING.md", "utf8")).toContain("npm test");
  });

  it("points at the repository and keeps the converter in the page", () => {
    expect(html).toContain("https://github.com/frozenmango8/json-to-types");
    expect(html).toContain("Nothing leaves your browser.");
    expect(readFileSync("web/main.js", "utf8")).toContain("JsonToTypes");
    expect(readFileSync("web/styles.css", "utf8")).toContain("--accent");
  });
});
