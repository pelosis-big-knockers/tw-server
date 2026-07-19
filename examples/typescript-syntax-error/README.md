# typescript-syntax-error

`broken.ts` has a syntax error. `ts.transpileModule` reports it as a diagnostic,
and tw-server prints it in `file(line,column): message` form, e.g.:

```
broken.ts(4,24): Expression expected.
```

The build then **aborts before tweego runs**, so no (broken) `index.html` is
produced. In a running server the previous good build is left in place and no
reload is triggered.
