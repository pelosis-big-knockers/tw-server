# Examples

Mini story projects that exercise the different cases tw-server handles. Each
subdirectory is a self-contained project (its own `.twee` plus scripts/styles)
with a `README.md` explaining what it demonstrates.

| Example | Demonstrates |
| --- | --- |
| `twee-only` | Baseline `.twee`; whole directory collapses to one tweego argument |
| `with-css` | `.css` bundled as the story stylesheet |
| `with-js` | Plain `.js` bundled as a script, no transpilation |
| `typescript-basic` | `.ts` type-checked and compiled to JS, then bundled |
| `typescript-nested` | `.ts` in a subdirectory; output mirrored under the scratch dir |
| `typescript-syntax-error` | Syntax error fails the build before tweego runs |
| `typescript-type-error` | Type error caught by `tsc` — build fails |
| `typescript-editor` | Editor completion + go-to-definition for `setup.*` (via the companion VS Code extension) |
| `excluded-files` | `.d.ts` (types only) and shebang tooling scripts are not bundled |

## Running

Build every example once and print a summary of what happened:

```sh
node examples/run.mjs
```

Run one example as a live server (serves on http://localhost:8080, watches for
changes — press Ctrl+C to stop), then open the URL to see the compiled story:

```sh
node examples/run.mjs typescript-basic
```

The generated `index.html` in each example directory is a build artifact and is
git-ignored.
