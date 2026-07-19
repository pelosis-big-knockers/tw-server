# typescript-editor

Demonstrates the editor experience for `setup.*` members, written the plain
SugarCube way (`setup.foo = () => …`), with no augmentation to maintain.

`player.ts` and `combat.ts` each define a `setup` member by assignment; `main.ts`
uses them. The `tsconfig.json` and `sugarcube.d.ts` are what `tw-server init`
writes: the augmentation loads SugarCube's engine types and relaxes story
variables / settings; `setup.*` is handled by the extension (below).

## Trying it in your editor

The `setup.*` intelligence comes from the **Twine SugarCube TypeScript Tools**
VS Code extension (in the sibling `tw-sugarcube-ts-tools` repo). It contributes a
TypeScript language-service plugin globally, so once installed it works in any
project — no per-project plugin config.

1. Build and install the extension:
   ```sh
   cd ../../../tw-sugarcube-ts-tools && npm install && npm run package
   ```
   then in VS Code: **Extensions → … → Install from VSIX…** → the generated
   `.vsix`, and reload.
2. Open `main.ts` and:
   - type `setup.` → completions list `playerName` and `attack`;
   - ctrl+click `setup.attack` → `combat.ts`, `setup.playerName` → `player.ts`;
   - no "property does not exist" squiggle on `setup.*`.

(Engine globals like `State`/`$` resolve from `@types/twine-sugarcube`, which is
available here via the repo's own `node_modules`. In a real project, install
tw-server as a dependency, or add `@types/twine-sugarcube` directly.)

## Building

Like the other examples, this one compiles with `node examples/run.mjs`, which
confirms the build type-checks the cross-file `setup.*` assignments (the build
uses tw-server's bundled types and ignores this editor `tsconfig.json`).
