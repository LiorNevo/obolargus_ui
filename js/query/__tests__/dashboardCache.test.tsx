import { createTestQueryClient } from "../client";
import { readThroughCache } from "../dashboardCache";
import { queryKeys } from "../keys";

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

describe("cached read bridge", () => {
  it("shares one request and survives one consumer aborting", async () => {
    const client = createTestQueryClient();
    const pending = deferred<string>();
    let calls = 0;
    const options = {
      queryKey: queryKeys.dataLoad.domains(),
      queryFn: () => {
        calls += 1;
        return pending.promise;
      },
      staleTime: 60_000,
    };
    const first = new AbortController();
    const second = new AbortController();

    const firstRead = readThroughCache(client, options, first.signal);
    const secondRead = readThroughCache(client, options, second.signal);
    first.abort();

    await expect(firstRead).rejects.toMatchObject({ name: "AbortError" });
    pending.resolve("shared");
    await expect(secondRead).resolves.toBe("shared");
    expect(calls).toBe(1);

    await expect(
      readThroughCache(client, options, new AbortController().signal),
    ).resolves.toBe("shared");
    expect(calls).toBe(1);
  });

  it("cancels the transport when the last consumer aborts", async () => {
    const client = createTestQueryClient();
    let observedSignal: AbortSignal | undefined;
    const options = {
      queryKey: queryKeys.dataLoad.sources("market_data"),
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        observedSignal = signal;
        return new Promise<string>(() => undefined);
      },
    };
    const controller = new AbortController();

    const read = readThroughCache(client, options, controller.signal);
    controller.abort();

    await expect(read).rejects.toMatchObject({ name: "AbortError" });
    expect(observedSignal?.aborted).toBe(true);
  });
});
