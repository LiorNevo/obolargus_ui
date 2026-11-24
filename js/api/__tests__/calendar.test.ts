import {
  createCalendarAssignment,
  deleteCalendarAssignment,
  fetchAssignments,
  fetchCalendarDetail,
  fetchCalendarExport,
  fetchCalendarList,
  importCalendar,
  retireCalendar,
} from "../calendar";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("calendar API client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reads the list, detail, and export documents", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ calendars: [] }))
      .mockResolvedValueOnce(jsonResponse({ calendar: { mic: "XNAS" } }))
      .mockResolvedValueOnce(jsonResponse({ mic: "XNAS" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchCalendarList()).resolves.toEqual({ calendars: [] });
    await expect(fetchCalendarDetail("XNAS")).resolves.toEqual({
      calendar: { mic: "XNAS" },
    });
    await expect(fetchCalendarExport("XNAS")).resolves.toEqual({ mic: "XNAS" });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/market-data/calendars");
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "/market-data/calendars/XNAS",
    );
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      "/market-data/calendars/XNAS/export",
    );
  });

  it("writes imports, assignments, retire, and deletes", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ summary: "ok", changed: true }))
      .mockResolvedValueOnce(jsonResponse({ summary: "ok", changed: true }))
      .mockResolvedValueOnce(jsonResponse({ assignments: [], total: 0 }))
      .mockResolvedValueOnce(jsonResponse({ id: "assignment-1" }))
      .mockResolvedValueOnce(jsonResponse({ removed: true }))
      .mockResolvedValueOnce(jsonResponse({ affected_count: 0 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await importCalendar({ mic: "XNAS" } as never, 2);
    await importCalendar({ mic: "XNAS" } as never, null);
    await fetchAssignments({ assetId: "asset-1", mic: "XNAS" });
    await createCalendarAssignment({
      asset_id: "asset-1",
      mic: "XNAS",
      valid_from: "2020-01-01",
      valid_to: null,
    });
    await deleteCalendarAssignment("assignment-1");
    await retireCalendar("XNAS", true);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toContain("expected_version=2");
    expect(urls[1]).not.toContain("expected_version");
    expect(urls[2]).toContain("asset_id=asset-1");
    expect(urls[2]).toContain("mic=XNAS");
    expect(urls[3]).toContain("/market-data/calendar-assignments");
    expect(urls[4]).toContain("/market-data/calendar-assignments/assignment-1");
    expect(urls[5]).toContain("/market-data/calendars/XNAS/retire");
  });

  it("surfaces a non-2xx body", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse("calendar unavailable", 503)) as unknown as typeof fetch;

    await expect(fetchCalendarList()).rejects.toThrow("calendar unavailable");
  });
});
