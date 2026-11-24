import { act, renderHook } from "@testing-library/react";
import { createQueryWrapper } from "../testUtils";
import {
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
  useImportCalendarMutation,
  useRetireCalendarMutation,
} from "../mutations";
import {
  createCalendarAssignment,
  deleteCalendarAssignment,
  importCalendar,
  retireCalendar,
} from "../../api/calendar";

jest.mock("../../api/calendar", () => ({
  importCalendar: jest.fn(),
  retireCalendar: jest.fn(),
  createCalendarAssignment: jest.fn(),
  deleteCalendarAssignment: jest.fn(),
}));

const mockedImport = importCalendar as jest.MockedFunction<typeof importCalendar>;
const mockedRetire = retireCalendar as jest.MockedFunction<typeof retireCalendar>;
const mockedCreate =
  createCalendarAssignment as jest.MockedFunction<typeof createCalendarAssignment>;
const mockedDelete =
  deleteCalendarAssignment as jest.MockedFunction<typeof deleteCalendarAssignment>;

describe("calendar mutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedImport.mockResolvedValue({ summary: "ok", changed: true } as never);
    mockedRetire.mockResolvedValue({
      calendar: { mic: "XNAS" },
      affected_count: 0,
    } as never);
    mockedCreate.mockResolvedValue({ id: "assignment-1" } as never);
    mockedDelete.mockResolvedValue(undefined);
  });

  it("runs every calendar write and invalidates its reads", async () => {
    const wrapper = createQueryWrapper();
    const importHook = renderHook(() => useImportCalendarMutation(), { wrapper });
    const retireHook = renderHook(() => useRetireCalendarMutation(), { wrapper });
    const createHook = renderHook(() => useCreateAssignmentMutation(), { wrapper });
    const deleteHook = renderHook(() => useDeleteAssignmentMutation(), { wrapper });

    await act(async () => {
      await importHook.result.current.mutateAsync({
        document: { mic: "XNAS" } as never,
        expectedVersion: 2,
      });
      await retireHook.result.current.mutateAsync({
        mic: "XNAS",
        confirm: true,
      });
      await createHook.result.current.mutateAsync({
        asset_id: "asset-1",
        mic: "XNAS",
        valid_from: "2026-01-01",
        valid_to: null,
      });
      await deleteHook.result.current.mutateAsync("assignment-1");
    });

    expect(mockedImport).toHaveBeenCalledWith({ mic: "XNAS" }, 2);
    expect(mockedRetire).toHaveBeenCalledWith("XNAS", true);
    expect(mockedCreate).toHaveBeenCalledWith({
      asset_id: "asset-1",
      mic: "XNAS",
      valid_from: "2026-01-01",
      valid_to: null,
    });
    expect(mockedDelete).toHaveBeenCalledWith("assignment-1");
  });
});
