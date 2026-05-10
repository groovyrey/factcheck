const MAX_LOG_CHARS = 4_000;

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    const json = JSON.stringify(
      value,
      (_key, v) => {
        if (typeof v === "bigint") return v.toString();
        if (typeof v === "object" && v !== null) {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        return v;
      },
      2,
    );
    return truncate(json ?? "", MAX_LOG_CHARS);
  } catch {
    return truncate(String(value), MAX_LOG_CHARS);
  }
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…[truncated ${text.length - maxChars} chars]`;
}

function formatLine(level: "INFO" | "WARN" | "ERROR", message: string) {
  return `[${level}] ${new Date().toISOString()} - ${message}`;
}

export const logger = {
  info: (message: string, data?: unknown) => {
    console.log(
      `${formatLine("INFO", message)}${data === undefined ? "" : "\n" + safeStringify(data)}`,
    );
  },
  warn: (message: string, data?: unknown) => {
    console.warn(
      `${formatLine("WARN", message)}${data === undefined ? "" : "\n" + safeStringify(data)}`,
    );
  },
  error: (message: string, error?: unknown) => {
    const rendered =
      error === undefined
        ? ""
        : "\n" +
          truncate(
            error instanceof Error ? error.stack ?? error.message : safeStringify(error),
            MAX_LOG_CHARS,
          );
    console.error(`${formatLine("ERROR", message)}${rendered}`);
  },
};
