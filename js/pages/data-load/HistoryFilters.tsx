import React, { memo } from "react";
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
export const HistoryFilters = memo(function HistoryFilters({
  filters,
  onChange,
  onClear,
}: HistoryFiltersProps) {
  const rangeStart = parseLocalDate(filters.from ?? "");
  const rangeEnd = parseLocalDate(filters.to ?? "");
  const rangeValue =
    rangeStart && rangeEnd ? { start: rangeStart, end: rangeEnd } : undefined;

  return (
    <form
      className="obolargus_history_filters"
      aria-label="History filters"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="obolargus_form_field obolargus_form_field_grow">
        <span className="obolargus_form_label">Date range</span>
        <DatePicker
          id="history-range"
          mode="range"
          fullWidth
          ariaLabel="History date range"
          value={rangeValue}
          onChange={(value) => {
            if (value && !(value instanceof Date)) {
              onChange({
                from: formatLocalDate(value.start),
                to: formatLocalDate(value.end),
              });
            }
          }}
        />
      </div>
      <div className="obolargus_form_field">
        <span className="obolargus_form_label">Domain</span>
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
      </div>
      <div className="obolargus_form_field">
        <Input
          id="history-source"
          label="Source"
          value={filters.source ?? ""}
          onChange={(value) => onChange({ source: value || undefined })}
        />
      </div>
      <div className="obolargus_form_field">
        <span className="obolargus_form_label">Status</span>
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
      </div>
      <div className="obolargus_form_field">
        <span className="obolargus_form_label">Entry type</span>
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
      </div>
      <div className="obolargus_form_actions">
        <Button type="button" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </form>
  );
});

export default HistoryFilters;
