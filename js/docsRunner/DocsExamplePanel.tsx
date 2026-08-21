import { useCallback, useEffect, useRef, useState } from "react";
import yaml from "js-yaml";
import CodeEditor from "lx_client/js/components/CodeEditor";
import RulesView from "lx_client/js/components/RulesView";
import InputDataView from "lx_client/js/components/InputDataView";
import type { EngineWorker } from "lx_client/js/wasm/types";
import type {
  EditableExampleState,
  ExampleSnippet,
  ExecutionResult,
  ExecutionStatus,
  PanelMode,
} from "./types";
import ComparisonView from "./ComparisonView";
import "./styles/ComparisonView.css";

interface DocsExamplePanelProps {
  snippet: ExampleSnippet;
  engine: EngineWorker | undefined;
}

const DEFAULT_TIMEOUT_SECONDS = 5;

const STATUS_LABELS: Record<ExecutionStatus, string> = {
  success: "Success",
  "syntax-error": "Syntax error",
  "runtime-error": "Evaluation failed",
  timeout: "Timed out",
};

const classifyError = (error: unknown): ExecutionStatus => {
  if (error instanceof yaml.YAMLException) {
    return "syntax-error";
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed\s*out/i.test(message)) {
    return "timeout";
  }
  return "runtime-error";
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const buildEngineInputs = (
  rulesYaml: string,
  inputData: Record<string, unknown> | undefined,
  timeout: number | undefined
): { payload?: string; error?: string } => {
  let parsed: unknown;
  try {
    parsed = yaml.load(rulesYaml);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  const rules = (parsed as { rules?: unknown } | null)?.rules;
  if (rules === undefined || rules === null) {
    return { error: "No runnable rules found in this example." };
  }
  return {
    payload: JSON.stringify({
      rules,
      input_data: inputData,
      timeout: timeout ?? DEFAULT_TIMEOUT_SECONDS,
    }),
  };
};

function DocsExamplePanel({ snippet, engine }: DocsExamplePanelProps) {
  const [mode, setMode] = useState<PanelMode>("static");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult>();
  const [editState, setEditState] = useState<EditableExampleState>();
  const [editorKey, setEditorKey] = useState(0);
  const runIdRef = useRef(0);

  const activeRulesYaml = editState?.currentRulesYaml ?? snippet.rulesYaml;
  const activeInputData = editState?.currentInputData ?? snippet.inputData;

  useEffect(() => {
    snippet.originalElement.style.visibility = mode === "edit" ? "hidden" : "";
    snippet.originalElement.style.marginBottom = mode === "edit" ? "0" : "";
    return () => {
      snippet.originalElement.style.visibility = "";
      snippet.originalElement.style.marginBottom = "";
    };
  }, [mode, snippet.originalElement]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  const runExample = useCallback(async () => {
    if (!engine || isRunning) {
      return;
    }
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    const { payload, error: buildError } = buildEngineInputs(
      activeRulesYaml,
      activeInputData,
      snippet.timeout
    );
    if (buildError !== undefined || payload === undefined) {
      setResult({
        status: "syntax-error",
        error: { message: buildError ?? "Unable to build engine inputs." },
        durationMs: 0,
        timestamp: new Date(),
      });
      setMode((prev) => (prev === "edit" ? "edit" : "results"));
      return;
    }

    setIsRunning(true);
    const startedAt = performance.now();
    const timeoutMs = (snippet.timeout ?? DEFAULT_TIMEOUT_SECONDS) * 1000;
    try {
      const response = await Promise.race([
        engine.lx_engine_run_rules(payload),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Execution timed out")), timeoutMs)
        ),
      ]);
      if (runIdRef.current !== runId) return;
      const output = JSON.parse(response as string);
      setResult({
        status: "success",
        output,
        durationMs: performance.now() - startedAt,
        timestamp: new Date(),
      });
    } catch (error) {
      if (runIdRef.current !== runId) return;
      const status = classifyError(error);
      const isTimeout =
        status === "timeout" ||
        (error instanceof Error && /timed?\s*out/i.test(error.message));
      setResult({
        status: isTimeout ? "timeout" : status,
        error: {
          message: isTimeout
            ? `Execution timed out after ${timeoutMs / 1000}s`
            : errorMessage(error),
        },
        durationMs: performance.now() - startedAt,
        timestamp: new Date(),
      });
    } finally {
      if (runIdRef.current === runId) {
        setIsRunning(false);
      }
    }
    setMode((prev) => (prev === "edit" ? "edit" : "results"));
  }, [engine, isRunning, activeRulesYaml, activeInputData, snippet.timeout]);

  const enterEditMode = useCallback(() => {
    setEditState({
      currentRulesYaml: snippet.rulesYaml,
      currentInputData: snippet.inputData ? { ...snippet.inputData } : undefined,
      isDirty: false,
    });
    setMode("edit");
  }, [snippet.rulesYaml, snippet.inputData]);

  const handleRulesChange = useCallback((nextDoc: string) => {
    setEditState((prev) =>
      prev ? { ...prev, currentRulesYaml: nextDoc, isDirty: true } : prev
    );
  }, []);

  const handleInputDataChange = useCallback(
    (nextData: Record<string, unknown>) => {
      setEditState((prev) =>
        prev ? { ...prev, currentInputData: nextData, isDirty: true } : prev
      );
    },
    []
  );

  const handleReset = useCallback(() => {
    if (!editState) return;
    setEditState({
      currentRulesYaml: snippet.rulesYaml,
      currentInputData: snippet.inputData ? { ...snippet.inputData } : undefined,
      isDirty: false,
    });
    setEditorKey((k) => k + 1);
  }, [editState, snippet.rulesYaml, snippet.inputData]);

  const renderResult = (execution: ExecutionResult) => (
    <div
      className={`docs_example_panel_result docs_example_panel_result_${execution.status}`}
      role="region"
      aria-label={`Evaluation result: ${STATUS_LABELS[execution.status]}`}
    >
      <span className="docs_example_panel_status" aria-live="polite">
        {STATUS_LABELS[execution.status]}
      </span>
      <span className="docs_example_panel_meta">
        Completed in {Math.round(execution.durationMs)} ms
      </span>
      {execution.status === "success" && (
        <RulesView results={execution.output} />
      )}
      {execution.status === "success" &&
        snippet.expectedOutput !== undefined && (
          <ComparisonView
            actualOutput={execution.output}
            expectedOutput={snippet.expectedOutput}
          />
        )}
      {execution.error && (
        <span className="docs_example_panel_error" role="alert">
          {execution.error.message}
        </span>
      )}
    </div>
  );

  const runDisabledTitle = !engine
    ? "WebAssembly runtime not available"
    : isRunning
      ? "Already running"
      : "Run this example";

  if (mode === "edit") {
    return (
      <div className="docs_example_panel docs_example_panel_edit">
        <div className="docs_example_panel_editors">
          <div className="docs_example_panel_rules">
            <CodeEditor
              key={editorKey}
              doc={editState?.currentRulesYaml}
              onChange={handleRulesChange}
            />
          </div>
          {editState?.currentInputData !== undefined && (
            <div className="docs_example_panel_input">
              <InputDataView
                inputData={editState.currentInputData}
                onChange={handleInputDataChange}
              />
            </div>
          )}
        </div>
        <div className="docs_example_panel_toolbar">
          <button
            type="button"
            className="docs_example_panel_run"
            onClick={() => void runExample()}
            disabled={!engine || isRunning}
            aria-label="Run edited example"
            title={runDisabledTitle}
          >
            {isRunning ? "Running…" : "Run"}
          </button>
          <button
            type="button"
            className="docs_example_panel_reset"
            onClick={handleReset}
            disabled={!editState?.isDirty}
            aria-label="Reset to original example"
          >
            Reset
          </button>
        </div>
        {isRunning && (
          <div className="docs_example_panel_running" aria-live="polite">
            Evaluating rules…
          </div>
        )}
        {result && renderResult(result)}
      </div>
    );
  }

  return (
    <div className="docs_example_panel">
      <div className="docs_example_panel_toolbar">
        <button
          type="button"
          className="docs_example_panel_run"
          onClick={() => void runExample()}
          disabled={!engine || isRunning}
          aria-label="Run example"
          title={runDisabledTitle}
        >
          {isRunning ? "Running…" : "Run"}
        </button>
        {mode === "results" && engine && (
          <button
            type="button"
            className="docs_example_panel_edit"
            onClick={enterEditMode}
            aria-label="Edit example"
          >
            Edit
          </button>
        )}
      </div>
      {isRunning && (
        <div className="docs_example_panel_running" aria-live="polite">
          Evaluating rules…
        </div>
      )}
      {result && renderResult(result)}
    </div>
  );
}

export default DocsExamplePanel;
