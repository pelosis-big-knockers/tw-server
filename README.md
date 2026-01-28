# tw-server

A Node.js server for managing and serving Twine story formats and related assets.

## Project Structure

- `console-writer.ts` — Utility for console output.
- `index.ts` — Main entry point for the server.
- `tweego/` — Contains tweego executable and related files for compiling .tw files.

## Features

- Runs a server to automatically compile and serve Twine stories.
- Automatically detects changes in .tw files, recompiles them, and refreshes the served content.

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

Any `.tw` files in the current directory will be compiled into a `index.html` file in the same directory, and served on `http://localhost:8080` by default. You can specify a different port by providing it as an argument:

```bat
tw-server 8090
```

## License

See the [LICENSE](LICENSE) file for details. Third-party licenses are in `tweego/licenses/` and `tweego/storyformats/*/LICENSE`.

## Acknowledgments

- Thanks to https://github.com/tmedwards/tweego for the tweego project which this server utilizes.
- Thanks to the creators of various Twine story formats which are supported by this server.
