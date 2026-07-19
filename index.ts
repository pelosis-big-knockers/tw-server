#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile, readdirSync, readFileSync, statSync, watch, mkdtempSync, writeFileSync, rmSync } from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { exec } from "child_process";
import path from "path";
import os from "os";
import ts from "typescript";
import { writeLine, write, setLoadingLine, setCurrentLine } from "./console-writer.ts";

const host = "localhost";
const defaultPort = 8080;

const args = process.argv.slice(2);

let port = defaultPort;
if (args.length > 0) {
  const parsedPort = parseInt(args[0]);
  if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
    port = parsedPort;
  } else {
    console.warn(`Invalid port argument: ${args[0]}. Using default port ${defaultPort}.`);
  }
}

// Tweego can't read TypeScript, so .ts files are transpiled to .js into this
// scratch directory and those outputs are handed to tweego instead.
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

  const tsErrors = transpileTsFiles(".");
  if (tsErrors.length > 0) {
    compiling = false;
    for (const message of tsErrors) {
      writeLine(message, "red");
    }

    // A TypeScript syntax error means the bundled script would be broken, so
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

// Transpile every TypeScript source under `dir` into the scratch dir. tweego
// ignores the original .ts files (unknown extension) and instead picks up these
// .js outputs when handed the scratch dir. Per-file transpilation only (no
// type-checking, no bundling) — matching how tweego treats each script as
// standalone source it concatenates into the story. Returns formatted syntax
// diagnostics; an empty array means the transpile succeeded.
function transpileTsFiles(dir: string) {
  // Clear stale outputs so deleted or renamed sources don't linger in the bundle.
  for (const file of readdirSync(tempDir)) {
    rmSync(path.join(tempDir, file), { force: true });
  }

  const errors: string[] = [];
  for (const fullPath of collectTsFiles(dir, [])) {
    const source = readFileSync(fullPath, { encoding: "utf-8" });
    const { outputText, diagnostics } = ts.transpileModule(source, {
      fileName: fullPath,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
    });

    const relPath = path.relative(".", fullPath);
    for (const diagnostic of diagnostics ?? []) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      if (typeof diagnostic.start === "number") {
        const { line, column } = positionToLineColumn(source, diagnostic.start);
        errors.push(`${relPath}(${line},${column}): ${message}`);
      } else {
        errors.push(`${relPath}: ${message}`);
      }
    }

    // Flatten the relative path so nested sources don't collide in the flat scratch dir.
    const outName = relPath.replace(/[\\/]/g, "__").replace(/\.ts$/, ".js");
    writeFileSync(path.join(tempDir, outName), outputText);
  }

  return errors;
}

// Recursively collect TypeScript sources that should be bundled into the story,
// applying the same exclusions as isCompilableFile (skips node_modules/.git,
// .d.ts declarations, and shebang tooling scripts).
function collectTsFiles(dir: string, out: string[]) {
  for (const file of readdirSync(dir)) {
    if (file === "node_modules" || file === ".git") {
      continue;
    }

    const fullPath = path.join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      collectTsFiles(fullPath, out);
    } else if (file.endsWith(".ts") && isCompilableFile(file, fullPath)) {
      out.push(fullPath);
    }
  }

  return out;
}

// Convert a 0-based source offset into a 1-based line/column for diagnostics.
function positionToLineColumn(source: string, position: number) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < position && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

function isShebangScript(fullPath: string) {
  const fd = readFileSync(fullPath, { encoding: "utf-8", flag: "r" }).slice(0, 2);
  return fd === "#!";
}
