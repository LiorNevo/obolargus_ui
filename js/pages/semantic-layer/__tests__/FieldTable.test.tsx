import { render, screen, within } from "@testing-library/react";
import { FieldTable } from "../FieldTable";
import type { FieldModel } from "../../../types/semanticLayer";

function field(index: number): FieldModel {
  return {
    name: `field_${index}`,
    description: `Field ${index}`,
    types: ["string"],
    nullable: false,
    required: true,
    writable: true,
    format: null,
    pattern: null,
    minLength: null,
    maxLength: null,
    minimum: null,
    maximum: null,
    itemType: null,
    enumValues: [],
    knownValues: [],
    unit: null,
    precision: null,
    scale: null,
    declaredMinimum: null,
    declaredMaximum: null,
    aggregates: ["none"],
    reference: null,
    synthetic: false,
    raw: {},
  };
}

describe("FieldTable", () => {
  it("renders every field through the shared lx_client table", () => {
    render(
      <FieldTable
        fields={Array.from({ length: 13 }, (_, index) => field(index))}
        caption="Fields of Many"
      />,
    );

    const region = screen.getByRole("region", { name: "Fields of Many" });
    const grid = within(region).getByRole("grid");
    expect(within(grid).getAllByRole("columnheader")).toHaveLength(9);
    expect(within(grid).getAllByRole("row")).toHaveLength(14);
    expect(
      within(grid).getAllByRole("button", { name: /^Filter / }),
    ).toHaveLength(9);
    expect(within(grid).getByText("field_12")).toBeInTheDocument();
  });

  it("reports an empty field list without a table", () => {
    render(<FieldTable fields={[]} caption="Fields of Empty" />);
    expect(screen.getByText("No fields declared.")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});
