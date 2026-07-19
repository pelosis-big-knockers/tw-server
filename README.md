# tw-server

A Node.js server for managing and serving Twine story formats and related assets.

## Project Structure

- `console-writer.ts` — Utility for console output.
- `index.ts` — Main entry point for the server.
- `tweego/` — Contains tweego executable and related files for compiling .tw files.

## Features

- Runs a server to automatically compile and serve Twine stories.
- Automatically detects changes in source files, recompiles them, and refreshes the served content.
- Compiles Twee (`.twee`, `.tw`, `.tw2`, `.twee2`), JavaScript (`.js`), and CSS (`.css`) sources with tweego.
- Compiles TypeScript (`.ts`) sources: each file is transpiled to JavaScript (types stripped, no type-checking or bundling) before being handed to tweego. Declaration files (`.d.ts`) and shebang scripts (Node CLI tooling) are ignored.

## Getting Started

### Installation

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd tw-server
   ```
2. Install dependencies:
   ```sh
   npm install
   ```

### Usage

There is no npm package for this at the moment. For my use I've linked it globally in node with the following command:

```bat
npm link
```

Then you can run the server from the command prompt anywhere with:

```bat
tw-server
```

Any compilable source files in the current directory (Twee, JavaScript, TypeScript, and CSS) will be compiled into an `index.html` file in the same directory, and served on `http://localhost:8080` by default. You can specify a different port by providing it as an argument:

```bat
tw-server 8090
```

## License

See the [LICENSE](LICENSE) file for details. Third-party licenses are in `tweego/licenses/` and `tweego/storyformats/*/LICENSE`.

## Acknowledgments

- Thanks to https://github.com/tmedwards/tweego for the tweego project which this server utilizes.
- Thanks to the creators of various Twine story formats which are supported by this server.
