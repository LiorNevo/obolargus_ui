import { useState } from "react";
import { Badge } from "lx_client/js/components/Badge";
import { Button } from "lx_client/js/components/Button";
import { useVersionsQuery } from "../../query/automationQueries";
import { useArchiveVersionMutation } from "../../query/mutations";
import { errorMessage, formatInstant } from "./shared";

/** Published version history for one flow. */
export function VersionPanel({
  flowId,
  currentVersionNumber,
}: {
  flowId: string;
  currentVersionNumber: number | null;
}) {
  const versions = useVersionsQuery(flowId);
  const archive = useArchiveVersionMutation(flowId);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="obolargus_automation_panel" aria-label="Versions">
      <h2>Versions</h2>
      {versions.isPending ? <p>Loading versions…</p> : null}
      {versions.isError ? (
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(versions.error)}
        </p>
      ) : null}
      {error ? (
        <p className="obolargus_automation_error" role="alert">
          {error}
        </p>
      ) : null}
      {versions.isSuccess && versions.data.items.length === 0 ? (
        <p>No published versions yet.</p>
      ) : null}
      <ul className="obolargus_automation_versions">
        {versions.data?.items.map((version) => (
          <li key={version.id}>
            <div>
              <strong>v{version.version_number}</strong>{" "}
              {version.version_number === currentVersionNumber ? (
                <Badge tone="success">current</Badge>
              ) : null}
              <p>{version.change_note ?? "No change note."}</p>
              <p className="obolargus_automation_meta">
                {version.published_by ?? "unknown"} ·{" "}
                {formatInstant(version.published_at)} · {version.status}
              </p>
            </div>
            {version.status !== "archived" ? (
              <Button
                variant="ghost"
                onClick={() =>
                  archive.mutate(version.version_number, {
                    onError: (mutationError) =>
                      setError(errorMessage(mutationError)),
                  })
                }
              >
                Archive
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
