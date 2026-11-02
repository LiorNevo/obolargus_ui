import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "../testUtils";
import { createTestQueryClient } from "../client";
import {
  useDomainsQuery,
  useHistoryDetailQuery,
  useHistoryQuery,
  useSourcesQuery,
} from "../dataLoadQueries";
import * as api from "../../api/dataLoad";
import type {
  DomainCatalog,
  HistoryDetail,
  HistoryPage,
  SourceCatalogResponse,
} from "../../types/dataLoad";

jest.mock("../../api/dataLoad", () => ({
  ...jest.requireActual("../../api/dataLoad"),
  fetchDomains: jest.fn(),
  fetchSources: jest.fn(),
  fetchHistory: jest.fn(),
  fetchHistoryDetail: jest.fn(),
}));

const mocked = api as jest.Mocked<typeof api>;

const DOMAINS: DomainCatalog = {
  domains: [
    {
      id: "market_data",
      label: "Market data",
      loadable: true,
      unavailable_reason: null,
    },
  ],
};

const SOURCES: SourceCatalogResponse = {
  domain: "market_data",
  sources: [],
};

const HISTORY: HistoryPage = {
  entries: [],
  total: 0,
  limit: 50,
  offset: 0,
};

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.fetchDomains.mockResolvedValue(DOMAINS);
  mocked.fetchSources.mockResolvedValue(SOURCES);
  mocked.fetchHistory.mockResolvedValue(HISTORY);
  mocked.fetchHistoryDetail.mockResolvedValue({} as HistoryDetail);
});

describe("data load query hooks", () => {
  it("deduplicates simultaneous domain reads and reuses a fresh entry", async () => {
    const client = createTestQueryClient();
    const pending = deferred<DomainCatalog>();
    mocked.fetchDomains.mockReturnValue(pending.promise);
    const wrapper = createQueryWrapper(client);
    const { result, unmount } = renderHook(
      () => [useDomainsQuery(), useDomainsQuery()] as const,
      { wrapper },
    );

    await waitFor(() => expect(mocked.fetchDomains).toHaveBeenCalledTimes(1));
    pending.resolve(DOMAINS);
    await waitFor(() => {
      expect(result.current[0].isSuccess).toBe(true);
      expect(result.current[1].isSuccess).toBe(true);
    });
    expect(result.current[0].data).toEqual(DOMAINS);
    expect(result.current[1].data).toEqual(DOMAINS);

    unmount();
    const again = renderHook(() => useDomainsQuery(), { wrapper });
    expect(again.result.current.data).toEqual(DOMAINS);
    expect(mocked.fetchDomains).toHaveBeenCalledTimes(1);
  });

  it("keeps separate source entries for different domains", async () => {
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);
    const { result, rerender } = renderHook(
      ({ domain }: { domain: "market_data" | "holdings" }) =>
        useSourcesQuery(domain),
      { wrapper, initialProps: { domain: "market_data" } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SOURCES);

    rerender({ domain: "holdings" });
    await waitFor(() => expect(mocked.fetchSources).toHaveBeenCalledTimes(2));
    expect(mocked.fetchSources).toHaveBeenNthCalledWith(
      2,
      "holdings",
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  it("keys history pages by filters and offset", async () => {
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);
    const { result, rerender } = renderHook(
      ({ offset }: { offset: number }) =>
        useHistoryQuery({ status: "complete" }, 50, offset),
      { wrapper, initialProps: { offset: 0 } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ offset: 50 });
    await waitFor(() => expect(mocked.fetchHistory).toHaveBeenCalledTimes(2));
    expect(mocked.fetchHistory).toHaveBeenNthCalledWith(
      2,
      { status: "complete" },
      50,
      50,
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  it("does not read detail without an entry id", async () => {
    const wrapper = createQueryWrapper(createTestQueryClient());
    const { result, rerender } = renderHook(
      ({ entryId }: { entryId: string | undefined }) =>
        useHistoryDetailQuery(entryId),
      { wrapper, initialProps: { entryId: undefined as string | undefined } },
    );

    expect(mocked.fetchHistoryDetail).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");

    rerender({ entryId: "entry-1" });
    await waitFor(() =>
      expect(mocked.fetchHistoryDetail).toHaveBeenCalledWith(
        "entry-1",
        expect.any(AbortSignal),
        expect.any(Function),
      ),
    );
  });

  it("reuses a fresh history detail entry", async () => {
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);
    const first = renderHook(() => useHistoryDetailQuery("entry-1"), {
      wrapper,
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useHistoryDetailQuery("entry-1"), {
      wrapper,
    });
    expect(second.result.current.data).toEqual({} as HistoryDetail);
    expect(mocked.fetchHistoryDetail).toHaveBeenCalledTimes(1);
  });
});
