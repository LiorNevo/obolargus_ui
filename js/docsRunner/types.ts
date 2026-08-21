/**
 * Shared types for the docs-runner feature.
 * Per data-model.md: ExampleSnippet, ExecutionResult, ComparisonReport, EditableExampleState
 */

export type PanelMode = "static" | "results" | "edit";

export type SourceType = "yaml-fence" | "rust-doctest";

export type ExecutionStatus =
  | "success"
  | "syntax-error"
  | "runtime-error"
  | "timeout";

export interface ExampleSnippet {
  /** Unique identifier (hash of content + DOM position) */
  id: string;
  /** Which parsing strategy was used */
  sourceType: SourceType;
  /** YAML text containing the `rules:` definition */
  rulesYaml: string;
  /** Optional input_data field parsed from the example */
  inputData?: Record<string, unknown>;
  /** Expected result (if documented in a Rust doc-test block) */
  expectedOutput?: unknown;
  /** Optional timeout override (rare; defaults to 5000ms) */
  timeout?: number;
  /** Reference to the DOM element where this was found */
  originalElement: HTMLElement;
}

export interface ExecutionResult {
  status: ExecutionStatus;
  output?: unknown;
  error?: { message: string; location?: string };
  durationMs: number;
  timestamp: Date;
}

export interface ComparisonReport {
  matches: boolean;
  actualOutput: unknown;
  expectedOutput: unknown;
  diff?: string;
}

export interface EditableExampleState {
  currentRulesYaml: string;
  currentInputData?: Record<string, unknown>;
  isDirty: boolean;
  mostRecentResult?: ExecutionResult;
}
