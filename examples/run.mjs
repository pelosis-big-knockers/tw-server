#!/usr/bin/env node
// Runs the tw-server example fixtures so you can see how each mini setup behaves.
//
//   node examples/run.mjs             build every example once, print a summary
//   node examples/run.mjs --all       same as above
//   node examples/run.mjs <name>      run tw-server live in that example (Ctrl+C to stop)
//
// Live mode serves on http://localhost:8080 and watches for changes, exactly as
// a real story project would. Summary mode builds each example once, reports
// whether an index.html was produced, and echoes any compiler output.

import { spawn } from "child_process";
import { readdirSync, statSync, existsSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(examplesDir, "..", "index.ts");

const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");

function exampleNames() {
  return readdirSync(examplesDir)
    .filter((name) => statSync(path.join(examplesDir, name)).isDirectory())
    .sort();
}

const arg = process.argv[2];

if (arg && arg !== "--all") {
  runLive(arg);
} else {
  await runAll();
}

function runLive(name) {
  const dir = path.join(examplesDir, name);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`No such example: ${name}`);
    console.error(`Available: ${exampleNames().join(", ")}`);
    process.exit(1);
  }

  console.log(`Running tw-server in examples/${name} (Ctrl+C to stop)...\n`);
  const child = spawn(process.execPath, [serverEntry], { cwd: dir, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

async function runAll() {
  const names = exampleNames();
  console.log(`Building ${names.length} examples...\n`);

  const results = [];
  let port = 9100;
  for (const name of names) {
    process.stdout.write(`  ${name}... `);
    const result = await buildOnce(name, port++);
    console.log(result.built ? "built" : "no index.html");
    results.push(result);
  }

  console.log("\n=== Summary ===");
  for (const result of results) {
    const status = result.built ? "built index.html" : "no index.html (build aborted)";
    console.log(`- ${result.name}: ${status}`);
    if (result.note) {
      console.log(`    ${result.note}`);
    }
  }
}

// Build a single example by running the real server briefly, then killing it.
// The server watches forever, so we give the initial compile time to settle and
// then terminate it. index.html is removed first so its presence afterwards is
// an honest signal of whether the build actually produced output.
function buildOnce(name, port) {
  return new Promise((resolve) => {
    const dir = path.join(examplesDir, name);
    const outFile = path.join(dir, "index.html");
    rmSync(outFile, { force: true });

    const child = spawn(process.execPath, [serverEntry, String(port)], { cwd: dir });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));

    const settle = setTimeout(() => {
      child.kill();
      const clean = stripAnsi(output);
      const note = clean
        .split("\n")
        .map((line) => line.trim())
        .find((line) => /error|expected|\.ts\(\d+,\d+\)/i.test(line));
      resolve({ name, built: existsSync(outFile), note: note ?? "" });
    }, 4000);

    child.on("error", (err) => {
      clearTimeout(settle);
      resolve({ name, built: false, note: err.message });
    });
  });
}
