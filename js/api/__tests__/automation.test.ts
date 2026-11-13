import * as api from "../automation";
import { API_BASE_URL } from "../config";

const mockFetch = jest.fn();

function response(
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
) {
  const status = options.status ?? 200;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(text),
    headers: new Headers(options.headers ?? {}),
  };
}

function ok(body: unknown = { items: [] }, status = 200) {
  mockFetch.mockResolvedValueOnce(response(body, { status }));
}

function lastCall(): [string, RequestInit] {
  return mockFetch.mock.calls.at(-1) as [string, RequestInit];
}

beforeEach(() => {
  mockFetch.mockReset();
  (globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;
});

describe("automation API request plumbing", () => {
  it("loads catalogs and encodes path identifiers", async () => {
    ok({ items: [] });
    await api.fetchNodeTypes();
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/node-types`);

    ok({ items: [] });
    await api.fetchTemplates();
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/templates`);

    ok({ id: "template" });
    await api.fetchTemplate("with space/slash");
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/templates/with%20space%2Fslash`,
    );

    ok({ id: "flow" });
    await api.fetchFlow("a/b");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows/a%2Fb`);
  });

  it("builds flow list queries and omits empty parameters", async () => {
    ok({ items: [], total: 0, limit: 50, offset: 0 });
    await api.fetchFlows({
      status: "active",
      search: "sales ops",
      limit: 25,
      offset: 50,
    });
    const [url] = lastCall();
    expect(url).toBe(
      `${API_BASE_URL}/automation/flows?status=active&search=sales+ops&limit=25&offset=50`,
    );

    ok({ items: [], total: 0, limit: 50, offset: 0 });
    await api.fetchFlows();
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows`);
  });

  it("sends flow lifecycle mutations with the expected methods", async () => {
    const calls: Array<[() => Promise<unknown>, RequestInit, unknown]> = [
      [
        () => api.createFlow({ name: "Flow", tags: ["a"] }),
        { method: "POST", body: JSON.stringify({ name: "Flow", tags: ["a"] }) },
        { name: "Flow", tags: ["a"] },
      ],
      [
        () => api.updateFlow("f1", { name: "Renamed" }),
        { method: "PATCH", body: JSON.stringify({ name: "Renamed" }) },
        { name: "Renamed" },
      ],
      [() => api.archiveFlow("f1"), { method: "POST", body: "{}" }, {}],
      [() => api.restoreFlow("f1"), { method: "POST", body: "{}" }, {}],
      [() => api.deleteFlow("f1"), { method: "DELETE" }, undefined],
    ];
    for (const [call, expected, body] of calls) {
      mockFetch.mockResolvedValueOnce(
        response(body === undefined ? "" : body, {
          status: expected.method === "DELETE" ? 204 : 200,
        }),
      );
      await call();
      const [url, init] = lastCall();
      expect(url.startsWith(`${API_BASE_URL}/automation/flows`)).toBe(true);
      expect(init.method).toBe(expected.method);
      expect(init.body).toBe(expected.body);
    }
  });

  it("sends draft, validation, publish, version, and import calls", async () => {
    const flowJson = {
      schema_version: 1,
      name: "Flow",
      description: "",
      tags: [],
      inputs: [],
      nodes: [],
      wires: [],
      subflows: [],
    };
    ok({ revision: 2 });
    await api.saveDraft("f1", flowJson, 1);
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows/f1/draft`);
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      expected_revision: 1,
      flow_json: flowJson,
    });

    ok({ revision: 2 });
    await api.saveDraft("f1", flowJson);
    expect(JSON.parse(String(lastCall()[1].body)).expected_revision).toBeNull();

    ok({ valid: true });
    await api.validateFlow("f1", flowJson);
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows/f1/validate`);

    ok({ version_number: 1 });
    await api.publishFlow("f1", 2, "note");
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      expected_revision: 2,
      change_note: "note",
    });

    ok({ items: [] });
    await api.fetchVersions("f1", 10, 20);
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/flows/f1/versions?limit=10&offset=20`,
    );

    ok({ version_number: 1 });
    await api.fetchVersion("f1", 1);
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/flows/f1/versions/1`,
    );

    ok({ status: "archived" });
    await api.archiveVersion("f1", 1);
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/flows/f1/versions/1/archive`,
    );
    expect(lastCall()[1].method).toBe("POST");

    ok({ revision: 3 });
    await api.importFlow("f1", flowJson, false);
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      flow_json: flowJson,
      replace_draft: false,
    });
    ok({ revision: 3 });
    await api.importFlow("f1", flowJson);
    expect(JSON.parse(String(lastCall()[1].body)).replace_draft).toBe(true);
  });

  it("exports a version using the content-disposition filename", async () => {
    mockFetch.mockResolvedValueOnce(
      response("{}", {
        headers: { "content-disposition": 'attachment; filename="my-flow-v2.json"' },
      }),
    );
    const exported = await api.exportVersion("f1", 2);
    expect(exported).toEqual({ filename: "my-flow-v2.json", text: "{}" });

    mockFetch.mockResolvedValueOnce(response("{}"));
    const fallback = await api.exportVersion("f1", 3);
    expect(fallback.filename).toBe("flow-v3.json");

    mockFetch.mockResolvedValueOnce(
      response({}, { status: 404, headers: {} }),
    );
    await expect(api.exportVersion("f1", 4)).rejects.toMatchObject({
      status: 404,
      code: "request_failed",
      message: "export failed",
    });
  });

  it("builds run, node, message, log, and trigger calls", async () => {
    ok({ run_id: "r1" });
    await api.startRun("f1");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows/f1/runs`);
    expect(lastCall()[1].body).toBe("{}");

    ok({ run_id: "r1" });
    await api.startRun("f1", {
      inputs: { a: 1 },
      version_number: 2,
      inject_node_id: "n1",
    });
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      inputs: { a: 1 },
      version_number: 2,
      inject_node_id: "n1",
    });

    ok({ items: [] });
    await api.fetchRuns({
      flow_id: "f1",
      status: "failed",
      trigger_kind: "api",
      limit: 5,
      offset: 2,
    });
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/runs?flow_id=f1&status=failed&trigger_kind=api&limit=5&offset=2`,
    );
    ok({ items: [] });
    await api.fetchRuns();
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/runs`);

    ok({ id: "r1" });
    await api.fetchRun("r1");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/runs/r1`);

    ok({ node_id: "n1" });
    await api.fetchRunNode("r1", "n1");
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/runs/r1/nodes/n1`,
    );

    ok({ items: [] });
    await api.fetchRunMessages("r1", {
      node_id: "n1",
      direction: "out",
      after_id: 4,
      limit: 10,
    });
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/runs/r1/messages?node_id=n1&direction=out&after_id=4&limit=10`,
    );
    ok({ items: [] });
    await api.fetchRunMessages("r1");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/runs/r1/messages`);

    ok({ items: [] });
    await api.fetchRunLogs("r1", { node_id: "n1", after_id: 2, limit: 3 });
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/runs/r1/logs?node_id=n1&after_id=2&limit=3`,
    );
    ok({ items: [] });
    await api.fetchRunLogs("r1");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/runs/r1/logs`);

    ok({ id: "r1", status: "cancelled" });
    await api.cancelRun("r1");
    expect(lastCall()[1].method).toBe("POST");

    ok({ run_id: "r2" });
    await api.retryRun("r1");
    expect(lastCall()[1].method).toBe("POST");

    ok({ items: [] });
    await api.fetchTriggers("f1");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows/f1/triggers`);

    ok({ id: "t1" });
    await api.createTrigger("f1", { kind: "api", enabled: false });
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      kind: "api",
      enabled: false,
    });

    ok({ id: "t1" });
    await api.updateTrigger("t1", { enabled: true });
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/triggers/t1`);
    expect(lastCall()[1].method).toBe("PATCH");

    mockFetch.mockResolvedValueOnce(response("", { status: 204 }));
    await api.deleteTrigger("t1");
    expect(lastCall()[1].method).toBe("DELETE");

    ok({ run_id: "r1" });
    await api.invokeTrigger("t1", { inputs: { a: 1 } }, "idem-1");
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/triggers/t1/invoke`,
    );
    expect(lastCall()[1].headers).toMatchObject({
      "idempotency-key": "idem-1",
    });

    ok({ run_id: "r1" });
    await api.invokeTrigger("t1", { inputs: {} });
    expect(lastCall()[1].headers).toBeUndefined();
  });

  it("loads and deletes context and builds audit queries", async () => {
    ok({ flow: {}, global: {} });
    await api.fetchContext("f1");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows/f1/context`);

    mockFetch.mockResolvedValueOnce(response("", { status: 204 }));
    await api.deleteContext("f1");
    expect(lastCall()[1].method).toBe("DELETE");

    ok({ items: [] });
    await api.fetchAudit("f1", {
      action: "run.start",
      actor_id: "dev-user",
      limit: 10,
      offset: 5,
    });
    expect(lastCall()[0]).toBe(
      `${API_BASE_URL}/automation/flows/f1/audit?action=run.start&actor_id=dev-user&limit=10&offset=5`,
    );
    ok({ items: [] });
    await api.fetchAudit("f1");
    expect(lastCall()[0]).toBe(`${API_BASE_URL}/automation/flows/f1/audit`);
  });

  it("normalizes JSON, text, and empty error responses", async () => {
    mockFetch.mockResolvedValueOnce(
      response(
        { error: { code: "conflict", message: "draft exists", details: { a: 1 } } },
        { status: 409 },
      ),
    );
    await expect(api.fetchFlow("f1")).rejects.toMatchObject({
      name: "AutomationApiError",
      status: 409,
      code: "conflict",
      message: "draft exists",
      details: { a: 1 },
    });

    mockFetch.mockResolvedValueOnce(response("plain failure", { status: 500 }));
    await expect(api.fetchFlow("f1")).rejects.toMatchObject({
      status: 500,
      code: "request_failed",
      message: "plain failure",
    });

    mockFetch.mockResolvedValueOnce(response("", { status: 503 }));
    await expect(api.fetchFlow("f1")).rejects.toMatchObject({
      status: 503,
      code: "request_failed",
      message: "request failed with status 503",
    });

    mockFetch.mockResolvedValueOnce(
      response({ error: {} }, { status: 400 }),
    );
    await expect(api.fetchFlow("f1")).rejects.toMatchObject({
      status: 400,
      code: "request_failed",
      message: JSON.stringify({ error: {} }),
    });
  });
});
