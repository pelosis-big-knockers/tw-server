#!/usr/bin/env node

import { createServer } from 'http';
import { readFile, readdirSync, statSync, watch } from 'fs';
import { WebSocketServer } from 'ws';
import { exec } from 'child_process';
import path from 'path';
import { writeLine, write, setLoadingLine, setCheckpoint, setCurrentLine, clearToLastCheckpoint } from './console-writer.js';

const host = 'localhost';
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

writeLine('Starting server...\n');
const httpServer = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  let path = url.pathname;
  if (path === '/') {
    path = '/index.html';
  }
  
  readFile(`.${path}`, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('File not found');
    } else {
      res.statusCode = 200;
      setContentType(res, path);
      if (path.endsWith('.html')) {
        data = injectReloadWsScriptToHTML(data.toString());
      }

      res.end(data);
    }
  });
});

const wsServer = new WebSocketServer({ server: httpServer });

httpServer.listen(port, host, () => {
  write(`Server is listening on `);
  write(`http://${host}:${port}`, 'cyan');
  writeLine(`\n\nPress Ctrl+C to stop the server.\n`);
  setCheckpoint();
});

let compiling = false;
const { promise, resolve } = Promise.withResolvers();

compileFiles(() => {
  resolve();
});

await promise;

watch('.', { recursive: true }, (_eventType, filename) => {
  if (!compiling && isCompilableFile(filename)) {
    clearToLastCheckpoint();
    writeLine(`File changed: ${filename}. Compiling...`);
    recompileFilesAndReload();
  }
});

const recompileFilesAndReload = () => {
  compileFiles((error) => {
    if (error || !wsServer.clients.size) {
      return;
    }

    setCurrentLine('Recompilation complete. Notifying clients to reload.');
    wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('reload');
      }
    });
  });
};

const setContentType = (res, path) => {
  if (path.endsWith('.html')) {
    res.setHeader('Content-Type', 'text/html');
  } else if (path.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
  } else if (path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
};

const injectReloadWsScriptToHTML = (html) => {
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
  return html.replace('</body>', `${script}</body>`);
}

function compileFiles(callback) {
  compiling = true;
  setLoadingLine(() => ({
    complete: !compiling,
    message: 'Compiling Twee files...'
  }));

  exec(`tweego -o index.html ${getCompilableFilePaths().join(' ')}`, (error, stdout, stderr) => {
      compiling = false;
      if (error && !stderr) {
        console.error(error);
      }

      if (stderr) {
        console.error(stderr);
      }

      if (stdout) {
        console.log(stdout);
      }

      if (callback) {
        callback(!!error);
      }
    });
};

function getCompilableFilePaths() {
  const paths = [];

  const walk = (dir) => {
    const files = readdirSync(dir);
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (isCompilableFile(file)) {
        paths.push(fullPath);
      }
    });
  };

  walk('.');

  return paths;
}

function isCompilableFile(filename) {
  return filename.endsWith('.twee')
    || filename.endsWith('.tw')
    || filename.endsWith('.tw2')
    || filename.endsWith('.twee2')
    || filename.endsWith('.js')
    || filename.endsWith('.css');
}