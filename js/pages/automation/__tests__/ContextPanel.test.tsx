import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import userEvent from "@testing-library/user-event";
import { ContextPanel } from "../ContextPanel";

const mockClearMutate = jest.fn();

jest.mock("../../../query/automationQueries", () => ({
  useContextQuery: () => ({
    isPending: false,
    isError: false,
    data: {
      flow: { seen: { count: 2 } },
      global: { mode: "live" },
    },
  }),
}));

jest.mock("../../../query/mutations", () => ({
  useDeleteContextMutation: () => ({ mutate: mockClearMutate, isPending: false }),
}));

describe("ContextPanel", () => {
  it("renders flow and global entries and clears the flow scope", async () => {
    mockClearMutate.mockReset();
    render(<ContextPanel flowId="f1" />);
    expect(screen.getByLabelText("flow context")).toHaveTextContent("seen");
    expect(screen.getByLabelText("global context")).toHaveTextContent("mode");
    expect(screen.getByText('{"count":2}')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear flow context" }),
    );
    expect(mockClearMutate).toHaveBeenCalled();
  });
});
