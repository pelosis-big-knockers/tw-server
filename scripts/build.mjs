// Builds tw-server for publishing: compiles the TypeScript sources to dist/ and
// copies the runtime assets (tweego, bundled types) alongside the output so the
// package runs from plain JavaScript. This matters because Node refuses to strip
// types from files under node_modules, so an installed package must ship JS.
import { execFileSync } from "child_process";
import { cpSync, rmSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const tscBin = path.join(path.dirname(require.resolve("typescript/package.json")), "bin", "tsc");

rmSync(path.join(root, "dist"), { recursive: true, force: true });
execFileSync(process.execPath, [tscBin, "-p", path.join(root, "tsconfig.build.json")], { stdio: "inherit" });

// Assets the built entry resolves via import.meta.dirname must sit next to it.
for (const asset of ["tweego", "types"]) {
  cpSync(path.join(root, asset), path.join(root, "dist", asset), { recursive: true });
}

console.log("Build complete: dist/");
