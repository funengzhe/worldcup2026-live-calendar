type ErrorWithCause = Error & { cause?: unknown };

export function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const message = error.message || error.name;
  const cause = formatCause((error as ErrorWithCause).cause);
  if (!cause || cause === message) return message;

  return `${message} (cause: ${cause})`;
}

function formatCause(cause: unknown): string | undefined {
  if (!cause) return undefined;

  if (cause instanceof Error) {
    return formatErrorObject(cause);
  }

  if (typeof cause === "object") {
    return formatErrorObject(cause as Record<string, unknown>);
  }

  return String(cause);
}

function formatErrorObject(error: Error | Record<string, unknown>): string {
  const details = [
    readString(error, "code"),
    readString(error, "syscall"),
    readString(error, "hostname"),
    readString(error, "address"),
    readString(error, "port")
  ].filter((value): value is string => Boolean(value));
  const message = error instanceof Error ? error.message : readString(error, "message");
  if (message && details.every((detail) => message.includes(detail))) return message;

  return Array.from(new Set([...details, message].filter((value): value is string => Boolean(value)))).join(" ");
}

function readString(object: Error | Record<string, unknown>, key: string): string | undefined {
  const value = (object as Record<string, unknown>)[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}
