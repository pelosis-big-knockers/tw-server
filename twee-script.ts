// Type stripping for `<<script>>` payloads in Twee passages.
//
// SugarCube hands a `<<script>>` payload straight to `eval`, so whatever sits
// between the tags reaches the browser verbatim — a type annotation in there is
// a syntax error at runtime. The "Twine SugarCube TypeScript Tools" extension
// analyzes those payloads as TypeScript; this is the other half of that deal.
// Each payload is compiled to JavaScript, spliced back into a *copy* of the
// passage file in the scratch dir, and tweego is handed the copy instead of the
// original — the same arrangement `.ts` sources already get.
//
// `<<script TwineScript>>` is left alone: SugarCube desugars that payload itself
// (`$x` -> `State.variables.x`), so it isn't JavaScript to begin with and tsc
// would only mangle it.
import { exec } from "child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { createRequire } from "module";
import os from "os";
import path from "path";

const TWEE_EXTENSIONS = [".twee", ".tw", ".tw2", ".twee2"];

// `<<script>>`, with the optional language argument SugarCube accepts. The
// negative lookahead keeps `<<scriptish>>` from matching.
const SCRIPT_OPEN_RE = /<<\s*script(?![A-Za-z0-9_])([^>]*)>>/g;
// SugarCube closes a container macro with either spelling.
const SCRIPT_CLOSE_RE = /<<\s*(?:\/script|endscript)\s*>>/;
// A passage header ends the passage's text, so it also ends an unclosed payload.
const PASSAGE_HEADER_RE = /(^|\n)::/;

// tsc is always strict as of TypeScript 7, so it prepends a "use strict"
// directive to every script-kind emit. A payload is `eval`ed, where that
// directive would make the *author's* code strict — turning an implicit global
// or a duplicate parameter into a runtime throw in a passage that worked
// before. Stripping it keeps the payload running exactly as it always has.
const USE_STRICT_RE = /^\s*(?:"use strict"|'use strict');?\r?\n/;

interface Payload {
  /** Offset of the payload's `<<script ...>>` opening tag. */
  openStart: number;
  /** Offset just past the opening tag. */
  openEnd: number;
  /** Offsets of the payload text itself, between the tags. */
  bodyStart: number;
  bodyEnd: number;
  /** The macro's language argument, lowercased; "" when there is none. */
  lang: string;
  /** 1-based line of `bodyStart` in the passage file, for diagnostics. */
  bodyLine: number;
}

export interface StripResult {
  /** Absolute paths of the passage files whose stripped copy tweego must use. */
  rewritten: Set<string>;
  /** tsc's diagnostics when a payload isn't valid TypeScript, else null. */
  error: string | null;
}

// Scratch space for the extracted payloads. Kept OUT of the directory handed to
// tweego: a `.js` file in there would be bundled into the story as its own
// script, on top of the payload it was extracted from.
const scratchDir = mkdtempSync(path.join(os.tmpdir(), "tw-server-scripts-"));
process.on("exit", () => rmSync(scratchDir, { recursive: true, force: true }));

/**
 * Compile the `<<script>>` payloads of every passage file under `dir` to
 * JavaScript, writing the rewritten passage files into `outDir`.
 *
 * Calls back with the set of source files that were rewritten — tweego must be
 * given the copies instead of these — and tsc's output if a payload didn't
 * parse. Passage files without a payload are left alone entirely, so a story
 * that doesn't use `<<script>>` pays nothing for this.
 */
export function stripScriptTypes(
  dir: string,
  outDir: string,
  callback: (result: StripResult) => void
) {
  const files = collectTweeSources(dir, []);
  const work: { file: string; text: string; payloads: Payload[] }[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    const payloads = findPayloads(text).filter((p) => p.lang !== "twinescript");
    if (payloads.length > 0) {
      work.push({ file, text, payloads });
    }
  }

  if (work.length === 0) {
    callback({ rewritten: new Set(), error: null });
    return;
  }

  // One .ts file per payload rather than one per passage file: SugarCube evals
  // each payload in its own scope, so two of them may each declare `const x`,
  // and only separate files reproduce that.
  const srcDir = path.join(scratchDir, "src");
  const emitDir = path.join(scratchDir, "out");
  rmSync(srcDir, { recursive: true, force: true });
  rmSync(emitDir, { recursive: true, force: true });
  mkdirSync(srcDir, { recursive: true });

  const units: { file: string; payload: Payload; name: string }[] = [];
  for (const entry of work) {
    for (const payload of entry.payloads) {
      const name = `s${units.length}`;
      writeFileSync(path.join(srcDir, `${name}.ts`), entry.text.slice(payload.bodyStart, payload.bodyEnd));
      units.push({ file: entry.file, payload, name });
    }
  }

  transpile(srcDir, emitDir, units.map((u) => u.name), (diagnostics) => {
    // Only grammar errors (TS1xxx) are fatal. This pass deliberately compiles
    // each payload without the story's types, so it has no way to tell a real
    // type error from `setup` merely being unresolvable here — type-checking
    // passages is the linter's and the editor's job, and they map findings back
    // onto the .twee properly. A payload that isn't valid TypeScript, though,
    // means the emitted JavaScript is garbage, and that has to stop the build.
    const fatal = diagnostics.filter((d) => /^TS1\d{3}$/.test(d.code));
    if (fatal.length > 0) {
      const byName = new Map(units.map((u) => [u.name, u]));
      const lines = fatal.map((d) => {
        const unit = byName.get(d.name);
        if (!unit) return `${d.code}: ${d.message}`;
        // The payload file IS the payload text, so its lines map onto the
        // passage file by a fixed offset.
        const line = unit.payload.bodyLine + d.line - 1;
        return `${unit.file}:${line}:${d.column}  error  ${d.code}  ${d.message}`;
      });
      callback({ rewritten: new Set(), error: lines.join("\n") });
      return;
    }

    const emitted = new Map<string, string>();
    for (const unit of units) {
      const out = path.join(emitDir, `${unit.name}.js`);
      try {
        emitted.set(unit.name, readFileSync(out, "utf-8").replace(USE_STRICT_RE, ""));
      } catch {
        // No output for this payload: leave it as the author wrote it rather
        // than dropping the code on the floor.
      }
    }

    const rewritten = new Set<string>();
    let unitIndex = 0;
    for (const entry of work) {
      let out = "";
      let cursor = 0;
      for (const payload of entry.payloads) {
        const name = units[unitIndex++].name;
        const js = emitted.get(name);
        if (js === undefined) continue;
        out += entry.text.slice(cursor, payload.openStart);
        // A `TypeScript` language argument is ours, not SugarCube's — it would
        // be an "unknown language" error at runtime, so the stripped copy gets
        // the plain tag it is now.
        out += payload.lang === "typescript" ? "<<script>>" : entry.text.slice(payload.openStart, payload.openEnd);
        out += `\n${js.trim()}\n`;
        cursor = payload.bodyEnd;
      }
      if (!out) continue;
      out += entry.text.slice(cursor);

      const copy = path.join(outDir, path.relative(dir, entry.file));
      mkdirSync(path.dirname(copy), { recursive: true });
      writeFileSync(copy, out);
      rewritten.add(path.resolve(entry.file));
    }

    callback({ rewritten, error: null });
  });
}

/** Every `<<script>>` payload in a passage file, in source order. */
function findPayloads(text: string): Payload[] {
  const out: Payload[] = [];
  SCRIPT_OPEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SCRIPT_OPEN_RE.exec(text)) !== null) {
    const openEnd = match.index + match[0].length;
    const rest = text.slice(openEnd);
    const close = SCRIPT_CLOSE_RE.exec(rest);
    // An unclosed payload, or one whose closing tag is in another passage, is
    // markup the author is still writing. Leave it be — the build will surface
    // it as the SugarCube error it is.
    if (!close || PASSAGE_HEADER_RE.test(rest.slice(0, close.index))) {
      continue;
    }

    const bodyStart = openEnd;
    const bodyEnd = openEnd + close.index;
    if (text.slice(bodyStart, bodyEnd).trim()) {
      out.push({
        openStart: match.index,
        openEnd,
        bodyStart,
        bodyEnd,
        lang: match[1].trim().toLowerCase(),
        bodyLine: countLines(text, bodyStart),
      });
    }

    SCRIPT_OPEN_RE.lastIndex = bodyEnd + close[0].length;
  }

  return out;
}

function countLines(text: string, offset: number) {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === "\n") line++;
  }

  return line;
}

interface Diagnostic {
  name: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

// Compile the extracted payloads to JavaScript. `--noEmitOnError` is
// deliberately absent: the payloads are compiled without the story's types, so
// unresolved names are expected and must not stop the emit.
function transpile(srcDir: string, outDir: string, names: string[], callback: (diagnostics: Diagnostic[]) => void) {
  const args = [
    "--ignoreConfig",
    "--pretty", "false",
    "--rootDir", `"${srcDir}"`,
    "--outDir", `"${outDir}"`,
    "--target", "ES2020",
    "--module", "ESNext",
    "--skipLibCheck",
    ...names.map((name) => `"${path.join(srcDir, `${name}.ts`)}"`),
  ];

  const responsePath = path.join(scratchDir, "__tsc-args.rsp");
  writeFileSync(responsePath, args.join("\n"));

  const typescriptDir = path.dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
  const tscBin = path.join(typescriptDir, "bin", "tsc");
  exec(`node "${tscBin}" @"${responsePath}"`, (_error, stdout) => {
    callback(parseDiagnostics(stdout));
  });
}

// `--pretty false` gives one diagnostic per line: `path(line,col): error TSxxxx: message`.
const DIAGNOSTIC_RE = /^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function parseDiagnostics(stdout: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = DIAGNOSTIC_RE.exec(line.trim());
    if (match) {
      out.push({
        name: path.basename(match[1], ".ts"),
        line: Number(match[2]),
        column: Number(match[3]),
        code: match[4],
        message: match[5],
      });
    }
  }

  return out;
}

function collectTweeSources(dir: string, out: string[]) {
  for (const file of readdirSync(dir)) {
    if (file === "node_modules" || file === ".git") {
      continue;
    }

    const fullPath = path.join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      collectTweeSources(fullPath, out);
    } else if (TWEE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
      out.push(fullPath);
    }
  }

  return out;
}
