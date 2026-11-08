import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VersionPanel } from "../VersionPanel";

const mockArchiveMutate = jest.fn();

jest.mock("../../../query/automationQueries", () => ({
  useVersionsQuery: () => ({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      items: [
        {
          id: "v2",
          version_number: 2,
          status: "published",
          change_note: "Second",
          published_by: "dev-user",
          published_at: "2026-01-02T00:00:00Z",
        },
        {
          id: "v1",
          version_number: 1,
          status: "archived",
          change_note: "First",
          published_by: "dev-user",
          published_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
  }),
}));

jest.mock("../../../query/mutations", () => ({
  useArchiveVersionMutation: () => ({
    mutate: mockArchiveMutate,
    isPending: false,
  }),
}));

describe("VersionPanel", () => {
  it("marks the current version and archives older ones", async () => {
    mockArchiveMutate.mockReset();
    render(<VersionPanel flowId="f1" currentVersionNumber={2} />);
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(mockArchiveMutate).toHaveBeenCalledWith(2, expect.anything());
  });
});
