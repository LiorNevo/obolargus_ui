import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as automationApi from "../../api/automation";
import { assertOnlineForWrite } from "../../offline/assertOnlineForWrite";
import {
  useArchiveFlowMutation,
  useArchiveVersionMutation,
  useCancelRunMutation,
  useCreateFlowMutation,
  useCreateTriggerMutation,
  useDeleteContextMutation,
  useDeleteFlowMutation,
  useDeleteTriggerMutation,
  useImportFlowMutation,
  useInvokeTriggerMutation,
  usePublishFlowMutation,
  useRestoreFlowMutation,
  useRetryRunMutation,
  useSaveDraftMutation,
  useStartRunMutation,
  useUpdateFlowMutation,
  useUpdateTriggerMutation,
  useValidateFlowMutation,
} from "../mutations";

jest.mock("../../api/automation", () => ({
  createFlow: jest.fn().mockResolvedValue({}),
  updateFlow: jest.fn().mockResolvedValue({}),
  archiveFlow: jest.fn().mockResolvedValue({}),
  restoreFlow: jest.fn().mockResolvedValue({}),
  deleteFlow: jest.fn().mockResolvedValue(undefined),
  saveDraft: jest.fn().mockResolvedValue({ revision: 2 }),
  validateFlow: jest.fn().mockResolvedValue({ errors: [], warnings: [] }),
  publishFlow: jest.fn().mockResolvedValue({ version_number: 1 }),
  archiveVersion: jest.fn().mockResolvedValue({}),
  importFlow: jest.fn().mockResolvedValue({}),
  startRun: jest.fn().mockResolvedValue({ run_id: "r1" }),
  cancelRun: jest.fn().mockResolvedValue({ id: "r1" }),
  retryRun: jest.fn().mockResolvedValue({ run_id: "r2" }),
  createTrigger: jest.fn().mockResolvedValue({ id: "t1" }),
  updateTrigger: jest.fn().mockResolvedValue({ id: "t1" }),
  deleteTrigger: jest.fn().mockResolvedValue(undefined),
  invokeTrigger: jest.fn().mockResolvedValue({ run_id: "r1" }),
  deleteContext: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../offline/assertOnlineForWrite", () => ({
  assertOnlineForWrite: jest.fn(),
}));

const flow = {
  schema_version: 1,
  name: "Flow",
  description: "",
  tags: [],
  inputs: [],
  nodes: [],
  wires: [],
  subflows: [],
};

describe("automation mutations", () => {
  let client: QueryClient;
  let invalidate: jest.SpyInstance;
  let remove: jest.SpyInstance;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    invalidate = jest
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined as never);
    remove = jest.spyOn(client, "removeQueries");
  });

  it("covers flow lifecycle and metadata mutations", async () => {
    const create = renderHook(() => useCreateFlowMutation(), { wrapper });
    await act(async () => {
      await create.result.current.mutateAsync({ name: "New" });
    });
    expect(automationApi.createFlow).toHaveBeenCalledWith({ name: "New" });
    expect(invalidate).toHaveBeenCalled();

    const update = renderHook(() => useUpdateFlowMutation("f1"), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({ name: "Renamed" });
    });
    expect(automationApi.updateFlow).toHaveBeenCalledWith("f1", {
      name: "Renamed",
    });

    const archive = renderHook(() => useArchiveFlowMutation("f1"), { wrapper });
    await act(async () => {
      await archive.result.current.mutateAsync(undefined);
    });
    expect(automationApi.archiveFlow).toHaveBeenCalledWith("f1");

    const restore = renderHook(() => useRestoreFlowMutation("f1"), { wrapper });
    await act(async () => {
      await restore.result.current.mutateAsync(undefined);
    });
    expect(automationApi.restoreFlow).toHaveBeenCalledWith("f1");

    const removeHook = renderHook(() => useDeleteFlowMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await removeHook.result.current.mutateAsync(undefined);
    });
    expect(automationApi.deleteFlow).toHaveBeenCalledWith("f1");
    expect(remove).toHaveBeenCalled();

    const save = renderHook(() => useSaveDraftMutation("f1"), { wrapper });
    await act(async () => {
      await save.result.current.mutateAsync({ flow, expectedRevision: 1 });
    });
    expect(automationApi.saveDraft).toHaveBeenCalledWith("f1", flow, 1);

    const validate = renderHook(() => useValidateFlowMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await validate.result.current.mutateAsync({ flow });
    });
    expect(automationApi.validateFlow).toHaveBeenCalledWith("f1", flow);

    const publish = renderHook(() => usePublishFlowMutation("f1"), { wrapper });
    await act(async () => {
      await publish.result.current.mutateAsync({
        expectedRevision: 2,
        changeNote: "note",
      });
    });
    expect(automationApi.publishFlow).toHaveBeenCalledWith("f1", 2, "note");

    const archiveVersion = renderHook(() => useArchiveVersionMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await archiveVersion.result.current.mutateAsync(1);
    });
    expect(automationApi.archiveVersion).toHaveBeenCalledWith("f1", 1);

    const importHook = renderHook(() => useImportFlowMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await importHook.result.current.mutateAsync({ flowJson: flow });
    });
    expect(automationApi.importFlow).toHaveBeenCalledWith("f1", flow, true);
    await act(async () => {
      await importHook.result.current.mutateAsync({
        flowJson: flow,
        replaceDraft: false,
      });
    });
    expect(automationApi.importFlow).toHaveBeenLastCalledWith(
      "f1",
      flow,
      false,
    );
    expect(assertOnlineForWrite).toHaveBeenCalled();
  });

  it("covers run and trigger mutations", async () => {
    const start = renderHook(() => useStartRunMutation("f1"), { wrapper });
    await act(async () => {
      await start.result.current.mutateAsync({ inputs: { a: 1 } });
    });
    expect(automationApi.startRun).toHaveBeenCalledWith("f1", {
      inputs: { a: 1 },
    });

    const cancel = renderHook(() => useCancelRunMutation("r1"), { wrapper });
    await act(async () => {
      await cancel.result.current.mutateAsync(undefined);
    });
    expect(automationApi.cancelRun).toHaveBeenCalledWith("r1");

    const retry = renderHook(() => useRetryRunMutation("r1"), { wrapper });
    await act(async () => {
      await retry.result.current.mutateAsync(undefined);
    });
    expect(automationApi.retryRun).toHaveBeenCalledWith("r1");

    const createTrigger = renderHook(() => useCreateTriggerMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await createTrigger.result.current.mutateAsync(undefined);
    });
    expect(automationApi.createTrigger).toHaveBeenCalledWith("f1", {
      kind: "api",
    });

    const updateTrigger = renderHook(() => useUpdateTriggerMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await updateTrigger.result.current.mutateAsync({
        triggerId: "t1",
        enabled: false,
        overlap_policy: "skip",
        missed_policy: "run_once",
      });
    });
    expect(automationApi.updateTrigger).toHaveBeenCalledWith("t1", {
      enabled: false,
      overlap_policy: "skip",
      missed_policy: "run_once",
    });

    const deleteTrigger = renderHook(() => useDeleteTriggerMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await deleteTrigger.result.current.mutateAsync("t1");
    });
    expect(automationApi.deleteTrigger).toHaveBeenCalledWith("t1");

    const invoke = renderHook(() => useInvokeTriggerMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await invoke.result.current.mutateAsync({
        triggerId: "t1",
        inputs: { a: 1 },
        idempotencyKey: "key",
      });
    });
    expect(automationApi.invokeTrigger).toHaveBeenCalledWith(
      "t1",
      { inputs: { a: 1 } },
      "key",
    );
    await act(async () => {
      await invoke.result.current.mutateAsync({ triggerId: "t1" });
    });
    expect(automationApi.invokeTrigger).toHaveBeenLastCalledWith(
      "t1",
      { inputs: {} },
      undefined,
    );

    const deleteContext = renderHook(() => useDeleteContextMutation("f1"), {
      wrapper,
    });
    await act(async () => {
      await deleteContext.result.current.mutateAsync(undefined);
    });
    expect(automationApi.deleteContext).toHaveBeenCalledWith("f1");

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["automation", "flows", "f1", "triggers"],
      }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["automation", "runs", "list"],
      }),
    );
  });
});
