import React from "react";
import { Button } from "lx_client/js/components/Button";
import type { IdentifierSearchResponse } from "../../types/dataLoad";

/** Names of consulted sources that did not produce an answer. */
export function failedSourceNames(
  data: IdentifierSearchResponse,
): string[] {
  return data.sources
    .filter(
      (source) =>
        source.status !== "answered" && source.status !== "no_match",
    )
    .map((source) => source.display_name);
}

/** The rate-limit notice with the cooldown each limited source supplied. */
export function rateLimitNotice(
  data: IdentifierSearchResponse,
): string | null {
  const limited = data.sources.filter(
    (source) => source.status === "rate_limited",
  );
  if (limited.length === 0) return null;
  return limited
    .map((source) => {
      const wait = source.retry_after_seconds
        ? ` Try again in ${source.retry_after_seconds} seconds.`
        : "";
      return `${source.display_name} is temporarily rate limited.${wait}`;
    })
    .join(" ");
}

/** Props for the per-source status and failure surface. */
export interface IdentifierSearchSourcesProps {
  /** The completed search response. */
  data: IdentifierSearchResponse;
  /** Whether the operator stopped the request. */
  cancelled: boolean;
  /** Whether the retry control is disabled (offline or no eligible source). */
  retryDisabled: boolean;
  /** Retries the submitted query. */
  onRetry: () => void;
}

/**
 * Discloses partial failure, total failure, rate limits, and the absence of an
 * eligible source. A genuine no-match is rendered by the caller only when the
 * outcome is `complete` and the total is zero.
 */
export function IdentifierSearchSources({
  data,
  cancelled,
  retryDisabled,
  onRetry,
}: IdentifierSearchSourcesProps): React.ReactElement | null {
  if (cancelled) return null;
  const failed = failedSourceNames(data);
  const limited = rateLimitNotice(data);

  return (
    <>
      {data.outcome === "no_sources" && (
        <p className="obolargus_search_notice" role="status">
          No enabled source can search market data. Enable one in the source
          catalog; manual identifier entry still works.
        </p>
      )}

      {data.outcome === "failed" && (
        <div className="obolargus_alert" role="alert">
          <p>
            {data.message ??
              "Every consulted source failed. Try again or check the source catalog."}
          </p>
          <Button type="button" onClick={onRetry} disabled={retryDisabled}>
            Retry
          </Button>
        </div>
      )}

      {data.outcome === "partial" && (
        <p className="obolargus_search_notice" role="status">
          Partial results: {failed.join(", ") || "some sources"} could not be
          searched.
        </p>
      )}

      {limited && (
        <p className="obolargus_search_reason" role="status">
          {limited}
        </p>
      )}

      {data.sources.length > 0 && (
        <details className="obolargus_search_sources">
          <summary>Source status</summary>
          <ul>
            {data.sources.map((source) => (
              <li key={source.source_id}>
                <strong>{source.display_name}</strong>:{" "}
                {source.status.replace(/_/g, " ")}
                {source.hit_count > 0 ? ` (${source.hit_count} hit(s))` : ""}
                {source.message ? ` — ${source.message}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export default IdentifierSearchSources;
