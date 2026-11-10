import { useQuery } from "@tanstack/react-query";
import { useMemo, type ComponentType } from "react";
import { MultiSelect } from "lx_client/js/components/MultiSelect";
import type { SelectOption } from "lx_client/js/components/MultiSelect/types";
import { TextArea } from "lx_client/js/components/TextArea";
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
    <TextArea
      id={props.id}
      label={String(props.schema.title ?? "Identifiers")}
      value={text}
      rows={5}
      disabled={props.disabled}
      required={props.required}
      errors={props.errors}
      placeholder={"TICKER:XNAS:AAPL\nTICKER:XNAS:MSFT"}
      onChange={(next) => props.onChange(parseIdentifiers(next))}
    />
  );
}) as ComponentType<FormFieldProps>;

/** Text adapter for date values or JSON expression objects. */
export const DateOrExpression = ((props: FormFieldProps) => {
  const value = props.value;
  const text =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? JSON.stringify(value, null, 2)
        : "";
  const rows = value && typeof value === "object" ? 4 : 2;
  return (
    <TextArea
      id={props.id}
      label={String(props.schema.title ?? "Date")}
      value={text}
      rows={rows}
      disabled={props.disabled}
      required={props.required}
      errors={props.errors}
      placeholder="2026-01-02 or an expression object"
      onChange={(next) => {
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
  );
}) as ComponentType<FormFieldProps>;

/** Select adapter for the configured data-load sources. */
export const SourceSelect = ((props: FormFieldProps) => {
  const sources = useQuery(sourcesQueryOptions("market_data"));
  const label = String(props.schema.title ?? "Source");
  const options = useMemo<SelectOption[]>(() => {
    const selectable =
      sources.data?.sources.filter((source) => source.selectable_for_domain) ??
      [];
    return [
      { id: 0, label: "Any available source", value: "" },
      ...selectable.map((source, index) => ({
        id: index + 1,
        label: source.display_name,
        value: source.source_id,
      })),
    ];
  }, [sources.data]);
  const selected = useMemo(() => {
    const current = typeof props.value === "string" ? props.value : "";
    return options.filter((option) => option.value === current);
  }, [options, props.value]);
  return (
    <div className="obolargus_automation_field">
      <span className="obolargus_automation_field-label">{label}</span>
      <MultiSelect
        options={options}
        value={selected}
        mode="single"
        ariaLabel={label}
        placeholder="Any available source"
        disabled={props.disabled || sources.isPending}
        onChange={(next) => props.onChange(next[0]?.value || null)}
      />
      {sources.isError ? (
        <p role="alert">Could not load the source catalog.</p>
      ) : null}
    </div>
  );
}) as ComponentType<FormFieldProps>;

registerComponent("IdentifierBatch", IdentifierBatch);
registerComponent("DateOrExpression", DateOrExpression);
registerComponent("SourceSelect", SourceSelect);
