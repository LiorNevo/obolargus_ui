import type { DataLoadDraft, ParsedIdentifier } from "../../types/dataLoad";

/** The exact duplicate key used by `parseIdentifierBatch`. */
export function identifierKey(identifier: ParsedIdentifier): string {
  return `${identifier.scheme}\u0000${identifier.value}`;
}

function formatIdentifier(identifier: ParsedIdentifier): string {
  return `${identifier.scheme}:${identifier.value}`;
}

/** The fields adding a search result is allowed to touch. */
export type DraftBatch = Pick<DataLoadDraft, "identifierText" | "identifiers">;

/** The result of appending search-selected identifiers to the draft. */
export interface AppendIdentifiersResult {
  /** New text area content. */
  text: string;
  /** New ordered parsed batch. */
  identifiers: ParsedIdentifier[];
  /** Identifiers actually appended, in input order. */
  added: ParsedIdentifier[];
  /** Exact duplicates skipped. */
  skipped: number;
}

/**
 * Appends search-selected identifiers to the existing batch.
 *
 * Preserves first-occurrence order, uses the same duplicate key as the manual
 * parser, and never changes domain, mode, dates, concurrency, source, or the
 * creation opt-in.
 */
export function appendIdentifiersToDraft(
  draft: DraftBatch,
  additions: ParsedIdentifier[],
): AppendIdentifiersResult {
  const seen = new Set(draft.identifiers.map(identifierKey));
  const added: ParsedIdentifier[] = [];
  let skipped = 0;
  for (const identifier of additions) {
    const key = identifierKey(identifier);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    added.push(identifier);
  }

  const identifiers = [...draft.identifiers, ...added];
  const existingText = draft.identifierText.trim()
    ? draft.identifierText.trim()
    : draft.identifiers.map(formatIdentifier).join("\n");
  const text = [...(existingText ? [existingText] : []), ...added.map(formatIdentifier)]
    .join("\n");

  return { text, identifiers, added, skipped };
}
