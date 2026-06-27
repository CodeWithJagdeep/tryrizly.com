type LogPayload = Record<string, unknown>;

function log(level: "info" | "warn" | "error", message: string, payload?: LogPayload) {
  const line = {
    level,
    message,
    ...(payload ?? {}),
    at: new Date().toISOString(),
  };

  const output = JSON.stringify(line);
  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

export const logger = {
  info: (message: string, payload?: LogPayload) => log("info", message, payload),
  warn: (message: string, payload?: LogPayload) => log("warn", message, payload),
  error: (message: string, payload?: LogPayload) => log("error", message, payload),
};
