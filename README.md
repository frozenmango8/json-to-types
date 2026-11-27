# json-to-types

Turn a JSON sample into clean TypeScript. Nested objects become named interfaces, mixed arrays collapse into one shape with optional fields, and the same converter runs in a library, a CLI, and a page that never uploads your data.

**[Open the playground](https://frozenmango8.github.io/json-to-types/)**

[![CI](https://github.com/frozenmango8/json-to-types/actions/workflows/ci.yml/badge.svg)](https://github.com/frozenmango8/json-to-types/actions/workflows/ci.yml)

```bash
npx json-to-types payload.json --name Account
cat payload.json | npx json-to-types --format type
npx json-to-types success.json error.json -o api.ts
```

There are no runtime dependencies. Inference is deterministic: the same samples always produce the same source.

## A sample in, types out

```json
{
  "users": [
    {
      "id": 1,
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "role": "admin",
      "profile": { "bio": "Mathematician", "website": null }
    },
    {
      "id": 2,
      "name": "Grace Hopper",
      "email": null,
      "role": "engineer",
      "active": true,
      "profile": { "bio": "Rear admiral", "website": "https://example.com", "title": "Dr." }
    }
  ],
  "next-page": 2,
  "tags": ["json", "types"]
}
```

```ts
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
```

`email` was a string in one object and `null` in the other, so it is `string | null`. `active` and `title` were missing from the first object, so they are optional. `"next-page"` is not an identifier, so the key is quoted. `users` and `profile` become their own named types.

## Install

```bash
npm install json-to-types
```

Or skip the install and run `npx json-to-types`. From a checkout of this repo, build first and call the bin directly:

```bash
npm install
npm run build
node dist/bin.js payload.json
```

Node 18 or newer.

## Command line

```
json-to-types [files...] [options]
cat data.json | json-to-types [options]
```

A path of `-` reads stdin. Several files are merged into one type, the same way elements of an array are merged.

| Flag | Default | Effect |
| --- | --- | --- |
| `-n, --name <name>` | `Root` | Name of the top-level type |
| `-f, --format <kind>` | `interface` | `interface` or `type` |
| `--no-export` | exports on | Omit the `export` keyword |
| `-o, --out <file>` | stdout | Write the result to a file |
| `-h, --help` | | Show help |
| `-v, --version` | | Show the version |

```bash
json-to-types payload.json --name Account --format type --no-export
```

```ts
type Account = {
  users: User[];
  "next-page": number;
  tags: string[];
};
```

An array of objects is the list, not the row. Name it with a plural so the element gets the singular:

```bash
json-to-types events.json --name Events
```

```ts
export type Events = Event[];

export interface Event {
  type: string;
  x?: number;
  y?: number;
  target: string | null;
  key?: string;
  meta?: Meta;
}

export interface Meta {
  shift: boolean;
}
```

If the root value is not an object (an array, a union, a primitive), it is always a `type` alias. An interface cannot describe it. Object shapes inside it still follow `--format`.

## Library

```ts
import { jsonToTypes, jsonToTypesFromSamples, jsonToTypesFromString } from "json-to-types";

jsonToTypes({ id: 1, tags: ["a"] });
jsonToTypesFromString(payload, { rootName: "Account", format: "type", exported: false });

// Several responses, one type. This is not the same as converting an array value.
jsonToTypesFromSamples([successBody, errorBody], { rootName: "Reply" });
```

`jsonToTypes` does not parse text. A string is the type `string`. Use `jsonToTypesFromString` for JSON source. Invalid JSON throws `JsonToTypesError`. A leading BOM is ignored.

| Option | Default | Effect |
| --- | --- | --- |
| `rootName` | `"Root"` | Top-level type name. Invalid identifiers are rewritten (`my-root` becomes `MyRoot`, `string` becomes `StringValue`). |
| `format` | `"interface"` | `"interface"` or `"type"` for object shapes |
| `exported` | `true` | Prefix declarations with `export` |

## How a sample becomes a type

The converter only knows what the sample shows. A field that is always a number becomes `number`, even if some other response might send a string. Paste more samples (or pass more files) when you have them.

**Objects in the same place are merged.** Array elements, and files passed together on the CLI, are one position. Fields missing from any sample are optional. Fields that disagree become a union. Objects are not left as a union of separate interfaces.

| What you saw | What you get |
| --- | --- |
| Always a string | `name: string` |
| String, or the key was missing | `name?: string` |
| String or `null` | `name: string \| null` |
| String, `null`, or missing | `name?: string \| null` |
| Only `null` | `name: null` |
| No elements | `tags: unknown[]` |
| Empty, then later `"a"` | `tags: string[]` |

Unions are ordered objects, arrays, `string`, `number`, `boolean`, then `null`, so sample order does not reshuffle the output. The usual case reads `string | null`.

Primitives are widened. Two ids `1` and `2` are `number`, not `1 | 2`.

**Nested objects are named.** The name comes from the key: `user-name` becomes `UserName`, and an array key is singularized (`users` becomes `User`, `line-items` becomes `LineItem`, `children` becomes `Child`). Singularization is a small English list plus the regular rules. It leaves `series`, `status`, `data`, and `virus` alone. If a name is already taken, the parent name is prefixed (`RootUser`), then a number.

The root name is the type of the whole value. `Users` on an array of objects declares `type Users = User[]` and `interface User`. A root name that is already singular, such as `User` for that same array, keeps the alias `User` and calls the row `UserItem`.

**Keys that are not identifiers are quoted**, including hyphens, spaces, and leading digits. A few words that break a type literal (`constructor`, `new`, `readonly`, …) are quoted too. Other keywords stay bare, because TypeScript allows `class: string` in an interface. Type names that would clash with a keyword or a global type (`String`, `Record`, `Array`) get a `Value` suffix.

Key order follows the sample. Integer-like keys such as `"123"` come first, because that is JavaScript's order for object keys.

`undefined` object fields are dropped. Dates, class instances, and functions are `unknown`. Circular values throw.

## Playground

The site at <https://frozenmango8.github.io/json-to-types/> is a static page. Conversion runs in your browser. Nothing is uploaded.

GitHub Pages deploys it from [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main`. The workflow builds the page and publishes the `web/` directory. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** once. After that the workflow owns deploys.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
python3 -m http.server -d web 4173
```

`npm test` runs the unit tests. `npm run build` writes `dist/` (the published library and CLI) and `web/json-to-types.js` (the browser bundle). Neither is committed.

The layout:

| Path | Role |
| --- | --- |
| `src/infer.ts` | Build and merge the type tree |
| `src/emit.ts` | Name nested types and print TypeScript |
| `src/names.ts` | Identifiers, quoting, singular names |
| `src/cli.ts` | Argument parsing, stdin, files |
| `src/bin.ts` | The `json-to-types` executable |
| `web/` | The playground. `main.js` is the page, the bundle is generated |

Generated declarations are typechecked in the test suite against a strict compiler, including the DOM lib, so a name that only looks legal still fails CI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © frozenmango8
