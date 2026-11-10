import { useState } from "react";
import { Button } from "lx_client/js/components/Button";
import { useTriggersQuery } from "../../query/automationQueries";
import {
  useCreateTriggerMutation,
  useDeleteTriggerMutation,
  useInvokeTriggerMutation,
  useUpdateTriggerMutation,
} from "../../query/mutations";
import { errorMessage, formatInstant } from "./shared";

function idempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `invoke-${Date.now()}`;
}

/** Schedules and API triggers for one flow. */
export function TriggerPanel({ flowId }: { flowId: string }) {
  const triggers = useTriggersQuery(flowId);
  const create = useCreateTriggerMutation(flowId);
  const update = useUpdateTriggerMutation(flowId);
  const remove = useDeleteTriggerMutation(flowId);
  const invoke = useInvokeTriggerMutation(flowId);
  const [error, setError] = useState<string | null>(null);
  const [invokedRun, setInvokedRun] = useState<string | null>(null);

  return (
    <section className="obolargus_automation_panel" aria-label="Triggers">
      <header className="obolargus_automation_panel__header">
        <h2>Triggers</h2>
        <Button
          onClick={() =>
            create.mutate(undefined, {
              onError: (mutationError) =>
                setError(errorMessage(mutationError)),
            })
          }
          disabled={create.isPending}
        >
          {create.isPending ? "Creating…" : "Add API trigger"}
        </Button>
      </header>
      {error ? (
        <p className="obolargus_automation_error" role="alert">
          {error}
        </p>
      ) : null}
      {invokedRun ? (
        <p role="status">
          Started run <code>{invokedRun}</code>.
        </p>
      ) : null}
      {triggers.isPending ? <p>Loading triggers…</p> : null}
      {triggers.isError ? (
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(triggers.error)}
        </p>
      ) : null}
      {triggers.isSuccess && triggers.data.items.length === 0 ? (
        <p>No triggers yet. Publish a flow with a repeating inject or add an API trigger.</p>
      ) : null}
      <ul className="obolargus_automation_triggers">
        {triggers.data?.items.map((trigger) => (
          <li key={trigger.id}>
            <div>
              <strong>{trigger.kind}</strong>
              {trigger.node_id ? ` · ${trigger.node_id}` : ""}
              <p className="obolargus_automation_meta">
                {trigger.repeat_kind
                  ? `${trigger.repeat_kind} ${
                      trigger.cron_expression ??
                      (trigger.interval_seconds
                        ? `${trigger.interval_seconds}s`
                        : "")
                    }`
                  : "manual / invoked"}{" "}
                · {trigger.timezone}
              </p>
              <p className="obolargus_automation_meta">
                Next: {formatInstant(trigger.next_occurrence_at)} · Last:{" "}
                {formatInstant(trigger.last_occurrence_at)}
              </p>
              <p className="obolargus_automation_meta">
                Overlap: {trigger.overlap_policy} · Missed:{" "}
                {trigger.missed_policy}
              </p>
            </div>
            <div className="obolargus_automation_row_actions">
              <Button
                variant="ghost"
                onClick={() =>
                  update.mutate(
                    { triggerId: trigger.id, enabled: !trigger.enabled },
                    {
                      onError: (mutationError) =>
                        setError(errorMessage(mutationError)),
                    },
                  )
                }
              >
                {trigger.enabled ? "Disable" : "Enable"}
              </Button>
              {trigger.kind === "api" ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    invoke.mutate(
                      {
                        triggerId: trigger.id,
                        inputs: {},
                        idempotencyKey: idempotencyKey(),
                      },
                      {
                        onSuccess: (accepted) =>
                          setInvokedRun(accepted.run_id),
                        onError: (mutationError) =>
                          setError(errorMessage(mutationError)),
                      },
                    )
                  }
                >
                  Invoke
                </Button>
              ) : null}
              <Button
                variant="danger"
                onClick={() =>
                  remove.mutate(trigger.id, {
                    onError: (mutationError) =>
                      setError(errorMessage(mutationError)),
                  })
                }
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
