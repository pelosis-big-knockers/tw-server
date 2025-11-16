#!/usr/bin/env node

import { createServer } from 'http';
import { readFile, watch } from 'fs';
import { WebSocketServer } from 'ws';
import { exec } from 'child_process';

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

let compiling = true;
const { promise, resolve } = Promise.withResolvers();
console.log('Compiling Twee files for the first time...');

compileTweeFiles(() => {
  console.log('Starting server...');
  resolve();
});

await promise;

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
        data = injectScriptToHTML(data.toString());
      }
      res.end(data);
    }
  });
});

const wsServer = new WebSocketServer({ server: httpServer });

httpServer.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});

watch('.', { recursive: true }, (eventType, filename) => {
  if (eventType === 'change' && isTweeFile(filename)) {
    if (compiling) {
      return;
    }

    console.log(`Twee file changed: ${filename}. Compiling...`);
    compiling = true;
    recompileTweeFilesAndReload();
  }
});

const isTweeFile = (filename) => {
  return filename.endsWith('.twee') || filename.endsWith('.tw');
};

const recompileTweeFilesAndReload = () => {
  compileTweeFiles((error) => {
    if (error || !wsServer.clients.size) {
      return;
    }

    console.log('Recompilation complete. Notifying clients to reload.');
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

const injectScriptToHTML = (html) => {
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

function compileTweeFiles(callback) {
  exec(`tweego -f sugarcube-2 -o index.html src`, (error, stdout, stderr) => {
      compiling = false;
      if (error) {
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