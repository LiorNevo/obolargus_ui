import React from "react";

/**
 * Placeholder test page.
 *
 * Deliberately free of `lx_client` imports: the package has no resolvable
 * npm entry yet, so placeholder components must not import from it (see
 * `obolargus_ui/AGENTS.md`).
 */
export const TestPage: React.FC = () => {
  return (
    <div style={{ padding: "1rem" }}>
      <h1>Test Page</h1>
      <button type="button" onClick={() => console.log("Clicked")}>
        Click Me
      </button>
    </div>
  );
};
