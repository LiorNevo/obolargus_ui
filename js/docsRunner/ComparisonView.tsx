import { useMemo } from "react";
import type { ComparisonReport } from "./types";

interface ComparisonViewProps {
  /** The actual output from running the example. */
  actualOutput: unknown;
  /** The expected output documented in the example. */
  expectedOutput: unknown;
}

/**
 * Deep equality check for comparing actual vs expected outputs.
 * Handles JSON-serializable values (objects, arrays, primitives).
 */
const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) {
    return false;
  }

  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
  );
};

/**
 * Generates a human-readable diff string between two values.
 * Simple line-by-line comparison for display purposes.
 */
const generateDiff = (actual: unknown, expected: unknown): string => {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);

  const actualLines = actualStr.split("\n");
  const expectedLines = expectedStr.split("\n");

  const diffLines: string[] = [];
  const maxLines = Math.max(actualLines.length, expectedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const actualLine = actualLines[i] ?? "";
    const expectedLine = expectedLines[i] ?? "";

    if (actualLine === expectedLine) {
      diffLines.push(`  ${actualLine}`);
    } else {
      if (expectedLine) {
        diffLines.push(`- ${expectedLine}`);
      }
      if (actualLine) {
        diffLines.push(`+ ${actualLine}`);
      }
    }
  }

  return diffLines.join("\n");
};

function ComparisonView({ actualOutput, expectedOutput }: ComparisonViewProps) {
  const report: ComparisonReport = useMemo(() => {
    const matches = deepEqual(actualOutput, expectedOutput);
    return {
      matches,
      actualOutput,
      expectedOutput,
      diff: matches ? undefined : generateDiff(actualOutput, expectedOutput),
    };
  }, [actualOutput, expectedOutput]);

  return (
    <div
      className={`docs_example_comparison ${
        report.matches
          ? "docs_example_comparison_pass"
          : "docs_example_comparison_fail"
      }`}
    >
      <div className="docs_example_comparison_indicator">
        {report.matches ? (
          <span className="docs_example_comparison_check" aria-label="Output matches expected">
            ✓
          </span>
        ) : (
          <span className="docs_example_comparison_x" aria-label="Output does not match expected">
            ✗
          </span>
        )}
        <span className="docs_example_comparison_label">
          {report.matches ? "Matches expected" : "Does not match expected"}
        </span>
      </div>
      {!report.matches && report.diff && (
        <pre className="docs_example_comparison_diff">
          {report.diff}
        </pre>
      )}
    </div>
  );
}

export default ComparisonView;
