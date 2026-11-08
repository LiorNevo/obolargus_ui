import { useState } from "react";
import { useContextQuery } from "../../query/automationQueries";
import { useDeleteContextMutation } from "../../query/mutations";
import { errorMessage } from "./shared";

function renderValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Flow- and global-scope durable context for one flow. */
export function ContextPanel({ flowId }: { flowId: string }) {
  const context = useContextQuery(flowId);
  const clear = useDeleteContextMutation(flowId);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="obolargus_automation_panel" aria-label="Context">
      <header className="obolargus_automation_panel__header">
        <h2>Context</h2>
        <button
          type="button"
          onClick={() =>
            clear.mutate(undefined, {
              onError: (mutationError) =>
                setError(errorMessage(mutationError)),
            })
          }
          disabled={clear.isPending}
        >
          Clear flow context
        </button>
      </header>
      {error ? (
        <p className="obolargus_automation_error" role="alert">
          {error}
        </p>
      ) : null}
      {context.isPending ? <p>Loading context…</p> : null}
      {context.isError ? (
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(context.error)}
        </p>
      ) : null}
      {(["flow", "global"] as const).map((scope) => {
        const entries = Object.entries(context.data?.[scope] ?? {});
        return (
          <section key={scope} aria-label={`${scope} context`}>
            <h3>{scope === "flow" ? "Flow" : "Global"} scope</h3>
            {entries.length === 0 ? (
              <p>No keys in this scope.</p>
            ) : (
              <table className="obolargus_automation_table">
                <thead>
                  <tr>
                    <th scope="col">Key</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([key, value]) => (
                    <tr key={key}>
                      <td>
                        <code>{key}</code>
                      </td>
                      <td>
                        <code>{renderValue(value)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </section>
  );
}
