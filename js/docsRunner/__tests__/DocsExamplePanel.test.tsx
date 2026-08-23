// Mock lx_client modules before any imports
jest.mock("lx_client/js/components/CodeEditor", () => ({
  __esModule: true,
  default: function MockCodeEditor({ doc, onChange }: { doc?: string; onChange?: (doc: string) => void }) {
    return <textarea value={doc || ""} onChange={(e) => onChange?.(e.target.value)} />;
  },
}));

jest.mock("lx_client/js/components/RulesView", () => ({
  __esModule: true,
  default: function MockRulesView({ results }: { results?: unknown }) {
    return <pre data-testid="rules-view">{JSON.stringify(results, null, 2)}</pre>;
  },
}));

jest.mock("lx_client/js/components/InputDataView", () => ({
  __esModule: true,
  default: function MockInputDataView({ inputData, onChange }: { inputData?: Record<string, unknown>; onChange?: (data: Record<string, unknown>) => void }) {
    return (
      <textarea
        value={inputData ? JSON.stringify(inputData, null, 2) : ""}
        onChange={(e) => {
          try {
            onChange?.(JSON.parse(e.target.value));
          } catch {
            // ignore invalid JSON
          }
        }}
      />
    );
  },
}));

// Mock the engine context
jest.mock("lx_client/js/wasm/engineContext", () => ({
  useEngineContext: () => ({ engine: undefined }),
}));

// Mock the wasm wrapper
jest.mock("lx_client/js/wasm/LxEngineWrapper", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

// Mock the wasm worker
jest.mock("lx_client/js/wasm/LxEngineWorker.js", () => ({
  __esModule: true,
  default: class MockWorker {},
}));

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ExampleSnippet } from "../types";
import type { EngineWorker } from "lx_client/js/wasm/types";

import DocsExamplePanel from "../DocsExamplePanel";

const createSnippet = (overrides?: Partial<ExampleSnippet>): ExampleSnippet => ({
  id: "test-snippet",
  sourceType: "yaml-fence",
  rulesYaml: "rules:\n- abs: -1",
  originalElement: document.createElement("pre"),
  ...overrides,
});

const createEngine = (overrides?: Partial<EngineWorker>): EngineWorker => ({
  lx_engine_run_rules: jest.fn().mockResolvedValue(JSON.stringify({ result: 1 })),
  lx_engine_get_docs: jest.fn().mockResolvedValue("docs"),
  ...overrides,
} as unknown as EngineWorker);

describe("DocsExamplePanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders run button in static mode", () => {
    const engine = createEngine();
    const snippet = createSnippet();
    render(<DocsExamplePanel snippet={snippet} engine={engine} />);
    expect(screen.getByRole("button", { name: /run example/i })).toBeInTheDocument();
  });

  it("disables run button when engine is undefined", () => {
    const snippet = createSnippet();
    render(<DocsExamplePanel snippet={snippet} engine={undefined} />);
    const button = screen.getByRole("button", { name: /run example/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "WebAssembly runtime not available");
  });

  it("shows running state when clicked", async () => {
    const engine = createEngine();
    const snippet = createSnippet();
    render(<DocsExamplePanel snippet={snippet} engine={engine} />);

    fireEvent.click(screen.getByRole("button", { name: /run example/i }));

    expect(screen.getByText("Running…")).toBeInTheDocument();
  });

  it("shows result after successful run", async () => {
    const engine = createEngine();
    const snippet = createSnippet();
    render(<DocsExamplePanel snippet={snippet} engine={engine} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /run example/i }));
      jest.runAllTimers();
    });

    expect(screen.getByText("Success")).toBeInTheDocument();
  });

  it("shows error status for failed run", async () => {
    const engine = createEngine({
      lx_engine_run_rules: jest.fn().mockRejectedValue(new Error("Engine error")),
    });
    const snippet = createSnippet();
    render(<DocsExamplePanel snippet={snippet} engine={engine} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /run example/i }));
      jest.runAllTimers();
    });

    expect(screen.getByText("Engine error")).toBeInTheDocument();
  });

  it("shows edit button in results mode", async () => {
    const engine = createEngine();
    const snippet = createSnippet();
    render(<DocsExamplePanel snippet={snippet} engine={engine} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /run example/i }));
      jest.runAllTimers();
    });

    expect(screen.getByRole("button", { name: /edit example/i })).toBeInTheDocument();
  });

  it("enters edit mode when edit button clicked", async () => {
    const engine = createEngine();
    const snippet = createSnippet();
    render(<DocsExamplePanel snippet={snippet} engine={engine} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /run example/i }));
      jest.runAllTimers();
    });

    expect(screen.getByRole("button", { name: /edit example/i })).toBeInTheDocument();

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /edit example/i }));
        jest.runAllTimers();
    });
    expect(screen.getByRole("button", { name: /run edited example/i })).toBeInTheDocument();
  });

  it("shows timeout error after timeout", async () => {
    const neverResolve = new Promise(() => {});
    const engine = createEngine({
      lx_engine_run_rules: jest.fn().mockReturnValue(neverResolve),
    });
    const snippet = createSnippet({ timeout: 0.05 });
    const { container } = render(<DocsExamplePanel snippet={snippet} engine={engine} />);

    fireEvent.click(screen.getByRole("button", { name: /run example/i }));

    // First verify running state appears
    await waitFor(() => {
      expect(screen.getByText(/running/i)).toBeInTheDocument();
    }, { timeout: 1000 });

    // Then wait for timeout error
    await waitFor(() => {
      const errorEl = container.querySelector(".docs_example_panel_error");
      expect(errorEl).toBeTruthy();
      expect(errorEl?.textContent).toMatch(/timed out/i);
    }, { timeout: 5000, interval: 50 });
  }, 15000);
});
