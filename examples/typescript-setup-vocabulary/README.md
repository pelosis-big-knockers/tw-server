# typescript-setup-vocabulary

Regression fixture: a story that publishes a vocabulary on `setup` and derives a
type from it. **This example must build.**

```ts
setup.COLORS = ["red", "green", "blue"] as const;   // constants.ts
type Color = (typeof setup.COLORS)[number];         // types.d.ts
```

## What it guards

The build type-checks with `strict` on, deliberately. The bug was that its view
of the containers was `[key: string]: any`, so `setup.COLORS` was `any`, `Color`
widened to `any`, and `noImplicitAny` then rejected everything downstream:
TS7053 on `palette[color]`, TS7006 on both `reduce` parameters. Meanwhile the
editor extension reported the very same code as correct, because it recovers
member types from their assignments.

A build that rejects what the editor blesses is the worst failure of the two —
the author has no way to tell which one is lying. So the fix was not to relax
`strict`; it was to stop the build guessing. `setup-types.ts` now recovers the
same types from the same code, via the shared `tw-sugarcube-analyzer`, and the
generated declaration says:

```ts
COLORS: readonly ["red", "green", "blue"];
```

`usage.ts` keeps both failing patterns (`for…of` + index, and `reduce`), plus a
control pair derived from a module-level const (`SHAPES`). The control always
compiled — it never round-trips through `setup` — and that is what isolates the
cause to how the build types the container rather than to the code pattern.

## The other half

Recovery is not just about silencing false errors; it is what lets the build
catch real ones. With the members typed, these now fail the build, and could not
have before:

```ts
setup.attack("nope");        // TS2345: string is not assignable to number
const c: Color = "purple";   // TS2322: not "blue" | "green" | "red"
```

`examples/typescript-type-error` still aborts on an ordinary TS2322, confirming
none of this weakened the check.
