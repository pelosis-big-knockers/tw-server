// Recovering real types for SugarCube's author-populated containers, for the
// build's type-check.
//
// `setup.foo = ...`, `State.variables.hp = ...` and friends create members that
// TypeScript can't see, because the interfaces in @types/twine-sugarcube ship
// empty. tw-server used to hand tsc a static augmentation that gave those
// interfaces a bare `[key: string]: any`, which kept the build from erroring on
// every member — at the cost of typing all of them `any`.
//
// That was not merely weak, it was wrong in both directions:
//
//   * it missed real mistakes (`setup.attack("nope")` type-checked fine), and
//   * with `strict` on it INVENTED errors. A story that reads a vocabulary back
//     off the container —
//
//         setup.COLORS = ["red", "green", "blue"] as const;
//         type Color = (typeof setup.COLORS)[number];
//         setup.COLORS.reduce((sum, c) => sum + palette[c], 0);
//
//     — gets `Color = any` from the index signature, and `noImplicitAny` then
//     rejects the reduce callback and the indexing. The editor extension reports
//     that same code as perfectly correct, because it recovers member types from
//     their assignments. The build refusing what the editor blesses is the worst
//     of the two failures: the author has no way to tell which one is lying.
//
// So the build now recovers the same types the editor does, from the same code:
// tw-sugarcube-analyzer is the shared core behind the language-service plugin,
// `tw-sugarcube-lint`, and this.
//
// The analyzer needs the in-process compiler API (`createProgram`), which the
// native 7.x line doesn't expose — hence `typescript-api`, an alias for the 6.x
// JS API line, alongside the 7.x used to actually compile. The two only have to
// agree on what a type PRINTS as, since all that crosses between them is a .d.ts.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

// Preferably written under the project's node_modules: it is generated, it is
// already gitignored there, and it keeps the author's directory listing free of
// a file they must not edit. A project with no node_modules of its own gets the
// same directory at the project root instead — the file still has to sit inside
// the tree to resolve (see below), and a project can perfectly well resolve
// @types/twine-sugarcube from a parent directory.
//
// Dot-prefixed in both cases, which is what keeps it out of the EDITOR's way: a
// tsconfig `include` of `**/*.ts` skips dotted directories, so a copy left behind
// by a hard kill (Windows TerminateProcess runs no exit handler) is inert rather
// than a stale second augmentation fighting the extension's in-memory one.
const GENERATED_DIR = ".tw-server";
// Deliberately NOT the extension's `__sugarcube-generated__.d.ts`. The
// language-service plugin serves a file by that exact name from the project
// root, out of memory — a real file of ours sitting at the same path (which the
// root fallback below would produce) would collide with it in the editor.
const GENERATED_FILE = "__tw-server-generated__.d.ts";

export type SetupTypes = {
  /** Absolute path of the generated .d.ts, or null when it couldn't be used. */
  path: string | null;
  /** Why recovery was skipped, for the log. Null when it succeeded. */
  skipped: string | null;
};

// The analyzer and its TypeScript are loaded lazily and defensively: a story
// build must not die because an optional analysis dependency is missing or
// broken. Every failure here degrades to the static augmentation, which is
// exactly the behaviour tw-server had before.
function loadAnalysis() {
  const ts = require("typescript-api");
  if (typeof ts.createProgram !== "function") {
    throw new Error("typescript-api has no in-process compiler API");
  }

  const { collectProjections, buildAugmentation } = require("tw-sugarcube-analyzer/augmentation.js");
  return { ts, collectProjections, buildAugmentation };
}

/**
 * Generate the augmentation for `projectDir` and return the file to hand tsc.
 *
 * @param projectDir  the story project (tsc's cwd)
 * @param sources     the .ts/.d.ts files the build already collected
 */
export function generateSetupTypes(projectDir: string, sources: string[]): SetupTypes {
  const skip = (reason: string): SetupTypes => ({ path: null, skipped: reason });

  let analysis;
  try {
    analysis = loadAnalysis();
  } catch (error) {
    return skip(`the analyzer could not be loaded (${(error as Error).message})`);
  }

  const { ts, collectProjections, buildAugmentation } = analysis;
  // Absolute, always. The caller passes "." (tsc's cwd), and a containing file
  // of "__tw-server-generated__.d.ts" has no directory component at all — module
  // resolution then walks up from nowhere, finds no node_modules, and recovery
  // gets skipped for every project on earth.
  const root = path.resolve(projectDir);
  const projectModules = path.join(root, "node_modules");
  const outDir = path.join(existsSync(projectModules) ? projectModules : root, GENERATED_DIR);
  const augPath = path.join(outDir, GENERATED_FILE).replace(/\\/g, "/");

  // Mirror the options the build itself compiles under, so recovery sees the
  // same program the check will.
  const options = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    // Explicit, and load-bearing. `module: ESNext` alone leaves the resolver on
    // Classic, which never looks in node_modules — so `import "twine-sugarcube"`
    // finds nothing, the augmentation resolves to no module, and recovery is
    // (correctly, but needlessly) skipped for every project. Bundler is what
    // `tw-server init` writes into the project's own tsconfig.
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
  };

  // If `twine-sugarcube` doesn't resolve from where the generated file will sit,
  // its `declare module` block augments NOTHING. That doesn't fail loudly — it
  // silently leaves every container member undeclared, so the build reports
  // "property does not exist" on every single one. Check before committing to it.
  const resolved = ts.resolveModuleName("twine-sugarcube", augPath, options, ts.sys);
  if (!resolved.resolvedModule) {
    return skip("'twine-sugarcube' does not resolve from the project's node_modules");
  }

  try {
    mkdirSync(outDir, { recursive: true });
    const projections = collectProjections(root);
    const { text, converged } = buildAugmentation(ts, {
      rootNames: sources,
      options,
      augPath,
      projections,
      strict: true,
      // Never close the containers here. Typo detection is opt-in even in the
      // editor, because a member created any way the analyzer can't see — a
      // computed `setup[name] =`, a plain .js file, the Setting API — would be
      // reported as nonexistent. Turning it on for everyone's build would fail
      // stories that are entirely correct.
      typoDetection: false,
    });
    writeFileSync(augPath, text);
    return {
      path: augPath,
      skipped: converged ? null : "recovered member types did not settle; some may be typed 'any'",
    };
  } catch (error) {
    return skip(`recovery failed (${(error as Error).message})`);
  }
}

/** Drop whatever was generated, from either location. Safe when nothing was. */
export function cleanupSetupTypes(projectDir: string) {
  const root = path.resolve(projectDir);
  for (const dir of [path.join(root, "node_modules", GENERATED_DIR), path.join(root, GENERATED_DIR)]) {
    rmSync(dir, { recursive: true, force: true });
  }
}
