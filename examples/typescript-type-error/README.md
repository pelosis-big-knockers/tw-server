# typescript-type-error

`types.ts` contains a **type** error (a string assigned to a `number`).

tw-server transpiles per-file with `ts.transpileModule`, which strips types
without type-checking. Type errors therefore pass through silently: the build
succeeds and `const count = "not a number"` ends up in the story.

Only **syntax** errors are caught (see `typescript-syntax-error`). For real
type-checking, run `tsc --noEmit` or rely on your editor — that is intentionally
outside tw-server's per-file transpile step.
