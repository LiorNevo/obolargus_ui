import { API_BASE_URL } from "./config";
import { readResponseMeta, type ReadMeta } from "../offline/responseProvenance";
import type { SemanticLayerDocument } from "../types/semanticLayer";

/** A normalized failure while reading the canonical dictionary. */
export class SemanticLayerApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SemanticLayerApiError";
    this.status = status;
    this.code = code;
    this.retryable = status === 0 || status >= 500;
  }
}

type MetaCallback = (meta: ReadMeta) => void;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readErrorEnvelope(text: string): { code: string; message: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isObject(parsed)) {
      const rawError = parsed.error;
      if (isObject(rawError) && typeof rawError.message === "string") {
        return {
          code:
            typeof rawError.code === "string" ? rawError.code : "request_failed",
          message: rawError.message,
        };
      }
      if (typeof rawError === "string") {
        return {
          code: rawError,
          message:
            typeof parsed.message === "string" ? parsed.message : rawError,
        };
      }
    }
  } catch {
    // Plain-text error bodies are kept as the diagnostic.
  }
  return { code: "request_failed", message: text.trim() };
}

/**
 * Reads the canonical data dictionary.
 *
 * The response text is retained unchanged because the raw view and download
 * action must reproduce the exact bytes the server exports. Parsing is done
 * from that same text so the page has one source of truth.
 *
 * @param signal - Optional abort signal.
 * @param onMeta - Optional provenance callback for the shared read cache.
 */
export async function fetchSemanticLayerDocument(
  signal?: AbortSignal,
  onMeta?: MetaCallback,
): Promise<SemanticLayerDocument> {
  const response = await fetch(`${API_BASE_URL}/domain/schema`, { signal });
  if (!response.ok) {
    const text = await response.text();
    const { code, message } = readErrorEnvelope(text);
    throw new SemanticLayerApiError(
      response.status,
      code,
      message || `dictionary request failed with status ${response.status}`,
    );
  }

  onMeta?.(readResponseMeta(response));
  const canonicalText = await response.text();
  try {
    return { document: JSON.parse(canonicalText) as unknown, canonicalText };
  } catch {
    throw new SemanticLayerApiError(
      response.status,
      "invalid_json",
      "The dictionary response was not valid JSON.",
    );
  }
}
