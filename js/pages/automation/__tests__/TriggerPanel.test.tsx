import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TriggerPanel } from "../TriggerPanel";

const mockCreateMutate = jest.fn();
const mockUpdateMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockInvokeMutate = jest.fn();

jest.mock("../../../query/automationQueries", () => ({
  useTriggersQuery: () => ({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      items: [
        {
          id: "t1",
          kind: "api",
          node_id: null,
          enabled: true,
          repeat_kind: null,
          cron_expression: null,
          interval_seconds: null,
          timezone: "UTC",
          overlap_policy: "skip",
          missed_policy: "run_once",
          next_occurrence_at: null,
          last_occurrence_at: null,
        },
        {
          id: "t2",
          kind: "inject",
          node_id: "n1",
          enabled: true,
          repeat_kind: "cron",
          cron_expression: "0 0 6 * * *",
          interval_seconds: null,
          timezone: "America/New_York",
          overlap_policy: "skip",
          missed_policy: "run_once",
          next_occurrence_at: "2026-11-09T11:00:00Z",
          last_occurrence_at: null,
        },
      ],
    },
  }),
}));

jest.mock("../../../query/mutations", () => ({
  useCreateTriggerMutation: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateTriggerMutation: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useDeleteTriggerMutation: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useInvokeTriggerMutation: () => ({ mutate: mockInvokeMutate, isPending: false }),
}));

describe("TriggerPanel", () => {
  beforeEach(() => {
    mockCreateMutate.mockReset();
    mockUpdateMutate.mockReset();
    mockDeleteMutate.mockReset();
    mockInvokeMutate.mockReset();
  });

  it("shows schedules, next occurrences, and policies", () => {
    render(<TriggerPanel flowId="f1" />);
    expect(screen.getByText(/cron 0 0 6/)).toBeInTheDocument();
    expect(screen.getAllByText(/Next:/)).toHaveLength(2);
    expect(screen.getAllByText(/Overlap: skip/)).toHaveLength(2);
  });

  it("creates, toggles, invokes, and deletes triggers", async () => {
    render(<TriggerPanel flowId="f1" />);
    await userEvent.click(screen.getByRole("button", { name: "Add API trigger" }));
    expect(mockCreateMutate).toHaveBeenCalled();

    const toggles = screen.getAllByRole("button", { name: "Disable" });
    await userEvent.click(toggles[0]);
    expect(mockUpdateMutate).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Invoke" }));
    expect(mockInvokeMutate).toHaveBeenCalled();

    const deletes = screen.getAllByRole("button", { name: "Delete" });
    await userEvent.click(deletes[0]);
    expect(mockDeleteMutate).toHaveBeenCalled();
  });
});
