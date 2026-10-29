import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function firstOfMonthLabel(): string {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return `${WEEKDAYS[first.getDay()]}, ${MONTHS[first.getMonth()]} ${first.getDate()}, ${first.getFullYear()}`;
}

/**
 * Counts table renders so the test can prove that changing the draft date does
 * not re-render memoized page sections such as the source catalog.
 */
jest.mock("lx_client/js/components/Table", () => ({
  Table: () => {
    const store = globalThis as { __tableRenders?: number };
    store.__tableRenders = (store.__tableRenders ?? 0) + 1;
    return <div data-testid="table-stub" />;
  },
}));

jest.mock("../../api/dataLoad", () => {
  const actual = jest.requireActual("../../api/dataLoad");
  return {
    ...actual,
    fetchDomains: jest.fn(),
    fetchSources: jest.fn(),
    fetchHistory: jest.fn(),
    fetchHistoryDetail: jest.fn(),
    fetchProgress: jest.fn(),
    toggleSource: jest.fn(),
    loadOnce: jest.fn(),
    loadRange: jest.fn(),
  };
});

import { DataLoadPage } from "../DataLoadPage";
import { useDataLoadStore } from "../../store/dataLoadStore";
import * as api from "../../api/dataLoad";

const mocked = api as jest.Mocked<typeof api>;

function renderPage() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/data-load"]}>{children}</MemoryRouter>
  );
  return render(<DataLoadPage />, { wrapper });
}

function tableRenders(): number {
  return (globalThis as { __tableRenders?: number }).__tableRenders ?? 0;
}

beforeEach(() => {
  useDataLoadStore.getState().reset();
  (globalThis as { __tableRenders?: number }).__tableRenders = 0;
  mocked.fetchDomains.mockResolvedValue({
    domains: [
      {
        id: "market_data",
        label: "Market & reference data",
        loadable: true,
        unavailable_reason: null,
      },
    ],
  });
  mocked.fetchSources.mockResolvedValue({
    domain: "market_data",
    sources: [
      {
        source_id: "yahoo_finance",
        display_name: "Yahoo Finance",
        enabled: true,
        priority: 1,
        supported_schemes: ["TICKER"],
        supported_data_domains: ["market_data"],
        selectable_for_domain: true,
        unavailable_reason: null,
      },
    ],
  });
  mocked.fetchHistory.mockResolvedValue({
    entries: [],
    total: 0,
    limit: 50,
    offset: 0,
  });
});

afterEach(() => jest.clearAllMocks());

describe("DataLoadPage render isolation", () => {
  it("does not re-render the source table when the date changes", async () => {
    const user = userEvent.setup();
    renderPage();

    const sources = await screen.findByRole("region", { name: "Sources" });
    await waitFor(() =>
      expect(
        within(sources).getByRole("button", { name: "Refresh" }),
      ).toBeEnabled(),
    );
    const before = tableRenders();
    expect(before).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "As-of date (UTC)" }),
    );
    const day = firstOfMonthLabel();
    fireEvent.click(screen.getByRole("gridcell", { name: day }));

    expect(tableRenders()).toBe(before);
  });
});
