import { useState } from "react";
import { Button } from "lx_client/js/components/Button";
import { downloadCanonicalDictionary } from "./download";

/** Props for the whole-document download action. */
export interface DocumentActionsProps {
  canonicalText: string;
}

/**
 * Offers the canonical dictionary download without changing its bytes.
 */
export function DocumentActions({ canonicalText }: DocumentActionsProps) {
  const [status, setStatus] = useState<"idle" | "started">("idle");

  return (
    <div className="obolargus_semantic_actions">
      <Button
        type="button"
        onClick={() => {
          downloadCanonicalDictionary(canonicalText);
          setStatus("started");
        }}
      >
        Download dictionary
      </Button>
      <span role="status" aria-live="polite" className="obolargus_semantic_muted">
        {status === "started" ? "Download started." : ""}
      </span>
    </div>
  );
}

export default DocumentActions;
