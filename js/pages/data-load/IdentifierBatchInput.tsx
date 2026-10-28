import React, { useState } from "react";
import { Input } from "lx_client/js/components/Input";
import { Button } from "lx_client/js/components/Button";
import type { ParsedIdentifier } from "../../types/dataLoad";

/** Parses one `TYPE:VALUE` line at the last colon. */
export function parseIdentifierLine(
  raw: string,
): { identifier?: ParsedIdentifier; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Enter an identifier." };
  const split = trimmed.lastIndexOf(":");
  if (split <= 0 || split === trimmed.length - 1) {
    return { error: `'${trimmed}' must be TYPE:VALUE (for example TICKER:XNAS:AAPL).` };
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
export function IdentifierBatchInput({
  text,
  identifiers,
  onChange,
  errors = [],
}: IdentifierBatchInputProps) {
  const [single, setSingle] = useState("");
  const { duplicates } = parseIdentifierBatch(text);

  const addSingle = () => {
    const parsed = parseIdentifierLine(single);
    if (!parsed.identifier) return;
    const next = text.trim() ? `${text.trim()}\n${single.trim()}` : single.trim();
    setSingle("");
    onChange(next, parseIdentifierBatch(next).identifiers);
  };

  return (
    <fieldset className="obolargus_identifier_batch">
      <legend>Identifiers</legend>
      <label htmlFor="data-load-identifiers">Paste identifiers, one per line</label>
      <textarea
        id="data-load-identifiers"
        value={text}
        rows={5}
        aria-describedby={errors.length ? "data-load-identifiers-error" : undefined}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next, parseIdentifierBatch(next).identifiers);
        }}
      />
      <div className="obolargus_identifier_add">
        <Input
          id="data-load-single-identifier"
          label="Add one identifier"
          value={single}
          placeholder="TICKER:XNAS:AAPL"
          onChange={setSingle}
        />
        <Button type="button" onClick={addSingle}>
          Add
        </Button>
      </div>
      {duplicates > 0 && (
        <p role="status">Removed {duplicates} duplicate identifier(s).</p>
      )}
      {identifiers.length > 0 && (
        <ul aria-label="Parsed identifiers">
          {identifiers.map((identifier) => (
            <li key={`${identifier.scheme}:${identifier.value}`}>
              <code>{identifier.scheme}</code> <span>{identifier.value}</span>
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <ul id="data-load-identifiers-error" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export default IdentifierBatchInput;
