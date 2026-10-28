import React from "react";
import { Input } from "lx_client/js/components/Input";
import { DatePicker } from "lx_client/js/components/DatePicker/DatePicker";
import { Button } from "lx_client/js/components/Button";
import MultiSelect from "lx_client/js/components/MultiSelect/MultiSelect";
import type { SelectOption } from "lx_client/js/components/MultiSelect/types";
import type { HistoryFiltersValue } from "../../types/dataLoad";
import { formatLocalDate, parseLocalDate } from "./date";

/** Props for the URL-backed history filters. */
export interface HistoryFiltersProps {
  filters: HistoryFiltersValue;
  onChange: (patch: Partial<HistoryFiltersValue>) => void;
  onClear: () => void;
}

/** Date, domain, source, status, and entry-type filters. */
export function HistoryFilters({
  filters,
  onChange,
  onClear,
}: HistoryFiltersProps) {
  return (
    <form aria-label="History filters" onSubmit={(event) => event.preventDefault()}>
      <span>From</span>
      <DatePicker
        id="history-from"
        mode="single"
        ariaLabel="History from date"
        value={parseLocalDate(filters.from ?? "")}
        onChange={(value) => {
          if (value instanceof Date) onChange({ from: formatLocalDate(value) });
        }}
      />
      <span>To</span>
      <DatePicker
        id="history-to"
        mode="single"
        ariaLabel="History to date"
        value={parseLocalDate(filters.to ?? "")}
        onChange={(value) => {
          if (value instanceof Date) onChange({ to: formatLocalDate(value) });
        }}
      />
      <span>Domain</span>
      <MultiSelect
        mode="single"
        options={[
          { id: 0, label: "All domains", value: "" },
          { id: 1, label: "Market & reference data", value: "market_data" },
          { id: 2, label: "Holdings", value: "holdings" },
        ]}
        value={[
          filters.domain
            ? {
                id: filters.domain === "market_data" ? 1 : 2,
                label:
                  filters.domain === "market_data"
                    ? "Market & reference data"
                    : "Holdings",
                value: filters.domain,
              }
            : { id: 0, label: "All domains", value: "" },
        ]}
        onChange={(selected: SelectOption[]) =>
          onChange({ domain: selected[0]?.value || undefined })
        }
        placeholder="All domains"
        ariaLabel="Domain"
        name="history-domain"
      />
      <Input
        id="history-source"
        label="Source"
        value={filters.source ?? ""}
        onChange={(value) => onChange({ source: value || undefined })}
      />
      <span>Status</span>
      <MultiSelect
        mode="single"
        options={[
          { id: 0, label: "All statuses", value: "" },
          { id: 1, label: "Complete", value: "complete" },
          { id: 2, label: "Partial", value: "partial" },
          { id: 3, label: "Failed", value: "failed" },
          { id: 4, label: "Running", value: "running" },
          { id: 5, label: "Incomplete / interrupted", value: "incomplete" },
          { id: 6, label: "Source enabled", value: "source_enabled" },
          { id: 7, label: "Source disabled", value: "source_disabled" },
        ]}
        value={[
          filters.status
            ? {
                id: 1,
                label: filters.status,
                value: filters.status,
              }
            : { id: 0, label: "All statuses", value: "" },
        ]}
        onChange={(selected: SelectOption[]) =>
          onChange({ status: selected[0]?.value || undefined })
        }
        placeholder="All statuses"
        ariaLabel="Status"
        name="history-status"
      />
      <span>Entry type</span>
      <MultiSelect
        mode="single"
        options={[
          { id: 0, label: "All entries", value: "" },
          { id: 1, label: "Load runs", value: "run" },
          { id: 2, label: "Single-date runs", value: "load_run" },
          { id: 3, label: "Range runs", value: "range_run" },
          { id: 4, label: "Configuration changes", value: "source_change" },
        ]}
        value={[
          filters.entry_type
            ? {
                id: 1,
                label: filters.entry_type,
                value: filters.entry_type,
              }
            : { id: 0, label: "All entries", value: "" },
        ]}
        onChange={(selected: SelectOption[]) =>
          onChange({ entry_type: selected[0]?.value || undefined })
        }
        placeholder="All entries"
        ariaLabel="Entry type"
        name="history-entry-type"
      />
      <Button type="button" onClick={onClear}>
        Clear filters
      </Button>
    </form>
  );
}

export default HistoryFilters;
