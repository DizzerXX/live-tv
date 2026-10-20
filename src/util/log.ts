type Level = 'info' | 'warn' | 'error';

/** Structured JSON-lines logger; keeps output parseable by Docker/journald tooling. */
export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
