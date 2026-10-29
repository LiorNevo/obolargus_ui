import React, { memo, useState } from "react";
import { Input } from "lx_client/js/components/Input";
import { TextArea } from "lx_client/js/components/TextArea";
import { Button } from "lx_client/js/components/Button";
import type { ParsedIdentifier } from "../../types/dataLoad";

/**
 * Parses one identifier line.
 *
 * `TYPE:VALUE` lines split at the last colon (`TICKER:XNAS:AAPL` means type
 * `TICKER:XNAS`, value `AAPL`). A bare value such as `QQQM` is accepted as a
 * `TICKER` so the common case needs no ceremony; the parsed pair is always
 * shown back to the operator for confirmation.
 */
export function parseIdentifierLine(
  raw: string,
): { identifier?: ParsedIdentifier; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Enter an identifier." };
  const split = trimmed.lastIndexOf(":");
  if (split === -1) {
    if (/\s/.test(trimmed)) {
      return {
        error: `'${trimmed}' contains spaces. Enter one identifier per line.`,
      };
    }
    return { identifier: { scheme: "TICKER", value: trimmed } };
  }
  if (split === 0 || split === trimmed.length - 1) {
    return {
      error: `'${trimmed}' must be TYPE:VALUE (for example TICKER:XNAS:AAPL).`,
    };
  }
  const scheme = trimmed.slice(0, split).trim().toUpperCase();
  const value = trimmed.slice(split + 1).trim();
  if (!scheme) return { error: "The identifier type is empty." };
  if (!value) return { error: "The identifier value is empty." };
  return { identifier: { scheme, value } };
}

/** Parses a multi-line list, preserving first occurrences. */
export function parseIdentifierBatch(text: string): {
  identifiers: ParsedIdentifier[];
  duplicates: number;
  errors: string[];
} {
  const identifiers: ParsedIdentifier[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let duplicates = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = parseIdentifierLine(line);
    if (!parsed.identifier) {
      if (parsed.error) errors.push(parsed.error);
      continue;
    }
    const key = `${parsed.identifier.scheme}\u0000${parsed.identifier.value}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    identifiers.push(parsed.identifier);
  }
  return { identifiers, duplicates, errors };
}

export interface IdentifierBatchInputProps {
  text: string;
  identifiers: ParsedIdentifier[];
  onChange: (text: string, identifiers: ParsedIdentifier[]) => void;
  errors?: string[];
}

/** Add-one and paste-many identifier input. */
export const IdentifierBatchInput = memo(function IdentifierBatchInput({
  text,
  identifiers,
  onChange,
  errors = [],
}: IdentifierBatchInputProps) {
  const [single, setSingle] = useState("");
  const [singleError, setSingleError] = useState<string | null>(null);
  const { duplicates } = parseIdentifierBatch(text);

  const addSingle = () => {
    const parsed = parseIdentifierLine(single);
    if (!parsed.identifier) {
      setSingleError(parsed.error ?? "Enter an identifier.");
      return;
    }
    const next = text.trim() ? `${text.trim()}\n${single.trim()}` : single.trim();
    setSingle("");
    setSingleError(null);
    onChange(next, parseIdentifierBatch(next).identifiers);
  };

  return (
    <fieldset className="obolargus_identifier_batch">
      <legend>Identifiers</legend>
      <TextArea
        id="data-load-identifiers"
        label="Paste identifiers, one per line"
        value={text}
        rows={6}
        placeholder={"QQQM\nTICKER:XNAS:AAPL"}
        describedBy="data-load-identifiers-help"
        errors={errors}
        onChange={(next) => {
          onChange(next, parseIdentifierBatch(next).identifiers);
        }}
      />
      <p id="data-load-identifiers-help" className="obolargus_form_note">
        Enter one identifier per line. A bare ticker such as <code>QQQM</code>{" "}
        is treated as <code>TICKER:QQQM</code>; use{" "}
        <code>TICKER:XNAS:AAPL</code> to name the venue.
      </p>
      <div className="obolargus_identifier_add">
        <Input
          id="data-load-single-identifier"
          label="Add one identifier"
          value={single}
          placeholder="QQQM or TICKER:XNAS:AAPL"
          errors={singleError ? [singleError] : []}
          onChange={(value) => {
            setSingle(value);
            if (singleError) setSingleError(null);
          }}
        />
        <Button
          type="button"
          onClick={addSingle}
          disabled={single.trim().length === 0}
        >
          Add
        </Button>
      </div>
      {duplicates > 0 && (
        <p role="status">Removed {duplicates} duplicate identifier(s).</p>
      )}
      {identifiers.length > 0 && (
        <ul className="obolargus_identifier_list" aria-label="Parsed identifiers">
          {identifiers.map((identifier) => (
            <li key={`${identifier.scheme}:${identifier.value}`}>
              <code>{identifier.scheme}</code> <span>{identifier.value}</span>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
});

export default IdentifierBatchInput;
