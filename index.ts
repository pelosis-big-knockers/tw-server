#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile, readdirSync, readFileSync, statSync, watch, mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { exec } from "child_process";
import { createRequire } from "module";
import path from "path";
import os from "os";
import { writeLine, write, setLoadingLine, setCurrentLine } from "./console-writer.ts";

const host = "localhost";
const defaultPort = 8080;

const args = process.argv.slice(2);

if (args[0] === "init") {
  initProject();
  process.exit(0);
}

let port = defaultPort;
if (args.length > 0) {
  const parsedPort = parseInt(args[0]);
  if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
    port = parsedPort;
  } else {
    console.warn(`Invalid port argument: ${args[0]}. Using default port ${defaultPort}.`);
  }
}

// Tweego can't read TypeScript, so .ts files are type-checked and compiled to
// .js by the native tsc into this scratch directory, and those outputs are
// handed to tweego instead.
const tempDir = mkdtempSync(path.join(os.tmpdir(), "tw-server-"));
process.on("exit", () => rmSync(tempDir, { recursive: true, force: true }));
process.on("SIGINT", () => process.exit(0));

const httpServer = createServer((req, res) => {
  let path = req.url ?? "/";
  if (path === "/") {
    path = "/index.html";
  }

  readFile(`.${path}`, (err, data) => {
    let content: string | Buffer = data;
    if (err) {
      res.statusCode = 404;
      res.end("File not found");
    } else {
      res.statusCode = 200;
      setContentType(res, path);
      if (path.endsWith(".html")) {
        content = injectReloadWsScriptToHTML(content.toString());
      }

      res.end(content);
    }
  });
});

const wsServer = new WebSocketServer({ server: httpServer });

httpServer.listen(port, host, () => {
  write(`\nServer is listening on `);
  write(`http://${host}:${port}`, ["cyan", "underline"]);
  writeLine(`\nPress Ctrl+C to stop the server.\n`);
});

let compiling = false;
let recompileQueue = new Set<string>();
const { promise, resolve } = Promise.withResolvers<void>();

compileFiles(() => {
  resolve();
});

await promise;

setCurrentLine("Watching for file changes...\n");

watch(".", { recursive: true }, (_eventType, filename) => {
  if (!compiling && filename && isCompilableFile(filename, filename)) {
    if (recompileQueue.size == 0) {
      setTimeout(() => {
        recompileQueue.clear();
        recompileFilesAndReload();
      }, 100);
    }

    const fileCountBefore = recompileQueue.size;
    recompileQueue.add(filename);
    if (recompileQueue.size > fileCountBefore) {
      // Only log if this is a new file added to the queue
      write("File changed: ");
      writeLine(filename, ["yellow", "underline"]);
    }
  }
});

function recompileFilesAndReload() {
  compileFiles((error) => {
    if (error || !wsServer.clients.size) {
      setCurrentLine("Recompilation complete.\n");
      return;
    }

    setCurrentLine("Recompilation complete. Notifying clients to reload.\n");
    wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("reload");
      }
    });
  });
}

function setContentType(res: ServerResponse<IncomingMessage>, path: string) {
  if (path.endsWith(".html")) {
    res.setHeader("Content-Type", "text/html");
  } else if (path.endsWith(".css")) {
    res.setHeader("Content-Type", "text/css");
  } else if (path.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript");
  }
}

function injectReloadWsScriptToHTML(html: string) {
  const script = `<script>
    function createWebSocket() {
      const socket = new WebSocket('ws://' + location.host);
      socket.addEventListener('message', function (event) {
        if (event.data === 'reload') {
          location.reload();
        }
      });

      socket.addEventListener('close', function () {
        console.log('WebSocket closed. Reconnecting in 1 second...');
        setTimeout(createWebSocket, 1000);
      });
    }

    createWebSocket();
  </script>`;

  return html.replace("</body>", `${script}</body>`);
}

function compileFiles(callback: (error: boolean) => void) {
  compiling = true;
  setLoadingLine(() => ({
    complete: !compiling,
    message: "Compiling Twee files...",
  }));

  compileTypeScript((tsError) => {
    if (tsError) {
      compiling = false;
      writeLine(tsError, "red");

      // A TypeScript error means the bundled script would be broken or wrong, so
      // abort before tweego runs rather than serving a broken story.
      if (callback) {
        callback(true);
      }

      return;
    }

    const exePath = path.join(import.meta.dirname, "tweego", "tweego");
    const sources = getCompilableFilePaths(".").join(" ");
    exec(`"${exePath}" -o index.html ${sources} "${tempDir}"`, (error, stdout, stderr) => {
      compiling = false;
      if (stderr) {
        writeLine(stderr, "red");
      }

      if (error) {
        writeLine(error.message, "red");
      }

      if (stdout) {
        writeLine(stdout);
      }

      if (callback) {
        callback(!!(error || stderr));
      }
    });
  });
}

function getCompilableFilePaths(dir: string) {
  const paths: string[] = [];
  const files = readdirSync(dir);
  let allCompilable = true;

  for (const file of files) {
    // TODO: Add configurable exclude paths or patterns?
    if (file === "node_modules" || file === ".git") {
      continue;
    }

    const fullPath = path.join(dir, file);
    const quotedFullPath = `"${fullPath}"`;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const result = getCompilableFilePaths(fullPath);
      if (result.length > 0 && result[0] !== quotedFullPath) {
        allCompilable = false;
      }

      paths.push(...result);
    } else if (isCompilableFile(file, fullPath)) {
      // tweego ignores .ts files (unknown extension); their transpiled .js
      // outputs are supplied separately from the scratch dir. Everything else
      // is handed to tweego directly, and a directory of only compilable files
      // can still collapse to a single directory argument.
      paths.push(quotedFullPath);
    } else {
      allCompilable = false;
    }
  }

  return allCompilable ? [`"${dir}"`] : paths;
}

// TODO: Make this configurable? Technically Tweego can embed images and other assets too.
function isCompilableFile(filename: string, fullPath: string) {
  if ((filename.endsWith(".js") || filename.endsWith(".ts")) && !filename.endsWith(".d.ts") && isShebangScript(fullPath)) {
    // Node CLI scripts (e.g. build/lint tooling) aren't meant to be bundled into the story.
    return false;
  }

  return (
    filename.endsWith(".twee") ||
    filename.endsWith(".tw") ||
    filename.endsWith(".tw2") ||
    filename.endsWith(".twee2") ||
    filename.endsWith(".js") ||
    (filename.endsWith(".ts") && !filename.endsWith(".d.ts")) ||
    filename.endsWith(".css")
  );
}

// Type-check and compile the story's TypeScript with the native tsc, emitting
// JavaScript into the scratch dir. tweego ignores the original .ts files
// (unknown extension) and bundles these outputs instead. Unlike a plain
// transpile this runs a full type-check, so type errors fail the build the same
// as syntax errors. Calls back with tsc's diagnostic output on failure, or null
// on success (including when there is no TypeScript to compile).
function compileTypeScript(callback: (errorOutput: string | null) => void) {
  // Clear stale outputs so deleted or renamed sources don't linger in the bundle.
  for (const file of readdirSync(tempDir)) {
    rmSync(path.join(tempDir, file), { recursive: true, force: true });
  }

  const sources = collectTsSources(".", []);
  if (sources.length === 0) {
    callback(null);
    return;
  }

  // rootDir pins emit paths to the project tree so outputs mirror it under the
  // scratch dir (no collisions), and the shim .d.ts sits outside rootDir where
  // tsc accepts it as ambient types without trying to emit it.
  const args = [
    // Drive the compile with these options, not any tsconfig.json the project
    // keeps for its editor: tsc otherwise refuses to run with both a config and
    // an explicit file list (TS5112).
    "--ignoreConfig",
    "--rootDir", ".",
    "--outDir", `"${tempDir}"`,
    "--target", "ES2020",
    "--module", "ESNext",
    "--skipLibCheck",
    "--noEmitOnError",
    ...sources.map((file) => `"${file}"`),
  ];

  // Supply SugarCube's types via tw-server's bundled augmentation (real types plus
  // permissive setup) through a file whose `import "twine-sugarcube"` resolves
  // against tw-server's own node_modules regardless of the project's cwd. It's
  // always included: installing tw-server hoists @types/twine-sugarcube, so the
  // mere presence of @types can't tell whether the project configured its own
  // types. A project's own augmentation (e.g. from `tw-server init`) merges with
  // this without conflict.
  const augmentation = path.join(import.meta.dirname, "types", "sugarcube-augmentation.d.ts");
  args.push(`"${augmentation}"`);

  // Pass arguments via a response file so large projects don't exceed the
  // command-line length limit and paths with spaces stay intact.
  const responsePath = path.join(tempDir, "__tsc-args.rsp");
  writeFileSync(responsePath, args.join("\n"));

  // Resolve tsc through node's module resolution rather than tw-server's own
  // node_modules/.bin: when tw-server is installed as a package its dependencies
  // are hoisted and that directory doesn't exist, whereas resolving the package
  // and running its entry with node works whether tw-server is linked or installed.
  const typescriptDir = path.dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
  const tscBin = path.join(typescriptDir, "bin", "tsc");
  exec(`node "${tscBin}" @"${responsePath}"`, (error, stdout) => {
    // tsc writes diagnostics to stdout and exits non-zero when it refuses to emit.
    callback(error ? stdout.trim() || error.message : null);
  });
}

// Recursively collect the TypeScript sources to hand to tsc: every .ts and .d.ts
// except shebang tooling scripts (build/lint CLIs that aren't story code) and
// node_modules/.git. tsc type-checks all of them and emits JavaScript for the
// .ts files; .d.ts declarations contribute types only.
function collectTsSources(dir: string, out: string[]) {
  for (const file of readdirSync(dir)) {
    if (file === "node_modules" || file === ".git") {
      continue;
    }

    const fullPath = path.join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      collectTsSources(fullPath, out);
    } else if (file.endsWith(".ts") && !isShebangScript(fullPath)) {
      out.push(fullPath);
    }
  }

  return out;
}

function isShebangScript(fullPath: string) {
  const fd = readFileSync(fullPath, { encoding: "utf-8", flag: "r" }).slice(0, 2);
  return fd === "#!";
}

// `tw-server init`: scaffold the editor-side TypeScript setup into the current
// project. tw-server type-checks the build with its bundled SugarCube types, but
// the editor (tsserver) reads the project's own tsconfig, so a story needs these
// two files for `setup`, `State`, `$`, etc. to resolve while editing.
function initProject() {
  const tsconfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"]
}
`;

  const augmentation = `// SugarCube's runtime globals for your editor. \`setup\`, story variables, and
// settings are relaxed to permissive index signatures so ad-hoc properties
// type-check without being declared first; the rest of the API stays fully typed.
// Replace these with specific declarations as your story grows.
import "twine-sugarcube";

declare module "twine-sugarcube" {
  interface SugarCubeSetupObject {
    [key: string]: any;
  }

  interface SugarCubeStoryVariables {
    [key: string]: any;
  }

  interface SugarCubeSettingVariables {
    [key: string]: any;
  }
}
`;

  for (const [name, content] of Object.entries({ "tsconfig.json": tsconfig, "sugarcube.d.ts": augmentation })) {
    if (existsSync(name)) {
      write("Skipped ");
      writeLine(`${name} (already exists)`, "yellow");
    } else {
      writeFileSync(name, content);
      write("Created ");
      writeLine(name, ["green", "underline"]);
    }
  }

  writeLine("\nEditor TypeScript support is set up. Open a .ts file to check that SugarCube's globals resolve.");
  if (!sugarCubeTypesResolvable()) {
    writeLine(
      "\nNote: @types/twine-sugarcube can't be resolved from this project, so the editor can't load the types yet.\n" +
        "Install tw-server as a project dependency (npm install -D tw-server) to bring its bundled types here.",
      "yellow"
    );
  }
}

// Resolve @types/twine-sugarcube the way node (and the editor) would from this
// project, walking up node_modules — not just checking the immediate ./node_modules.
function sugarCubeTypesResolvable() {
  try {
    createRequire(path.join(process.cwd(), "index.js")).resolve("@types/twine-sugarcube/package.json");
    return true;
  } catch {
    return false;
  }
}
