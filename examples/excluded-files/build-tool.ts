#!/usr/bin/env node
// A shebang (#!) script is treated as Node tooling, not story source, so it is
// excluded from the bundle even though it is a .ts file.
console.log("This build tool is not part of the story.");
