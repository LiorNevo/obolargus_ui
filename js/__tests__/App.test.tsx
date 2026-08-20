import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/jest-globals";
import "@testing-library/jest-dom";

import { App } from "../App";

describe("App placeholder shell", () => {
  it("renders the Obolargus title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Obolargus");
  });

  it("shows the placeholder note", () => {
    render(<App />);
    expect(screen.getByText(/placeholder shell/i)).toBeInTheDocument();
  });
});
