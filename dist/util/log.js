/** Structured JSON-lines logger; keeps output parseable by Docker/journald tooling. */
export function log(level, message, fields = {}) {
    const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
    if (level === 'error')
        console.error(line);
    else
        console.log(line);
}
export function errorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
//# sourceMappingURL=log.js.map