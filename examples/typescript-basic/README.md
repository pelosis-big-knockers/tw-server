# typescript-basic

A valid `.ts` file. tw-server transpiles it to JavaScript in a scratch dir
(the `interface` and the `: string` / `: Player` annotations are stripped), and
hands that scratch dir to tweego alongside the sources.

tweego ignores the original `logic.ts` (unknown extension) and bundles the
transpiled JavaScript, so `setup.playerName` ends up in the story exactly once.
