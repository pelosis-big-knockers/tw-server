# typescript-in-passage-error

A `<<script>>` payload that isn't valid TypeScript. Stripping types from it
would produce garbage JavaScript, so the build **aborts before tweego runs** and
no `index.html` is produced — the same treatment a broken `.ts` file gets.

The finding is reported against the passage file and the line the author wrote,
not the scratch file the payload was extracted into:

```
story.twee:13:29  error  TS1137  Expression or comma expected.
```

Only grammar errors (TS1xxx) are fatal. Payloads are compiled without the
story's types, so `State` and `setup` are unresolvable in that pass by
construction — treating those as errors would fail every build. Type-checking
passages is the [Twine SugarCube TypeScript
Tools](../../../tw-sugarcube-ts-tools) linter's job.
