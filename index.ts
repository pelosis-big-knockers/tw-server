#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile, readdirSync, statSync, watch } from "fs";
import { WebSocketServer } from "ws";
import { exec } from "child_process";
import path from "path";
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
  if (!compiling && filename && isCompilableFile(filename)) {
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

const recompileFilesAndReload = () => {
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
};

const setContentType = (res: ServerResponse<IncomingMessage>, path: string) => {
  if (path.endsWith(".html")) {
    res.setHeader("Content-Type", "text/html");
  } else if (path.endsWith(".css")) {
    res.setHeader("Content-Type", "text/css");
  } else if (path.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript");
  }
};

const injectReloadWsScriptToHTML = (html: string) => {
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
};

function compileFiles(callback: (error: boolean) => void) {
  compiling = true;
  setLoadingLine(() => ({
    complete: !compiling,
    message: "Compiling Twee files...",
  }));

  const exePath = path.join(import.meta.dirname, "tweego", "tweego");
  exec(`"${exePath}" -o index.html ${getCompilableFilePaths(".").join(" ")}`, (error, stdout, stderr) => {
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
    } else if (isCompilableFile(file)) {
      paths.push(quotedFullPath);
    } else {
      allCompilable = false;
    }
  }

  return allCompilable ? [`"${dir}"`] : paths;
}

// TODO: Make this configurable? Technically Tweego can embed images and other assets too.
function isCompilableFile(filename: string) {
  return (
    filename.endsWith(".twee") ||
    filename.endsWith(".tw") ||
    filename.endsWith(".tw2") ||
    filename.endsWith(".twee2") ||
    filename.endsWith(".js") ||
    filename.endsWith(".css")
  );
}
