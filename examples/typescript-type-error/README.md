# typescript-type-error

`types.ts` contains a **type** error (a string assigned to a `number`).

tw-server compiles TypeScript with the native `tsc`, which runs a full
type-check — so the type error fails the build:

```
types.ts(4,7): error TS2322: Type 'string' is not assignable to type 'number'.
```

The build aborts before tweego runs: no `index.html` is produced, and a running
server keeps the previous good build (see `typescript-syntax-error` for the same
behavior on a syntax error). A plain per-file transpile would have stripped the
type and let this through silently; type-checked compilation catches it.
