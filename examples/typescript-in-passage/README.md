# typescript-in-passage

TypeScript written directly inside a `<<script>>` payload. SugarCube hands the
payload straight to `eval`, so the `interface` and the `: Loot` / `as number`
annotations would be a syntax error in the browser. tw-server compiles each
payload to JavaScript and gives tweego a stripped copy of `story.twee` from the
scratch dir instead of this one — the same arrangement `.ts` files get.

Three payloads, one per case:

- **`:: Start`** — a plain `<<script>>` whose body happens to be TypeScript. The
  `interface` and the annotations are gone from the bundled story; the `const`,
  the `reduce`, and both `State.variables` assignments survive.
- **`:: Haggle`** — the explicit `<<script TypeScript>>` spelling. SugarCube only
  knows `JavaScript` and `TwineScript`, so it would report *unknown language*
  at runtime; the stripped copy carries a plain `<<script>>` tag.
- **`:: Tip`** — `<<script TwineScript>>` is left completely alone. SugarCube
  desugars that payload itself (`$gold` → `State.variables.gold`), so it isn't
  JavaScript for tsc to compile.

Type *checking* of a payload is not tw-server's job — it compiles each one
without the story's types, so it can't tell a real type error from `State`
merely being unresolvable in isolation. It fails the build only when a payload
isn't valid TypeScript at all, and reports that against the `.twee` line. For
checking, use the [Twine SugarCube TypeScript
Tools](../../../tw-sugarcube-ts-tools) extension or its `tw-sugarcube-lint` CLI,
which analyze passages against the whole project.
