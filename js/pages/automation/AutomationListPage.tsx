import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Button } from "lx_client/js/components/Button";
import { Skeleton } from "lx_client/js/components/Skeleton";
import type { TemplateSummary } from "../../types/automation";
import {
  useFlowsQuery,
  useTemplatesQuery,
} from "../../query/automationQueries";
import {
  useArchiveFlowMutation,
  useCreateFlowMutation,
  useDeleteFlowMutation,
  useRestoreFlowMutation,
} from "../../query/mutations";
import { errorMessage, formatInstant, StatusBadge } from "./shared";
import "./automation.css";

const PAGE_SIZE = 20;

function TemplateGallery({
  templates,
  onCreate,
  creating,
}: {
  templates: TemplateSummary[];
  onCreate(templateId: string): void;
  creating: boolean;
}) {
  return (
    <section className="obolargus_automation_templates" aria-label="Templates">
      <h2>Start from a template</h2>
      <ul>
        {templates.map((template) => (
          <li key={template.id}>
            <article>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <p className="obolargus_automation_meta">
                {template.node_count} nodes · {template.category} · v
                {template.version}
              </p>
              <Button
                onClick={() => onCreate(template.id)}
                disabled={creating}
              >
                Use template
              </Button>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlowRowActions({
  flow,
  onError,
}: {
  flow: { id: string; name: string; status: string };
  onError(message: string): void;
}) {
  const archiveFlow = useArchiveFlowMutation(flow.id);
  const restoreFlow = useRestoreFlowMutation(flow.id);
  const deleteFlow = useDeleteFlowMutation(flow.id);
  return (
    <div className="obolargus_automation_row_actions">
      <Link to={`/automation/flows/${flow.id}`}>Open</Link>
      <Link to={`/automation/runs?flow_id=${encodeURIComponent(flow.id)}`}>
        Runs
      </Link>
      {flow.status === "archived" ? (
        <button
          type="button"
          onClick={() =>
            restoreFlow.mutate(undefined, {
              onError: (error) => onError(errorMessage(error)),
            })
          }
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            archiveFlow.mutate(undefined, {
              onError: (error) => onError(errorMessage(error)),
            })
          }
        >
          Archive
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              `Delete the flow "${flow.name}"? This cannot be undone.`,
            )
          ) {
            deleteFlow.mutate(undefined, {
              onError: (error) => onError(errorMessage(error)),
            });
          }
        }}
      >
        Delete
      </button>
    </div>
  );
}

/** The automation flow list and create-from-template surface. */
export default function AutomationListPage() {
  usePageTitle("Automation");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [page, setPage] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const flows = useFlowsQuery({
    search: search.trim() || undefined,
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const templates = useTemplatesQuery();
  const createFlow = useCreateFlowMutation();

  const total = flows.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = useMemo(() => flows.data?.items ?? [], [flows.data]);

  const create = async (templateId?: string) => {
    setActionError(null);
    try {
      const created = await createFlow.mutateAsync({
        name: templateId
          ? `${templates.data?.items.find((item) => item.id === templateId)?.name ?? "Automation"} copy`
          : name.trim() || "Untitled automation",
        template_id: templateId,
      });
      setName("");
      navigate(`/automation/flows/${created.id}`);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  return (
    <main className="obolargus_automation_page" aria-labelledby="automation-title">
      <header className="obolargus_automation_header">
        <div>
          <h1 id="automation-title">Automation</h1>
          <p>
            Design low-code flows, run them on demand, and schedule the
            recurring ones.
          </p>
        </div>
        <div className="obolargus_automation_header__actions">
          <label>
            <span className="obolargus_visually_hidden">New flow name</span>
            <input
              value={name}
              placeholder="New flow name"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <Button onClick={() => void create()} disabled={createFlow.isPending}>
            {createFlow.isPending ? "Creating…" : "Create blank flow"}
          </Button>
        </div>
      </header>

      {actionError ? (
        <p className="obolargus_automation_error" role="alert">
          {actionError}
        </p>
      ) : null}

      <section aria-label="Filters" className="obolargus_automation_filters">
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search flows"
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </section>

      {templates.isSuccess && templates.data.items.length > 0 ? (
        <TemplateGallery
          templates={templates.data.items}
          onCreate={(templateId) => void create(templateId)}
          creating={createFlow.isPending}
        />
      ) : null}

      <section aria-label="Flows">
        <h2>Flows</h2>
        {flows.isPending ? <Skeleton /> : null}
        {flows.isError ? (
          <p className="obolargus_automation_error" role="alert">
            {errorMessage(flows.error)}
          </p>
        ) : null}
        {flows.isSuccess && items.length === 0 ? (
          <p>No flows match the filters.</p>
        ) : null}
        {items.length > 0 ? (
          <table className="obolargus_automation_table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Last run</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((flow) => (
                <tr key={flow.id}>
                  <td>
                    <Link to={`/automation/flows/${flow.id}`}>{flow.name}</Link>
                    {flow.description ? (
                      <p className="obolargus_automation_meta">
                        {flow.description}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge status={flow.status} />
                  </td>
                  <td>{flow.current_version_number ?? "—"}</td>
                  <td>
                    {flow.last_run ? (
                      <Link to={`/automation/runs/${flow.last_run.id}`}>
                        {flow.last_run.status}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatInstant(flow.updated_at)}</td>
                  <td>
                    <FlowRowActions flow={flow} onError={setActionError} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {pages > 1 ? (
          <nav aria-label="Flow pages" className="obolargus_automation_pager">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
