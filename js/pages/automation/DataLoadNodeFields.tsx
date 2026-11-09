import { useQuery } from "@tanstack/react-query";
import { useMemo, type ComponentType } from "react";
import {
  registerComponent,
  type FormFieldProps,
} from "lx_client/js/components/SchemaForm/registry";
import { sourcesQueryOptions } from "../../query/dataLoadQueries";

function parseIdentifiers(text: string): Array<{ scheme: string; value: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) {
        return { scheme: "TICKER", value: line };
      }
      return {
        scheme: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    });
}

function identifiersToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return String(entry);
      const record = entry as { scheme?: unknown; value?: unknown };
      return `${String(record.scheme ?? "TICKER")}:${String(record.value ?? "")}`;
    })
    .join("\n");
}

/** Textarea adapter that edits a typed identifier array. */
export const IdentifierBatch = ((props: FormFieldProps) => {
  const text = identifiersToText(props.value);
  return (
    <div className="obolargus_automation_field">
      <label htmlFor={props.id}>{String(props.schema.title ?? "Identifiers")}</label>
      <textarea
        id={props.id}
        rows={5}
        value={text}
        disabled={props.disabled}
        placeholder={"TICKER:XNAS:AAPL\nTICKER:XNAS:MSFT"}
        onChange={(event) =>
          props.onChange(parseIdentifiers(event.target.value))
        }
      />
    </div>
  );
}) as ComponentType<FormFieldProps>;

/** Text adapter for date values or JSON expression objects. */
export const DateOrExpression = ((props: FormFieldProps) => {
  const value = props.value;
  const text =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? JSON.stringify(value)
        : "";
  return (
    <div className="obolargus_automation_field">
      <label htmlFor={props.id}>
        {String(props.schema.title ?? "Date")}
      </label>
      <input
        id={props.id}
        type="text"
        value={text}
        disabled={props.disabled}
        placeholder="2026-01-02 or an expression object"
        onChange={(event) => {
          const next = event.target.value;
          const trimmed = next.trim();
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
              props.onChange(JSON.parse(trimmed));
              return;
            } catch {
              // Keep the partial text as a string until it becomes valid JSON.
            }
          }
          props.onChange(next);
        }}
      />
      {value && typeof value === "object" ? (
        <p className="obolargus_automation_meta">Expression value</p>
      ) : null}
    </div>
  );
}) as ComponentType<FormFieldProps>;

/** Select adapter for the configured data-load sources. */
export const SourceSelect = ((props: FormFieldProps) => {
  const sources = useQuery(sourcesQueryOptions("market_data"));
  const options = useMemo(
    () => sources.data?.sources.filter((source) => source.selectable_for_domain) ?? [],
    [sources.data],
  );
  return (
    <div className="obolargus_automation_field">
      <label htmlFor={props.id}>{String(props.schema.title ?? "Source")}</label>
      <select
        id={props.id}
        value={typeof props.value === "string" ? props.value : ""}
        disabled={props.disabled || sources.isPending}
        onChange={(event) => props.onChange(event.target.value || null)}
      >
        <option value="">Any available source</option>
        {options.map((source) => (
          <option key={source.source_id} value={source.source_id}>
            {source.display_name}
          </option>
        ))}
      </select>
      {sources.isError ? (
        <p role="alert">Could not load the source catalog.</p>
      ) : null}
    </div>
  );
}) as ComponentType<FormFieldProps>;

registerComponent("IdentifierBatch", IdentifierBatch);
registerComponent("DateOrExpression", DateOrExpression);
registerComponent("SourceSelect", SourceSelect);
