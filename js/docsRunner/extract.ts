/**
 * Parses candidate example blocks (found by scanner.ts) into ExampleSnippets.
 *
 * Two shapes exist in the lx_engine docs:
 * - YAML fences: either a bare rule expression (e.g. `abs: [-50, 2]`) or a
 *   full inputs document (`rules:` + optional `input_data:`/`timeout:`)
 * - Rust doc-tests: code containing `let input_data = r#"…"#` and optionally
 *   `let expected = r#"…"#` literals holding the same YAML shapes
 */
import yaml from "js-yaml";
import type { ExampleSnippet } from "./types";

const INPUT_DATA_PATTERN = /let input_data = r#"([\s\S]+?)"#;/;
const EXPECTED_PATTERN = /let expected = r#"([\s\S]+?)"#;/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Stable, compact content fingerprint used for snippet ids. */
const hashContent = (content: string): string => {
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) {
    hash = ((hash << 5) + hash + content.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const buildSnippetId = (sourceType: string, content: string): string =>
  `${sourceType}-${hashContent(content)}`;

const extractTimeout = (candidate: Record<string, unknown>): number | undefined =>
  typeof candidate.timeout === "number" ? candidate.timeout : undefined;

const extractInputData = (
  candidate: Record<string, unknown>
): Record<string, unknown> | undefined =>
  isRecord(candidate.input_data) ? candidate.input_data : undefined;

/** Splits an inputs document into its rules YAML plus data/timeout parts. */
const fromInputsDocument = (
  sourceType: ExampleSnippet["sourceType"],
  document: Record<string, unknown>,
  code: string,
  element: HTMLElement,
  expectedOutput?: unknown
): ExampleSnippet | null => {
  if (document.rules === undefined) {
    return null;
  }
  return {
    id: buildSnippetId(sourceType, code),
    sourceType,
    rulesYaml: yaml.dump({ rules: document.rules }),
    inputData: extractInputData(document),
    expectedOutput,
    timeout: extractTimeout(document),
    originalElement: element,
  };
};

const parseYaml = (text: string): unknown => {
  const parsed = yaml.load(text);
  if (parsed === undefined) {
    throw new Error("empty YAML document");
  }
  return parsed;
};

const parseYamlFence = (code: string, element: HTMLElement): ExampleSnippet | null => {
  let parsed: unknown;
  try {
    parsed = parseYaml(code);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) {
    // A list of rules: wrap it as the rules document directly.
    return {
      id: buildSnippetId("yaml-fence", code),
      sourceType: "yaml-fence",
      rulesYaml: yaml.dump({ rules: parsed }),
      originalElement: element,
    };
  }
  if (!isRecord(parsed)) {
    return null;
  }
  if (parsed.rules !== undefined) {
    return fromInputsDocument("yaml-fence", parsed, code, element);
  }
  // A bare rule expression (e.g. `abs: [-50, 2]`): run it as a single rule.
  return {
    id: buildSnippetId("yaml-fence", code),
    sourceType: "yaml-fence",
    rulesYaml: yaml.dump({ rules: [parsed] }),
    originalElement: element,
  };
};

const parseRustDocTest = (code: string, element: HTMLElement): ExampleSnippet | null => {
  const inputMatch = code.match(INPUT_DATA_PATTERN);
  if (!inputMatch) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(inputMatch[1]);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }

  let expectedOutput: unknown;
  const expectedMatch = code.match(EXPECTED_PATTERN);
  if (expectedMatch) {
    try {
      expectedOutput = parseYaml(expectedMatch[1]);
    } catch {
      expectedOutput = undefined;
    }
  }
  return fromInputsDocument("rust-doctest", parsed, code, element, expectedOutput);
};

/**
 * Parses a candidate block (a `<pre>` from findExampleBlocks) into a
 * runnable ExampleSnippet, or null when the block is not a valid example.
 */
export const parseExample = (element: HTMLElement): ExampleSnippet | null => {
  const code = element.querySelector("code")?.textContent;
  if (!code) {
    return null;
  }
  if (element.querySelector("code")?.classList.contains("language-rust")) {
    return parseRustDocTest(code, element);
  }
  return parseYamlFence(code, element);
};
