import React from "react";
import { Checkbox } from "lx_client/js/components/Checkbox";
import { Button } from "lx_client/js/components/Button";
import { DatePicker } from "lx_client/js/components/DatePicker/DatePicker";
import { Input } from "lx_client/js/components/Input";
import MultiSelect from "lx_client/js/components/MultiSelect/MultiSelect";
import type { SelectOption } from "lx_client/js/components/MultiSelect/types";
import type {
  DataDomainId,
  DataLoadDraft,
  DomainEntry,
  SourceCatalogEntry,
} from "../../types/dataLoad";
import { parseIdentifierBatch } from "./IdentifierBatchInput";
import { todayUtc } from "../../store/dataLoadStore";
import { formatLocalDate, parseLocalDate } from "./date";

export function validateDraft(
  draft: DataLoadDraft,
  domains: DomainEntry[],
  sources: SourceCatalogEntry[],
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const domain = domains.find((entry) => entry.id === draft.domain);
  if (domain && !domain.loadable) {
    errors.domain = [
      domain.unavailable_reason ?? `${domain.label} is not loadable.`,
    ];
  }
  if (draft.identifiers.length === 0) {
    errors.identifiers = ["Enter at least one identifier."];
  } else {
    const parsedErrors = parseIdentifierBatch(draft.identifierText).errors;
    if (parsedErrors.length > 0) errors.identifiers = parsedErrors;
  }
  if (draft.mode === "single") {
    if (!draft.date) {
      errors.date = ["Choose a date."];
    } else if (draft.date > todayUtc()) {
      errors.date = ["The date cannot be later than today (UTC)."];
    }
  } else {
    if (!draft.from || !draft.to) {
      errors.range = ["Choose a start and end date."];
    } else if (draft.from > draft.to) {
      errors.range = ["The range start must not be after the end."];
    } else if (draft.to > todayUtc()) {
      errors.range = ["The range end cannot be later than today (UTC)."];
    }
    if (draft.concurrency < 1 || draft.concurrency > 32) {
      errors.concurrency = ["The window must be between 1 and 32."];
    }
  }
  const enabled = sources.filter((source) => source.enabled);
  if (sources.length > 0 && enabled.length === 0) {
    errors.source = ["No source is enabled; enable one before loading."];
  }
  return errors;
}

/** Props for the load form. */
export interface LoadFormProps {
  draft: DataLoadDraft;
  domains: DomainEntry[];
  sources: SourceCatalogEntry[];
  errors: Record<string, string[]>;
  running: boolean;
  catalogError?: string | null;
  onChange: (patch: Partial<DataLoadDraft>) => void;
  onSubmit: () => void;
}

/** Composes the single-date or range load request. */
export function LoadForm({
  draft,
  domains,
  sources,
  errors,
  running,
  catalogError,
  onChange,
  onSubmit,
}: LoadFormProps) {
  const selectableSources = sources.filter(
    (source) => source.enabled && source.selectable_for_domain,
  );

  return (
    <form
      className="obolargus_load_form"
      aria-label="Load data"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2>Load</h2>
      <span id="data-load-domain-label">Data domain</span>
      <MultiSelect
        mode="single"
        options={domains.map((domain, index) => ({
          id: index + 1,
          label: `${domain.label}${domain.loadable ? "" : " (not available)"}`,
          value: domain.id,
        }))}
        value={[
          {
            id:
              domains.findIndex((domain) => domain.id === draft.domain) + 1,
            label:
              domains.find((domain) => domain.id === draft.domain)?.label ??
              draft.domain,
            value: draft.domain,
          },
        ]}
        onChange={(selected: SelectOption[]) =>
          onChange({
            domain: (selected[0]?.value ?? "market_data") as DataDomainId,
          })
        }
        placeholder="Data domain"
        ariaLabel="Data domain"
        name="data-load-domain"
      />
      {errors.domain && (
        <ul id="data-load-domain-error" role="alert">
          {errors.domain.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend>Mode</legend>
        <label>
          <input
            type="radio"
            name="data-load-mode"
            checked={draft.mode === "single"}
            onChange={() => onChange({ mode: "single" })}
          />
          Single date
        </label>
        <label>
          <input
            type="radio"
            name="data-load-mode"
            checked={draft.mode === "range"}
            onChange={() => onChange({ mode: "range" })}
          />
          Date range
        </label>
      </fieldset>

      {errors.identifiers && (
        <ul id="data-load-identifiers-error" role="alert">
          {errors.identifiers.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {draft.mode === "single" ? (
        <div>
          <span>As-of date (UTC)</span>
          <DatePicker
            id="data-load-date"
            mode="single"
            ariaLabel="As-of date (UTC)"
            value={parseLocalDate(draft.date)}
            onChange={(value) => {
              if (value instanceof Date) onChange({ date: formatLocalDate(value) });
            }}
          />
          {errors.date && (
            <ul id="data-load-date-error" role="alert">
              {errors.date.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <fieldset>
          <legend>Date range</legend>
          <span>From</span>
          <DatePicker
            id="data-load-from"
            mode="single"
            ariaLabel="Range start"
            value={parseLocalDate(draft.from)}
            onChange={(value) => {
              if (value instanceof Date) onChange({ from: formatLocalDate(value) });
            }}
          />
          <span>To</span>
          <DatePicker
            id="data-load-to"
            mode="single"
            ariaLabel="Range end"
            value={parseLocalDate(draft.to)}
            onChange={(value) => {
              if (value instanceof Date) onChange({ to: formatLocalDate(value) });
            }}
          />
          <Input
            id="data-load-window"
            label="Window (1–32)"
            type="number"
            value={String(draft.concurrency)}
            onChange={(value) => onChange({ concurrency: Number(value) })}
            inputAttrs={{ min: 1, max: 32 }}
          />
          {(errors.range || errors.concurrency) && (
            <ul role="alert">
              {[...(errors.range ?? []), ...(errors.concurrency ?? [])].map(
                (error) => (
                  <li key={error}>{error}</li>
                ),
              )}
            </ul>
          )}
        </fieldset>
      )}

      <span id="data-load-source-label">Source</span>
      <MultiSelect
        mode="single"
        options={[
          { id: 0, label: "Auto — configured priority and failover", value: "" },
          ...selectableSources.map((source, index) => ({
            id: index + 1,
            label: `${source.display_name} (${source.source_id})`,
            value: source.source_id,
          })),
        ]}
        value={[
          draft.sourceId
            ? {
                id:
                  selectableSources.findIndex(
                    (source) => source.source_id === draft.sourceId,
                  ) + 1,
                label:
                  selectableSources.find(
                    (source) => source.source_id === draft.sourceId,
                  )?.display_name ?? draft.sourceId,
                value: draft.sourceId,
              }
            : { id: 0, label: "Auto", value: "" },
        ]}
        onChange={(selected: SelectOption[]) =>
          onChange({ sourceId: selected[0]?.value || null })
        }
        placeholder="Auto — configured priority and failover"
        ariaLabel="Source"
        name="data-load-source"
      />
      {sources
        .filter((source) => !source.selectable_for_domain)
        .map((source) => (
          <p key={source.source_id} className="obolargus_source_reason">
            {source.display_name}: {source.unavailable_reason ?? "unavailable"}
          </p>
        ))}
      {errors.source && (
        <ul id="data-load-source-error" role="alert">
          {errors.source.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {catalogError && (
        <p role="status">
          The source catalog is unavailable. Auto priority and failover still
          apply. {catalogError}
        </p>
      )}

      <Checkbox
        id="data-load-create-missing"
        label="Create missing assets when a ticker-style identifier resolves to none"
        checked={draft.createMissingAssets}
        onChange={(checked) => onChange({ createMissingAssets: checked })}
      />

      {draft.identifiers.length >= 90 && (
        <p role="status">
          Large batches take longer; {draft.identifiers.length} identifiers
          will be processed.
        </p>
      )}

      <Button type="submit" variant="primary" disabled={running}>
        {running ? "Loading…" : "Load"}
      </Button>
    </form>
  );
}

export default LoadForm;
