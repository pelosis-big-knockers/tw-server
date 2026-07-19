# typescript-nested

A `.ts` file in a subdirectory (`scripts/game.ts`).

The transpiled output is written to the flat scratch dir with a path-flattened
name (`scripts__game.js`) so nested sources can't collide. Directory collapse
still applies — the top-level folder is handed to tweego as a single argument,
and tweego simply ignores the `.ts` it finds inside.
