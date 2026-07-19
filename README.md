# tw-server

A Node.js server for managing and serving Twine story formats and related assets.

## Project Structure

- `index.ts` — Main entry point for the server (and the `tw-server init` command).
- `console-writer.ts` — Utility for console output.
- `types/` — Bundled SugarCube type augmentation handed to `tsc` when type-checking a story.
- `tweego/` — Contains tweego executable and related files for compiling .tw files.
- `tsconfig.build.json`, `scripts/build.mjs` — Compile the sources to `dist/` for publishing.

## Features

- Runs a server to automatically compile and serve Twine stories.
- Automatically detects changes in source files, recompiles them, and refreshes the served content.
- Compiles Twee (`.twee`, `.tw`, `.tw2`, `.twee2`), JavaScript (`.js`), and CSS (`.css`) sources with tweego.
- Compiles TypeScript (`.ts`) sources with the native TypeScript compiler (`tsc`): the story's TypeScript is **type-checked** and emitted to JavaScript for tweego to bundle. Type and syntax errors fail the build (nothing is served until they're fixed). Declaration files (`.d.ts`) contribute types only; shebang scripts (Node CLI tooling) are ignored.
- Bundles SugarCube's type definitions (`@types/twine-sugarcube`), so a story's TypeScript can use SugarCube's runtime globals (`setup`, `State`, `Story`, `$`, ...) with full type-checking and no per-project install. `setup`, story variables, and settings are relaxed to permissive index signatures so ad-hoc properties type-check without being declared first, while the rest of the SugarCube API stays fully typed. A project's own augmentation (e.g. from `tw-server init`) merges with this without conflict.
- `tw-server init` scaffolds a `tsconfig.json` and `sugarcube.d.ts` so the **editor** resolves the same SugarCube types the build uses. `setup.*` completion and go-to-definition come from a companion VS Code extension (see [TypeScript editor support](#typescript-editor-support)).

## Getting Started

### Installation

From a clone of the repository, `npm install` builds the package (the `prepare`
script compiles the TypeScript sources to `dist/`). You can then use it globally
or per project.

**Globally** (run `tw-server` from any story folder):

```sh
npm install
npm link
```

**As a project dependency** (recommended when the story uses TypeScript — this is
what makes editor type-checking work; see below):

```sh
npm install -D <path-or-tarball-or-git-url-to-tw-server>
```

### Usage

Run the server in a story folder:

```bat
tw-server
```

Any compilable source files in the current directory (Twee, JavaScript, TypeScript, and CSS) will be compiled into an `index.html` file in the same directory, and served on `http://localhost:8080` by default. You can specify a different port by providing it as an argument:

```bat
tw-server 8090
```

### TypeScript editor support

The server always type-checks a story's TypeScript against SugarCube's types when
it builds. Your **editor** is separate, though — it reads the project's own
`tsconfig.json`, so out of the box it will report SugarCube globals like `setup`
and `State` as undefined. Scaffold the editor setup with:

```bat
tw-server init
```

This writes a `tsconfig.json` with `"types": ["twine-sugarcube"]`, which loads
SugarCube's types. For them to resolve, tw-server must be installed **as a project
dependency** (above), so its bundled `@types/twine-sugarcube` is available; `init`
warns if it can't find them.

### Completion and go-to-definition for `setup` / variables / settings

`setup.foo = () => …`, `State.variables.hp = 10`, and `settings.volume = 1` attach
members by assignment, which TypeScript's type system can't see. That intelligence
is provided by a companion **VS Code extension**, [Twine SugarCube TypeScript
Tools](../tw-sugarcube-ts-tools) — it contributes a language-service plugin
globally, so once installed it gives **completion**, **go-to-definition**, and no
false "property does not exist" errors for members of `setup`, `State.variables`,
`State.temporary`, and `settings`, with no per-project config and no change to how
you write code:

```ts
setup.playerName = (): string => State.variables.name; // in one file
setup.playerName();  // elsewhere: autocompletes, and ctrl+click jumps here
```

Because the extension suppresses those errors, no permissive `.d.ts` augmentation
is needed — the tsconfig above is the whole editor setup.

(A tsconfig `plugins` entry would be the more obvious wiring, but VS Code does not
reliably load a plugin from a project's local `node_modules` — an extension that
contributes the plugin globally is the mechanism that actually works.)

This covers `.ts`/`.js` files. Intelligence *inside* `.twee` passages (e.g.
`<<run setup.foo()>>`) is a separate, larger piece of tooling and isn't included
yet.

## License

See the [LICENSE](LICENSE) file for details. Third-party licenses are in `tweego/licenses/` and `tweego/storyformats/*/LICENSE`.

## Acknowledgments

- Thanks to https://github.com/tmedwards/tweego for the tweego project which this server utilizes.
- Thanks to the creators of various Twine story formats which are supported by this server.
