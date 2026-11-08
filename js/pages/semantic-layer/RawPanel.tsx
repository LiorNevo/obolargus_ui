import { useState } from "react";
import { Button } from "lx_client/js/components/Button";
import { copyText } from "./clipboard";

/** Props for a raw structured or canonical-text panel. */
export interface RawPanelProps {
  title: string;
  text: string;
  /** When provided, renders a copy action with this accessible label. */
  copyLabel?: string;
}

/**
 * Renders exact structured or canonical text with an optional copy action.
 *
 * The content is not syntax-highlighted or reconstructed; the caller decides
 * whether it is a definition or the whole canonical document.
 */
export function RawPanel({ title, text, copyLabel }: RawPanelProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    const copied = await copyText(text);
    setStatus(copied ? "copied" : "failed");
  };

  return (
    <section className="obolargus_semantic_raw" aria-label={title}>
      <div className="obolargus_semantic_raw_header">
        <h3>{title}</h3>
        {copyLabel ? (
          <Button type="button" onClick={() => void handleCopy()}>
            {copyLabel}
          </Button>
        ) : null}
      </div>
      <pre>
        <code>{text}</code>
      </pre>
      <p role="status" aria-live="polite" className="obolargus_semantic_muted">
        {status === "copied"
          ? "Copied to the clipboard."
          : status === "failed"
            ? "The clipboard is unavailable. Select the text and copy it manually."
            : ""}
      </p>
    </section>
  );
}

export default RawPanel;
