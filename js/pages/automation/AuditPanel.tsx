import { useAuditQuery } from "../../query/automationQueries";
import { errorMessage, formatInstant } from "./shared";

/** Audit history for one flow. */
export function AuditPanel({ flowId }: { flowId: string }) {
  const audit = useAuditQuery(flowId);
  return (
    <section className="obolargus_automation_panel" aria-label="Audit history">
      <h2>Audit history</h2>
      {audit.isPending ? <p>Loading audit events…</p> : null}
      {audit.isError ? (
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(audit.error)}
        </p>
      ) : null}
      {audit.isSuccess && audit.data.items.length === 0 ? (
        <p>No audit events yet.</p>
      ) : null}
      <ol className="obolargus_automation_audit">
        {audit.data?.items.map((event) => (
          <li key={event.id}>
            <strong>{event.action}</strong>{" "}
            <span className="obolargus_automation_meta">
              {event.target_type} · {event.actor_id ?? "system"} ·{" "}
              {formatInstant(event.created_at)}
            </span>
            {event.metadata ? (
              <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
