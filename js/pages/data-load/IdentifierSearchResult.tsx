import React from "react";
import { Button } from "lx_client/js/components/Button";
import { Checkbox } from "lx_client/js/components/Checkbox";
import type {
  CandidateIdentifier,
  SearchCandidate,
} from "../../types/dataLoad";

/** The operator-visible venue, falling back to the raw upstream code. */
export function candidateVenue(candidate: SearchCandidate): string {
  return candidate.venue_mic ?? candidate.exchange ?? "Unknown venue";
}

/** The operator-visible asset type, marking an unknown value honestly. */
export function candidateAssetType(candidate: SearchCandidate): string {
  return candidate.asset_type ?? "Unknown type";
}

/** A stable per-result key for selection state. */
export function candidateKey(candidate: SearchCandidate): string {
  return `${candidate.symbol}\u0000${candidate.venue_mic ?? candidate.exchange ?? ""}`;
}

/** The four mutually exclusive operator badges, highest precedence first. */
export type CandidateBadge = "not_addable" | "in_batch" | "known" | "new";

/** Chooses the primary badge for a result. */
export function candidateBadge(
  candidate: SearchCandidate,
  inBatch: boolean,
): CandidateBadge {
  if (!candidate.addable) return "not_addable";
  if (inBatch) return "in_batch";
  if (candidate.known) return "known";
  return "new";
}

const BADGE_LABELS: Record<CandidateBadge, string> = {
  not_addable: "Not addable",
  in_batch: "Already added",
  known: "Already in system",
  new: "New asset",
};

function Badge({ badge }: { badge: CandidateBadge }): React.ReactElement {
  return (
    <span className={`obolargus_search_badge obolargus_search_badge_${badge}`}>
      {BADGE_LABELS[badge]}
    </span>
  );
}

export interface IdentifierSearchResultProps {
  candidate: SearchCandidate;
  selectedIdentifier: CandidateIdentifier;
  onChooseIdentifier: (identifier: CandidateIdentifier) => void;
  inBatch: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  onAdd: (identifier: CandidateIdentifier) => void;
  createMissingAssets: boolean;
  onToggleCreateMissing: (checked: boolean) => void;
}

/**
 * One consolidated search result: a compact summary row that expands into the
 * full disambiguation and add controls on demand.
 */
export function IdentifierSearchResult({
  candidate,
  selectedIdentifier,
  onChooseIdentifier,
  inBatch,
  selected,
  onToggleSelected,
  expanded,
  onToggleExpanded,
  onAdd,
  createMissingAssets,
  onToggleCreateMissing,
}: IdentifierSearchResultProps): React.ReactElement {
  const venue = candidateVenue(candidate);
  const assetType = candidateAssetType(candidate);
  const badge = candidateBadge(candidate, inBatch);
  const addDisabled = !candidate.addable || inBatch || !selectedIdentifier.addable;
  const accessibleName = `${candidate.symbol} on ${venue}, ${assetType}`;
  const key = candidateKey(candidate).replace(/\W+/g, "-");
  const detailsId = `identifier-details-${key}`;

  return (
    <article
      className="obolargus_search_result"
      aria-label={accessibleName}
      data-testid={`identifier-result-${candidate.symbol}-${venue}`}
    >
      <div className="obolargus_search_result_summary">
        <Checkbox
          id={`identifier-select-${key}`}
          label={`Select ${candidate.symbol} on ${venue}`}
          checked={selected}
          onChange={onToggleSelected}
        />
        <button
          type="button"
          className="obolargus_search_result_toggle"
          aria-expanded={expanded}
          aria-controls={expanded ? detailsId : undefined}
          aria-label={`${expanded ? "Hide" : "Show"} details for ${accessibleName}`}
          onClick={onToggleExpanded}
        >
          <span className="obolargus_search_result_title">
            <strong>{candidate.symbol}</strong>
            <span>{candidate.display_name}</span>
          </span>
          <span className="obolargus_search_result_meta">
            <span>{venue}</span>
            <span>{assetType}</span>
          </span>
          <span className="obolargus_search_result_toggle_text" aria-hidden="true">
            {expanded ? "Hide details" : "Details"}
          </span>
        </button>
        <Badge badge={badge} />
      </div>

      {expanded && (
        <div id={detailsId} className="obolargus_search_result_details">
          <dl className="obolargus_search_result_fields">
            <dt>Asset type</dt>
            <dd>{assetType}</dd>
            <dt>Exchange</dt>
            <dd>{venue}</dd>
            <dt>Currency</dt>
            <dd>{candidate.currency ?? "Not provided"}</dd>
            <dt>Source</dt>
            <dd>
              {candidate.sources.map((source) => source.display_name).join(", ")}
            </dd>
            <dt>Exact identifier</dt>
            <dd>
              <span>{selectedIdentifier.label}</span>{" "}
              <code>
                {selectedIdentifier.scheme}:{selectedIdentifier.value}
              </code>
            </dd>
          </dl>

          {!candidate.addable && candidate.not_addable_reason && (
            <p className="obolargus_search_reason" role="note">
              {candidate.not_addable_reason}
            </p>
          )}
          {candidate.addable &&
            !candidate.creatable &&
            candidate.creation_blocked_reason && (
              <p className="obolargus_search_reason" role="note">
                {candidate.creation_blocked_reason}
              </p>
            )}

          {candidate.identifiers.length > 1 && (
            <div className="obolargus_form_field">
              <label htmlFor={`identifier-choice-${key}`}>
                Identifier to add for {candidate.symbol} on {venue}
              </label>
              <select
                id={`identifier-choice-${key}`}
                value={`${selectedIdentifier.scheme}\u0000${selectedIdentifier.value}`}
                onChange={(event) => {
                  const chosen = candidate.identifiers.find(
                    (identifier) =>
                      `${identifier.scheme}\u0000${identifier.value}` ===
                      event.target.value,
                  );
                  if (chosen) onChooseIdentifier(chosen);
                }}
              >
                {candidate.identifiers.map((identifier) => (
                  <option
                    key={`${identifier.scheme}\u0000${identifier.value}`}
                    value={`${identifier.scheme}\u0000${identifier.value}`}
                    disabled={!identifier.addable}
                  >
                    {identifier.label} — {identifier.scheme}:{identifier.value}
                    {identifier.addable ? "" : " (not addable)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {candidate.known === null && candidate.addable && (
            <div className="obolargus_search_creation">
              <Checkbox
                id={`identifier-create-${key}`}
                label="Create missing assets when a ticker-style identifier resolves to none"
                checked={createMissingAssets}
                onChange={onToggleCreateMissing}
              />
              <p className="obolargus_form_note">
                Loading this instrument requires creating the asset. Enable
                “Create missing assets” to load it. Adding it does not enable
                creation.
              </p>
            </div>
          )}

          {candidate.known && (
            <p className="obolargus_form_note">
              Known asset: {candidate.known.display_name} ({candidate.known.asset_type},{" "}
              {candidate.known.currency}); matched{" "}
              <code>
                {candidate.known.matched_scheme}:{candidate.known.matched_value}
              </code>{" "}
              by{" "}
              {candidate.known.match_kind === "exact"
                ? "exact identifier"
                : "equivalent ticker"}
              .
            </p>
          )}

          {candidate.conflicts.length > 0 && (
            <details className="obolargus_search_conflicts">
              <summary>Sources disagree — review before adding</summary>
              <ul>
                {candidate.conflicts.map((conflict) => (
                  <li key={conflict.field}>
                    <strong>{conflict.field.replace(/_/g, " ")}</strong>
                    <ul>
                      {conflict.values.map((value) => (
                        <li key={value.value}>
                          <span>{value.value}</span> — reported by{" "}
                          {value.sources.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="obolargus_form_actions">
            <Button
              type="button"
              onClick={() => onAdd(selectedIdentifier)}
              disabled={addDisabled}
              aria-label={`Add ${selectedIdentifier.scheme}:${selectedIdentifier.value} for ${accessibleName}`}
            >
              {inBatch ? "Already added" : "Add"}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

export default IdentifierSearchResult;
