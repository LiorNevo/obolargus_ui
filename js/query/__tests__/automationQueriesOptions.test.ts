import {
  auditQueryOptions,
  contextQueryOptions,
  flowListQueryOptions,
  flowQueryOptions,
  nodeTypesQueryOptions,
  runListQueryOptions,
  runLogsQueryOptions,
  runMessagesQueryOptions,
  runQueryOptions,
  templateQueryOptions,
  templatesQueryOptions,
  triggersQueryOptions,
  versionQueryOptions,
  versionsQueryOptions,
} from "../automationQueries";
import * as api from "../../api/automation";

jest.mock("../../api/automation", () => ({
  fetchAudit: jest.fn().mockResolvedValue({ items: [] }),
  fetchContext: jest.fn().mockResolvedValue({ flow: {}, global: {} }),
  fetchFlow: jest.fn().mockResolvedValue({ id: "f1" }),
  fetchFlows: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  fetchNodeTypes: jest.fn().mockResolvedValue({ items: [] }),
  fetchRun: jest.fn().mockResolvedValue({ id: "r1" }),
  fetchRunLogs: jest.fn().mockResolvedValue({ items: [] }),
  fetchRunMessages: jest.fn().mockResolvedValue({ items: [] }),
  fetchRuns: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  fetchTemplate: jest.fn().mockResolvedValue({ id: "t1" }),
  fetchTemplates: jest.fn().mockResolvedValue({ items: [] }),
  fetchTriggers: jest.fn().mockResolvedValue({ items: [] }),
  fetchVersion: jest.fn().mockResolvedValue({ version_number: 2 }),
  fetchVersions: jest.fn().mockResolvedValue({ items: [] }),
}));

const context = {} as never;

describe("automation query options", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads catalogs and templates through their query functions", async () => {
    await nodeTypesQueryOptions().queryFn?.(context);
    expect(api.fetchNodeTypes).toHaveBeenCalledTimes(1);

    await templatesQueryOptions().queryFn?.(context);
    expect(api.fetchTemplates).toHaveBeenCalledTimes(1);

    await templateQueryOptions("t1").queryFn?.(context);
    expect(api.fetchTemplate).toHaveBeenCalledWith("t1");
    expect(() => templateQueryOptions(undefined).queryFn?.(context)).toThrow(
      /template id/i,
    );
  });

  it("loads flow lists, flows, versions, audit, context, and triggers", async () => {
    const params = { status: "active", search: "x", limit: 10, offset: 5 };
    await flowListQueryOptions(params).queryFn?.(context);
    expect(api.fetchFlows).toHaveBeenCalledWith(params);

    await flowQueryOptions("f1").queryFn?.(context);
    expect(api.fetchFlow).toHaveBeenCalledWith("f1");
    expect(() => flowQueryOptions(undefined).queryFn?.(context)).toThrow(
      /flow id/i,
    );

    await versionsQueryOptions("f1").queryFn?.(context);
    expect(api.fetchVersions).toHaveBeenCalledWith("f1");

    await versionQueryOptions("f1", 2).queryFn?.(context);
    expect(api.fetchVersion).toHaveBeenCalledWith("f1", 2);
    expect(() =>
      versionQueryOptions(undefined, undefined).queryFn?.(context),
    ).toThrow(/version/i);

    await auditQueryOptions("f1").queryFn?.(context);
    expect(api.fetchAudit).toHaveBeenCalledWith("f1");

    await contextQueryOptions("f1").queryFn?.(context);
    expect(api.fetchContext).toHaveBeenCalledWith("f1");

    await triggersQueryOptions("f1").queryFn?.(context);
    expect(api.fetchTriggers).toHaveBeenCalledWith("f1");
  });

  it("loads run lists, runs, messages, and logs", async () => {
    const params = { flow_id: "f1", status: "running", limit: 10, offset: 0 };
    await runListQueryOptions(params).queryFn?.(context);
    expect(api.fetchRuns).toHaveBeenCalledWith(params);

    await runQueryOptions("r1").queryFn?.(context);
    expect(api.fetchRun).toHaveBeenCalledWith("r1");

    await runMessagesQueryOptions("r1", "n1").queryFn?.(context);
    expect(api.fetchRunMessages).toHaveBeenCalledWith("r1", { node_id: "n1" });

    await runLogsQueryOptions("r1").queryFn?.(context);
    expect(api.fetchRunLogs).toHaveBeenCalledWith("r1");
  });
});
