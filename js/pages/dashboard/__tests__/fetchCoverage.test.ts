import { fetchCoverage } from "../fetchCoverage";
import type { CoverageWire } from "../../../types/chart";

function wire(): CoverageWire {
  return {
    asset_id: "asset-1",
    from: "2026-11-16",
    to: "2026-11-20",
    as_of: "2026-11-20T22:00:00Z",
    segments: [
      {
        mic: "XNAS",
        name: "Nasdaq",
        from: "2026-11-16",
        to: "2026-11-20",
        exact: true,
        reason: null,
      },
    ],
    expected_session_count: 5,
    missing_sessions: ["2026-11-18"],
    latest_completed_session: "2026-11-20",
  };
}

describe("fetchCoverage", () => {
  it("maps the wire response onto the chart contract", async () => {
    const coverage = await fetchCoverage(
      { loadCoverage: () => Promise.resolve(wire()) },
      "asset-1",
      { from: "2026-11-16", to: "2026-11-20" },
      { signal: new AbortController().signal },
    );
    expect(coverage).toMatchObject({
      assetId: "asset-1",
      expectedSessionCount: 5,
      missingSessions: ["2026-11-18"],
      latestCompletedSession: "2026-11-20",
    });
    expect(coverage.segments[0]).toMatchObject({ mic: "XNAS", exact: true });
  });

  it("rethrows an abort without wrapping it", async () => {
    const controller = new AbortController();
    controller.abort();
    const failure = new Error("aborted");
    await expect(
      fetchCoverage(
        { loadCoverage: () => Promise.reject(failure) },
        "asset-1",
        { from: "2026-11-16", to: "2026-11-20" },
        { signal: controller.signal },
      ),
    ).rejects.toBe(failure);
  });

  it("wraps a transport failure for the chart", async () => {
    await expect(
      fetchCoverage(
        { loadCoverage: () => Promise.reject(new Error("down")) },
        "asset-1",
        { from: "2026-11-16", to: "2026-11-20" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toBeInstanceOf(Error);
  });
});
