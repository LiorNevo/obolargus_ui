import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Skeleton } from "lx_client/js/components/Skeleton";
import {
  useRunEvents,
  useRunLogsQuery,
  useRunMessagesQuery,
  useRunQuery,
} from "../../query/automationQueries";
import { useCancelRunMutation, useRetryRunMutation } from "../../query/mutations";
import { DataLoadReportView } from "./DataLoadReportView";
import {
  errorMessage,
  formatDuration,
  formatInstant,
  StatusBadge,
} from "./shared";
import "./automation.css";

const TERMINAL = new Set([
  "succeeded",
  "partial",
  "failed",
  "cancelled",
  "interrupted",
]);

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Run detail with a node timeline, messages, logs, and the live SSE feed. */
export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const run = useRunQuery(runId);
  const [nodeFilter, setNodeFilter] = useState<string | undefined>(undefined);
  const messages = useRunMessagesQuery(runId, nodeFilter);
  const logs = useRunLogsQuery(runId);
  const cancel = useCancelRunMutation(runId ?? "");
  const retry = useRetryRunMutation(runId ?? "");
  const [error, setError] = useState<string | null>(null);
  useRunEvents(runId, run.data ? !TERMINAL.has(run.data.status) : true);

  usePageTitle(
    run.data ? `Run ${run.data.id.slice(0, 8)}` : "Automation run",
  );

  const dataLoadPayload = useMemo(() => {
    const dataLoadNodes = new Set(
      (run.data?.nodes ?? [])
        .filter((node) => node.node_type_id.startsWith("data_load"))
        .map((node) => node.node_id),
    );
    const output = messages.data?.items.find(
      (message) =>
        message.direction === "out" &&
        message.node_id !== null &&
        dataLoadNodes.has(message.node_id) &&
        message.payload &&
        typeof message.payload === "object" &&
        "payload" in (message.payload as Record<string, unknown>),
    );
    if (!output) return null;
    return (output.payload as { payload: unknown }).payload;
  }, [messages.data, run.data]);

  if (run.isPending) {
    return (
      <main className="obolargus_automation_page">
        <Skeleton />
      </main>
    );
  }
  if (run.isError || !run.data) {
    return (
      <main className="obolargus_automation_page">
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(run.error)}
        </p>
        <Link to="/automation/runs">Back to runs</Link>
      </main>
    );
  }

  const terminal = TERMINAL.has(run.data.status);

  return (
    <main className="obolargus_automation_page" aria-labelledby="run-title">
      <header className="obolargus_automation_header">
        <div>
          <p className="obolargus_automation_meta">
            <Link to="/automation/runs">Runs</Link> /{" "}
            <Link to={`/automation/flows/${run.data.flow_id}`}>
              {run.data.flow_id.slice(0, 8)}
            </Link>
          </p>
          <h1 id="run-title">
            Run {run.data.id.slice(0, 8)} <StatusBadge status={run.data.status} />
          </h1>
          <p className="obolargus_automation_meta">
            {run.data.trigger_kind} · version{" "}
            {run.data.flow_version_number ?? "—"} · started{" "}
            {formatInstant(run.data.started_at)} ·{" "}
            {formatDuration(run.data.duration_ms)}
          </p>
        </div>
        <div className="obolargus_automation_header__actions">
          <button
            type="button"
            disabled={terminal || cancel.isPending}
            onClick={() =>
              cancel.mutate(undefined, {
                onError: (mutationError) =>
                  setError(errorMessage(mutationError)),
              })
            }
          >
            Cancel run
          </button>
          <button
            type="button"
            disabled={!terminal || retry.isPending}
            onClick={() =>
              retry.mutate(undefined, {
                onError: (mutationError) =>
                  setError(errorMessage(mutationError)),
              })
            }
          >
            Retry
          </button>
        </div>
      </header>

      {error ? (
        <p className="obolargus_automation_error" role="alert">
          {error}
        </p>
      ) : null}
      {run.data.error ? (
        <section className="obolargus_automation_error" role="alert">
          <h2>Terminal error</h2>
          <pre>{pretty(run.data.error)}</pre>
        </section>
      ) : null}

      <div className="obolargus_automation_run_grid">
        <section className="obolargus_automation_panel" aria-label="Node timeline">
          <h2>Nodes</h2>
          <ol className="obolargus_automation_timeline">
            {run.data.nodes.map((node) => (
              <li key={`${node.node_id}:${node.attempt}`}>
                <button
                  type="button"
                  aria-pressed={nodeFilter === node.node_id}
                  onClick={() =>
                    setNodeFilter((current) =>
                      current === node.node_id ? undefined : node.node_id,
                    )
                  }
                >
                  <strong>{node.node_id}</strong>
                  <span className="obolargus_automation_meta">
                    {node.node_type_id}@{node.node_type_version} · attempt{" "}
                    {node.attempt} · <StatusBadge status={node.status} /> ·{" "}
                    {formatDuration(node.duration_ms)} · in {node.messages_in} /
                    out {node.messages_out}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="obolargus_automation_panel" aria-label="Messages">
          <header className="obolargus_automation_panel__header">
            <h2>Messages</h2>
            {nodeFilter ? (
              <button type="button" onClick={() => setNodeFilter(undefined)}>
                Clear node filter
              </button>
            ) : null}
          </header>
          {messages.isPending ? <p>Loading messages…</p> : null}
          {messages.isError ? (
            <p className="obolargus_automation_error" role="alert">
              {errorMessage(messages.error)}
            </p>
          ) : null}
          {messages.isSuccess && messages.data.items.length === 0 ? (
            <p>No messages recorded.</p>
          ) : null}
          <ul className="obolargus_automation_messages">
            {messages.data?.items.map((message) => (
              <li key={message.id}>
                <p className="obolargus_automation_meta">
                  {message.direction} · {message.node_id ?? "run"} ·{" "}
                  {message.output_port ?? ""} · {formatInstant(message.ts)} ·{" "}
                  {message.size_bytes} bytes
                  {message.truncated ? " · truncated" : ""}
                </p>
                <pre>
                  {message.truncated
                    ? "payload omitted because it exceeds the size limit"
                    : pretty(message.payload)}
                </pre>
              </li>
            ))}
          </ul>
        </section>

        <section className="obolargus_automation_panel" aria-label="Run logs">
          <h2>Logs</h2>
          {logs.isPending ? <p>Loading logs…</p> : null}
          {logs.isSuccess && logs.data.items.length === 0 ? (
            <p>No log entries.</p>
          ) : null}
          <ul className="obolargus_automation_logs">
            {logs.data?.items.map((entry) => (
              <li key={entry.id}>
                <span className="obolargus_automation_meta">
                  {formatInstant(entry.ts)} · {entry.level} ·{" "}
                  {entry.node_id ?? "run"}
                </span>
                <p>{entry.message}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {dataLoadPayload ? (
        <section className="obolargus_automation_panel" aria-label="Data-load report">
          <DataLoadReportView payload={dataLoadPayload} />
        </section>
      ) : null}
    </main>
  );
}
