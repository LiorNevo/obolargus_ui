/**
 * Production-only `tslog` replacement.
 *
 * lx_client's logger only uses the level methods, so a console-backed shim
 * keeps diagnostics visible without shipping the full structured logger in the
 * initial bundle. Development builds keep the real `tslog`.
 */
export class Logger {
  constructor(_settings?: unknown) {}

  silly(...args: unknown[]): void {
    console.debug(...args);
  }

  trace(...args: unknown[]): void {
    console.debug(...args);
  }

  debug(...args: unknown[]): void {
    console.debug(...args);
  }

  info(...args: unknown[]): void {
    console.info(...args);
  }

  warn(...args: unknown[]): void {
    console.warn(...args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }
}
