
export function setLoadingLine(statusCallback) {
  let frame = 0;
  const frames = ['-', '\\', '|', '/'];

  const interval = setInterval(() => {
    const status = statusCallback();
    if (status.complete) {
      clearInterval(interval);
      return;
    }
    
    setCurrentLine(`${frames[frame % frames.length]} ${status.message}`);
    frame++;
  }, 100);
}

export function setCurrentLine(message) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(message);

  commands.push(() => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(message);
  });
}

export function writeLine(message) {
  process.stdout.write(message + '\n');
  commands.push(() => process.stdout.write(message + '\n'));
}

const colorCodes = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

export function write(message, color) {
  const colorCode = colorCodes[color?.toLowerCase?.()]
  if (colorCode) {
    message = colorCode + message + colorCodes.reset
  }
  
  process.stdout.write(message);
  commands.push(() => process.stdout.write(message));
}

let checkpoint = 0;
const commands = [];

export function setCheckpoint() {
  checkpoint = commands.length;
}

export function clearToLastCheckpoint() {
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); // Clear console

  commands.length = checkpoint;
  for (const cmd of commands) {
    cmd();
  }
}