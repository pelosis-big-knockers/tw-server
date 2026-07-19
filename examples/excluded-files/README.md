# excluded-files

Shows the two exclusions in `isCompilableFile`:

- **`game.d.ts`** — a declaration file. Excluded (`.d.ts` carries only types).
- **`build-tool.ts`** — starts with a `#!` shebang, so it is treated as Node
  tooling (build/lint scripts) rather than story source. Excluded.

Only `real.ts` is transpiled and bundled, so the story contains
`setup.included` but neither `NEVER_BUNDLED` nor the build tool's `console.log`.
