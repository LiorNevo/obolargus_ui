/** Test double for the ESM-only tslog package. */
export class Logger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
  silly = jest.fn();
}
