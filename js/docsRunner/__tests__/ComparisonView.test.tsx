import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ComparisonView from "../ComparisonView";

describe("ComparisonView", () => {
  it("shows pass indicator when outputs match", () => {
    render(
      <ComparisonView actualOutput={{ result: 10 }} expectedOutput={{ result: 10 }} />
    );
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("Matches expected")).toBeInTheDocument();
  });

  it("shows fail indicator when outputs differ", () => {
    render(
      <ComparisonView actualOutput={{ result: 10 }} expectedOutput={{ result: 20 }} />
    );
    expect(screen.getByText("✗")).toBeInTheDocument();
    expect(screen.getByText("Does not match expected")).toBeInTheDocument();
  });

  it("shows diff when outputs differ", () => {
    render(
      <ComparisonView actualOutput={{ result: 10 }} expectedOutput={{ result: 20 }} />
    );
    expect(screen.getByText(/- .*20/)).toBeInTheDocument();
    expect(screen.getByText(/\+ .*10/)).toBeInTheDocument();
  });

  it("does not show diff when outputs match", () => {
    render(
      <ComparisonView actualOutput={{ result: 10 }} expectedOutput={{ result: 10 }} />
    );
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  it("applies pass class when outputs match", () => {
    const { container } = render(
      <ComparisonView actualOutput="test" expectedOutput="test" />
    );
    expect(container.firstChild).toHaveClass("docs_example_comparison_pass");
  });

  it("applies fail class when outputs differ", () => {
    const { container } = render(
      <ComparisonView actualOutput="actual" expectedOutput="expected" />
    );
    expect(container.firstChild).toHaveClass("docs_example_comparison_fail");
  });

  it("handles primitive values", () => {
    render(<ComparisonView actualOutput={42} expectedOutput={42} />);
    expect(screen.getByText("Matches expected")).toBeInTheDocument();
  });

  it("handles array values", () => {
    render(
      <ComparisonView actualOutput={[1, 2, 3]} expectedOutput={[1, 2, 3]} />
    );
    expect(screen.getByText("Matches expected")).toBeInTheDocument();
  });
});
