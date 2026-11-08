import { Link, useSearchParams } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Skeleton } from "lx_client/js/components/Skeleton";
import { useRunsQuery } from "../../query/automationQueries";
import {
  errorMessage,
  formatDuration,
  formatInstant,
  StatusBadge,
} from "./shared";
import "./automation.css";

const PAGE_SIZE = 25;
const TERMINAL = new Set([
  "succeeded",
  "partial",
  "failed",
  "cancelled",
  "interrupted",
]);

/** Run history with flow and status filters. */
export default function RunListPage() {
  usePageTitle("Automation runs");
  const [params, setParams] = useSearchParams();
  const flowId = params.get("flow_id") ?? undefined;
  const status = params.get("status") ?? undefined;
  const page = Math.max(0, Number(params.get("page") ?? "0") || 0);

  const runs = useRunsQuery({
    flow_id: flowId,
    status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const total = runs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="obolargus_automation_page" aria-labelledby="runs-title">
      <header className="obolargus_automation_header">
        <div>
          <h1 id="runs-title">Automation runs</h1>
          <p>Every manual, scheduled, and API-triggered execution.</p>
        </div>
        <Link to="/automation">Back to automation</Link>
      </header>

      <section className="obolargus_automation_filters" aria-label="Filters">
        <label>
          <span>Status</span>
          <select
            value={status ?? ""}
            onChange={(event) => setParam("status", event.target.value)}
          >
            <option value="">All</option>
            {[...TERMINAL, "queued", "running"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {flowId ? (
          <button type="button" onClick={() => setParam("flow_id", "")}>
            Clear flow filter
          </button>
        ) : null}
      </section>

      {runs.isPending ? <Skeleton /> : null}
      {runs.isError ? (
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(runs.error)}
        </p>
      ) : null}
      {runs.isSuccess && (runs.data.items.length === 0 ? (
        <p>No runs match the filters.</p>
      ) : (
        <table className="obolargus_automation_table">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Flow</th>
              <th scope="col">Trigger</th>
              <th scope="col">Status</th>
              <th scope="col">Started</th>
              <th scope="col">Duration</th>
              <th scope="col">Messages</th>
            </tr>
          </thead>
          <tbody>
            {runs.data.items.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link to={`/automation/runs/${run.id}`}>
                    {run.id.slice(0, 8)}
                  </Link>
                </td>
                <td>
                  <Link to={`/automation/flows/${run.flow_id}`}>
                    {run.flow_name}
                  </Link>
                  {run.flow_version_number ? (
                    <span className="obolargus_automation_meta">
                      {" "}
                      v{run.flow_version_number}
                    </span>
                  ) : null}
                </td>
                <td>{run.trigger_kind}</td>
                <td>
                  <StatusBadge status={run.status} />
                </td>
                <td>{formatInstant(run.started_at ?? run.queued_at)}</td>
                <td>{formatDuration(run.duration_ms)}</td>
                <td>{run.message_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {pages > 1 ? (
        <nav aria-label="Run pages" className="obolargus_automation_pager">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setParam("page", String(page - 1))}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pages}
            onClick={() => setParam("page", String(page + 1))}
          >
            Next
          </button>
        </nav>
      ) : null}
    </main>
  );
}
