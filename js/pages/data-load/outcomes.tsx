import React from "react";
import type { IdentifierOutcome } from "../../types/dataLoad";

const OUTCOME_LABELS: Record<string, string> = {
  loaded: "Loaded",
  no_op: "No-op — identical fact already stored",
  not_resolved: "Not resolved — no asset claims this identifier",
  no_data_for_date: "No data exists for this date",
  unsupported_scheme: "No enabled source supports this identifier type",
  rejected: "Rejected by the source",
  source_unavailable: "Source unavailable",
  rate_limited: "Rate limited",
  storage_failure: "Storage failure",
};

export const FAILURE_OUTCOMES = new Set([
  "rejected",
  "source_unavailable",
  "rate_limited",
  "storage_failure",
]);

/** Plain-language label for an outcome, preserving unknown raw codes. */
export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? `Unknown outcome (${outcome})`;
}

/** Rendered provenance for an identifier outcome that stored a value. */
export function StoredValue({ line }: { line: IdentifierOutcome }) {
  if (!line.stored) return <span>Nothing stored</span>;
  return (
    <div>
      <pre>{JSON.stringify(line.stored.value, null, 2)}</pre>
      <p>
        As of {line.stored.as_of_date}; recorded {line.stored.known_at}; source{" "}
        {line.stored.source_id}
      </p>
    </div>
  );
}
