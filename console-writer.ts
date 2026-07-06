import { type InspectColor, styleText } from "util";

export interface LoadingStatus {
  message: string;
  complete: boolean;
}

const frames = ["-", "\\", "|", "/"];
export function setLoadingLine(statusCallback: () => LoadingStatus) {
  let frame = 0;

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

export function setCurrentLine(message: string) {
  if (!process.stdout.isTTY || typeof process.stdout.clearLine !== "function") {
    return;
  }

  process.stdout.clearLine(0, () => {
    process.stdout.cursorTo(0);
    process.stdout.write(message);
  });
}

export function writeLine(message: string, style?: InspectColor | InspectColor[]) {
  write(message + "\n", style);
}

export function write(message: string, style?: InspectColor | InspectColor[]) {
  if (style) {
    message = styleText(style, message);
  }

  process.stdout.write(message);
}
