# Contributing

Thanks for looking. The useful change is usually a sharper rule or a case the converter gets wrong. A new option is worth adding when the current output cannot express it.

## Setup

Node 18 or newer.

```bash
git clone https://github.com/frozenmango8/json-to-types.git
cd json-to-types
npm install
npm test
npm run typecheck
```

`npm test` is the check that matters. `npm run typecheck` covers `src/` and `test/` with strict TypeScript. `npm run build` compiles the library and CLI to `dist/` and bundles the playground to `web/json-to-types.js`. Do not commit either of those. `dist/` and the bundle are gitignored on purpose.

Preview the page after a build:

```bash
npm run build
python3 -m http.server -d web 4173
```

Open `http://127.0.0.1:4173/`. The page loads `./json-to-types.js` and `./styles.css` with relative paths so it works on GitHub project Pages (`https://frozenmango8.github.io/json-to-types/`).

## Where the behavior lives

- `src/infer.ts` decides the type of a value and how two types merge. Objects in the same position merge. An empty array uses a bottom element type so a later element replaces `unknown[]`.
- `src/emit.ts` names nested objects and prints the source. The root name is the type of the whole value.
- `src/names.ts` quotes keys, singularizes array names, and keeps type names legal.
- `src/cli.ts` is the executable's logic, separated from `src/bin.ts` so tests can call `runCli` without spawning a process.
- `web/main.js` is the playground. It calls the generated bundle. Keep it free of a second copy of the converter.

If you change what a sample prints, update the unit test that locks that string and run the suite. `test/helpers.ts` typechecks the generated source. A declaration that does not compile under `strict` plus the DOM lib is a bug even when the string looks right.

## Pull requests

- Add a test for the case you fixed. Prefer an exact source string for a behavior someone might paste, and the compiler check for everything else.
- Keep the public surface small: `jsonToTypes`, `jsonToTypesFromSamples`, `jsonToTypesFromString`, `parseJson`, and `JsonToTypesError`.
- Do not add a runtime dependency for something the standard library already does.
- The output is an API. Sample order must not reshuffle unions or keys, aside from JavaScript's own rule that integer-like keys come first.
- Pages deploys from `main` only. The workflow is `.github/workflows/pages.yml`.

Open the PR against `main`.
