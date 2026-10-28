import React, { useState } from "react";
import { Button } from "lx_client/js/components/Button";
import type { SourceCatalogEntry } from "../../types/dataLoad";

/** Props for one source's enable/disable control. */
export interface SourceToggleProps {
  source: SourceCatalogEntry;
  enabledCount: number;
  busy: boolean;
  onToggle: (source: SourceCatalogEntry, enabled: boolean) => void;
}

/** Explicit confirmation control for one already-configured source. */
export function SourceToggle({
  source,
  enabledCount,
  busy,
  onToggle,
}: SourceToggleProps) {
  const [pending, setPending] = useState(false);
  const next = !source.enabled;

  if (!pending) {
    return (
      <Button
        type="button"
        disabled={busy}
        onClick={() => setPending(true)}
        aria-label={`${next ? "Enable" : "Disable"} ${source.display_name}`}
      >
        {next ? "Enable" : "Disable"}
      </Button>
    );
  }

  return (
    <span role="group" aria-label={`Confirm ${source.display_name}`}>
      {source.enabled && enabledCount === 1 && (
        <span role="status">
          This is the last enabled source; no load can run until one is enabled.
        </span>
      )}
      <Button
        type="button"
        variant={next ? "primary" : "danger"}
        disabled={busy}
        onClick={() => {
          setPending(false);
          onToggle(source, next);
        }}
      >
        Confirm {next ? "enable" : "disable"}
      </Button>
      <Button type="button" disabled={busy} onClick={() => setPending(false)}>
        Cancel
      </Button>
    </span>
  );
}

export default SourceToggle;
