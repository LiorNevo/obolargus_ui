import { createRoot } from "react-dom/client";
import LxEngineWrapper from "lx_client/js/wasm/LxEngineWrapper";
import type { EngineWorker } from "lx_client/js/wasm/types";
import DocsExamplePanel from "./DocsExamplePanel";
import { findExampleBlocks } from "./scanner";
import { parseExample } from "./extract";
import "./styles/DocsExamplePanel.css";

/** Creates the page-wide engine worker shared by every example panel. */
const loadEngine = async (): Promise<EngineWorker | undefined> => {
  try {
    return await LxEngineWrapper(
      new Worker(
        new URL("../../../lx_client/js/wasm/LxEngineWorker.js", import.meta.url)
      )
    );
  } catch {
    // WASM/worker unsupported: panels render their disabled state (FR-010).
    return undefined;
  }
};

const mountPanels = (engine: EngineWorker | undefined): void => {
  const blocks = findExampleBlocks(document.body);
  blocks.forEach((block, index) => {
    const snippet = parseExample(block);
    if (!snippet) {
      return;
    }
    const host = document.createElement("div");
    host.className = "docs_example_panel_host";
    host.dataset.docsExampleId = snippet.id;
    host.dataset.docsExampleIndex = String(index);
    block.after(host);
    const root = createRoot(host);
    root.render(
      <DocsExamplePanel snippet={snippet} engine={engine} />
    );
  });
};

const bootstrap = async (): Promise<void> => {
  const engine = await loadEngine();
  mountPanels(engine);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void bootstrap());
} else {
  void bootstrap();
}
