import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourceCatalog } from "../SourceCatalog";
import type { SourceCatalogEntry } from "../../../types/dataLoad";

const SOURCE: SourceCatalogEntry = {
  source_id: "yahoo_finance",
  display_name: "Yahoo Finance",
  enabled: true,
  priority: 1,
  supported_schemes: ["TICKER"],
  supported_data_domains: ["market_data"],
  selectable_for_domain: true,
  unavailable_reason: null,
};

describe("SourceCatalog", () => {
  it("shows disabled sources and their reason", () => {
    render(
      <SourceCatalog
        sources={[
          { ...SOURCE, enabled: false, unavailable_reason: "Source is disabled" },
        ]}
        busySourceId={null}
        onRefresh={() => undefined}
        onToggle={() => undefined}
      />,
    );
    expect(screen.getByText("disabled")).toBeInTheDocument();
    expect(screen.getByText("Source is disabled")).toBeInTheDocument();
  });

  it("confirms before toggling and warns for the last enabled source", async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    render(
      <SourceCatalog
        sources={[SOURCE]}
        busySourceId={null}
        onRefresh={() => undefined}
        onToggle={onToggle}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Disable Yahoo Finance" }));
    expect(screen.getByRole("status")).toHaveTextContent("last enabled source");
    await user.click(screen.getByRole("button", { name: "Confirm disable" }));
    expect(onToggle).toHaveBeenCalledWith(SOURCE, false);
  });

  it("refreshes on demand", async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    render(
      <SourceCatalog
        sources={[SOURCE]}
        busySourceId={null}
        onRefresh={onRefresh}
        onToggle={() => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders shimmering rows and disables refresh while loading", () => {
    const { container } = render(
      <SourceCatalog
        sources={[]}
        busySourceId={null}
        loading
        onRefresh={() => undefined}
        onToggle={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(container.querySelectorAll(".lx-table-skeleton-row")).toHaveLength(5);
    expect(container.querySelectorAll(".lx_client_skeleton").length).toBeGreaterThan(0);
  });
});
