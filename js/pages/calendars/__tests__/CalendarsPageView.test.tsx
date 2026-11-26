import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { CalendarsPageView } from "../CalendarsPageView";
import { useAuthStore } from "../../../auth/store";

jest.mock("lx_client/js/components/CodeInput", () => ({
  CodeInput: ({
    id,
    label,
    value,
    onChange,
    language,
    disabled,
    errors = [],
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    language?: string;
    disabled?: boolean;
    errors?: string[];
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        data-language={language}
        onChange={(event) => onChange(event.target.value)}
      />
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  ),
}));

const mockCalendar = {
  mic: "XNAS",
  name: "Nasdaq",
  time_zone: "America/New_York",
  coverage_from: "2016-01-01",
  coverage_to: "2028-12-31",
  source: "bundled",
  provenance: "Seed 1",
  version: 1,
  active: true,
  updated_by: "system",
  updated_at: "2026-11-24T10:00:00Z",
  assigned_asset_count: 2,
  resolved_asset_count: 3,
  exception_count: 152,
};

jest.mock("../../../query/calendarQueries", () => ({
  useCalendarListQuery: () => ({
    isPending: false,
    isError: false,
    data: { calendars: [mockCalendar] },
  }),
  useCalendarDetailQuery: () => ({
    isPending: false,
    isError: false,
    data: {
      calendar: {
        ...mockCalendar,
        weekdays: [{ iso_weekday: 1, open: "09:30", close: "16:00" }],
        exceptions: [
          {
            date: "2026-11-26",
            kind: "closure",
            open: null,
            close: null,
            reason: "Thanksgiving",
          },
        ],
      },
      assigned_asset_count: 2,
      resolved_asset_count: 3,
      audit: [],
    },
  }),
  useCalendarAssignmentsQuery: () => ({
    isPending: false,
    data: {
      assignments: [
        {
          id: "assignment-1",
          asset_id: "asset-1",
          asset_display_name: "Apple",
          asset_identifier: "TICKER:XNAS:AAPL",
          mic: "XNAS",
          valid_from: "2020-01-01",
          valid_to: null,
          source: "operator",
          created_by: "owner",
          created_at: "2026-11-24T10:00:00Z",
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    },
  }),
}));

const mockImportMutate = jest.fn();
const mockRetireMutate = jest.fn();
const mockCreateMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockExport = jest.fn();

jest.mock("../../../query/mutations", () => ({
  useImportCalendarMutation: () => ({ mutate: mockImportMutate, isPending: false }),
  useRetireCalendarMutation: () => ({ mutate: mockRetireMutate, isPending: false }),
  useCreateAssignmentMutation: () => ({ mutate: mockCreateMutate, isPending: false }),
  useDeleteAssignmentMutation: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

jest.mock("../../../api/calendar", () => ({
  fetchCalendarExport: (...args: unknown[]) => mockExport(...args),
}));

function resetAuth(): void {
  useAuthStore.setState({
    status: "signedOut",
    actor: null,
    accessToken: null,
    refreshToken: null,
    error: null,
  });
}

describe("CalendarsPageView", () => {
  beforeEach(resetAuth);

  it("lists calendars and shows the selected detail read-only", async () => {
    const user = userEvent.setup();
    render(<CalendarsPageView />);

    expect(screen.getByRole("heading", { name: "Exchange calendars" })).toBeInTheDocument();
    expect(screen.getByText("XNAS")).toBeInTheDocument();
    expect(screen.getByText(/Read-only: calendar changes/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "XNAS" }));
    expect(screen.getByText("Nasdaq")).toBeInTheDocument();
    expect(screen.getByText("America/New_York")).toBeInTheDocument();
    expect(screen.getByText("TICKER:XNAS:AAPL · 2020-01-01 to open")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retire" })).toBeNull();
  });

  it("shows write controls to the primary owner", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      status: "signedIn",
      actor: {
        id: "owner",
        email: "owner@example.com",
        isPrimaryOwner: true,
      },
      accessToken: "token",
      refreshToken: "refresh",
      error: null,
    });
    render(<CalendarsPageView />);
    await user.click(screen.getByRole("button", { name: "XNAS" }));
    expect(screen.getByRole("button", { name: "Retire" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save calendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<CalendarsPageView />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

function signInAsOwner(): void {
  useAuthStore.setState({
    status: "signedIn",
    actor: { id: "owner", email: "owner@example.com", isPrimaryOwner: true },
    accessToken: "token",
    refreshToken: "refresh",
    error: null,
  });
}

describe("CalendarsPageView writes", () => {
  beforeEach(() => {
    resetAuth();
    signInAsOwner();
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    URL.createObjectURL = jest.fn(() => "blob:calendar");
    URL.revokeObjectURL = jest.fn();
  });

  it("imports a pasted document with an expected version", async () => {
    const user = userEvent.setup();
    render(<CalendarsPageView />);
    await user.click(screen.getByRole("button", { name: "XNAS" }));
    const input = screen.getByLabelText("Calendar JSON document");
    expect(input).toHaveAttribute("data-language", "json");
    fireEvent.change(input, {
      target: { value: '{"mic":"XNAS"}' },
    });
    await user.type(screen.getByLabelText("Expected version"), "2");
    await user.click(screen.getByRole("button", { name: "Save calendar" }));

    expect(mockImportMutate).toHaveBeenCalledWith(
      { document: { mic: "XNAS" }, expectedVersion: 2 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("rejects invalid JSON before mutating", async () => {
    const user = userEvent.setup();
    render(<CalendarsPageView />);
    await user.click(screen.getByRole("button", { name: "XNAS" }));
    fireEvent.change(screen.getByLabelText("Calendar JSON document"), {
      target: { value: "{" },
    });
    await user.click(screen.getByRole("button", { name: "Save calendar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("not valid JSON");
    expect(mockImportMutate).not.toHaveBeenCalled();
  });

  it("reports import, retire, assign, and delete failures", async () => {
    const user = userEvent.setup();
    render(<CalendarsPageView />);
    await user.click(screen.getByRole("button", { name: "XNAS" }));
    fireEvent.change(screen.getByLabelText("Calendar JSON document"), {
      target: { value: '{"mic":"XNAS"}' },
    });
    mockImportMutate.mockImplementationOnce((_payload, options) =>
      options.onError(new Error("import failed")),
    );
    await user.click(screen.getByRole("button", { name: "Save calendar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("import failed");

    mockRetireMutate.mockImplementationOnce((_payload, options) =>
      options.onError(new Error("retire failed")),
    );
    await user.click(screen.getByRole("button", { name: "Retire" }));
    expect(screen.getByRole("alert")).toHaveTextContent("retire failed");

    mockDeleteMutate.mockImplementationOnce((_id, options) =>
      options.onError(new Error("delete failed")),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("alert")).toHaveTextContent("delete failed");

    mockCreateMutate.mockImplementationOnce((_payload, options) =>
      options.onError(new Error("assign failed")),
    );
    await user.type(screen.getByLabelText("Instrument id"), "asset-1");
    await user.type(screen.getByLabelText("From"), "2026-01-01");
    await user.click(screen.getByRole("button", { name: "Assign" }));
    expect(screen.getByRole("alert")).toHaveTextContent("assign failed");
  });

  it("retires, deletes, assigns, and exports on the happy path", async () => {
    const user = userEvent.setup();
    mockExport.mockResolvedValue({ mic: "XNAS" });
    render(<CalendarsPageView />);
    await user.click(screen.getByRole("button", { name: "XNAS" }));

    mockRetireMutate.mockImplementationOnce((_payload, options) => {
      options.onSuccess();
    });
    await user.click(screen.getByRole("button", { name: "Retire" }));
    expect(mockRetireMutate).toHaveBeenCalledWith(
      { mic: "XNAS", confirm: true },
      expect.any(Object),
    );
    expect(screen.getByRole("status")).toHaveTextContent("XNAS retired");

    mockDeleteMutate.mockImplementationOnce((_id, options) => {
      options.onSuccess();
    });
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("status")).toHaveTextContent("Assignment removed");

    mockCreateMutate.mockImplementationOnce((_payload, options) => {
      options.onSuccess();
    });
    await user.type(screen.getByLabelText("Instrument id"), "asset-1");
    await user.type(screen.getByLabelText("From"), "2026-01-01");
    await user.click(screen.getByRole("button", { name: "Assign" }));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "asset-1",
        mic: "XNAS",
        valid_from: "2026-01-01",
        valid_to: null,
      }),
      expect.any(Object),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Assignment created");

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(mockExport).toHaveBeenCalledWith("XNAS");
  });
});
