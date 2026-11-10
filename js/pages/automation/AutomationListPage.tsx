import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Button } from "lx_client/js/components/Button";
import { Input } from "lx_client/js/components/Input";
import { MultiSelect } from "lx_client/js/components/MultiSelect";
import type { SelectOption } from "lx_client/js/components/MultiSelect/types";
import { Skeleton } from "lx_client/js/components/Skeleton";
import { Table } from "lx_client/js/components/Table";
import type { TableColumnDef } from "lx_client/js/components/Table/types";
import { Toast, ToastRegion } from "lx_client/js/components/Toast";
import type { FlowSummary, TemplateSummary } from "../../types/automation";
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

const STATUS_OPTIONS: SelectOption[] = [
  { id: 0, label: "All", value: "" },
  { id: 1, label: "Active", value: "active" },
  { id: 2, label: "Archived", value: "archived" },
];

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
        <Button
          variant="ghost"
          onClick={() =>
            restoreFlow.mutate(undefined, {
              onError: (error) => onError(errorMessage(error)),
            })
          }
        >
          Restore
        </Button>
      ) : (
        <Button
          variant="ghost"
          onClick={() =>
            archiveFlow.mutate(undefined, {
              onError: (error) => onError(errorMessage(error)),
            })
          }
        >
          Archive
        </Button>
      )}
      <Button
        variant="danger"
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
      </Button>
    </div>
  );
}

/** The automation flow list and create-from-template surface. */
export default function AutomationListPage() {
  usePageTitle("Automation");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      document.getElementById("new-flow-name")?.focus();
    }
  }, [searchParams]);

  const total = flows.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = useMemo(() => flows.data?.items ?? [], [flows.data]);

  const flowColumns = useMemo<TableColumnDef<FlowSummary>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <>
            <Link to={`/automation/flows/${row.original.id}`}>
              {row.original.name}
            </Link>
            {row.original.description ? (
              <p className="obolargus_automation_meta">
                {row.original.description}
              </p>
            ) : null}
          </>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "version",
        header: "Version",
        cell: ({ row }) => row.original.current_version_number ?? "—",
      },
      {
        id: "lastRun",
        header: "Last run",
        cell: ({ row }) =>
          row.original.last_run ? (
            <Link to={`/automation/runs/${row.original.last_run.id}`}>
              {row.original.last_run.status}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        id: "updated",
        header: "Updated",
        cell: ({ row }) => formatInstant(row.original.updated_at),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <FlowRowActions flow={row.original} onError={setActionError} />
        ),
      },
    ],
    [],
  );

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
          <Input
            id="new-flow-name"
            label="New flow name"
            value={name}
            placeholder="New flow name"
            onChange={setName}
          />
          <Button onClick={() => void create()} disabled={createFlow.isPending}>
            {createFlow.isPending ? "Creating…" : "Create blank flow"}
          </Button>
        </div>
      </header>

      {actionError ? (
        <ToastRegion>
          <Toast
            tone="error"
            title="Action failed"
            onClose={() => setActionError(null)}
          >
            {actionError}
          </Toast>
        </ToastRegion>
      ) : null}

      <section aria-label="Filters" className="obolargus_automation_filters">
        <Input
          id="flow-search"
          label="Search"
          type="search"
          value={search}
          onChange={(next) => {
            setSearch(next);
            setPage(0);
          }}
          placeholder="Search flows"
        />
        <div className="obolargus_automation_field">
          <span className="obolargus_automation_field-label">Status</span>
          <MultiSelect
            options={STATUS_OPTIONS}
            value={STATUS_OPTIONS.filter((option) => option.value === status)}
            mode="single"
            ariaLabel="Status"
            placeholder="All"
            onChange={(next) => {
              setStatus(next[0]?.value ?? "");
              setPage(0);
            }}
          />
        </div>
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
          <Table
            tableKey="automation-flows"
            columns={flowColumns}
            data={items}
            enableSorting={false}
            enableFiltering={false}
            enablePagination={false}
            enableColumnCustomization={false}
          />
        ) : null}
        {pages > 1 ? (
          <nav aria-label="Flow pages" className="obolargus_automation_pager">
            <Button
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <Button
              disabled={page + 1 >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
