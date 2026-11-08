const DICTIONARY_FILENAME = "obolargus-system-data-dictionary.json";

/**
 * Downloads text as a file without altering its bytes.
 *
 * The canonical document is written exactly as received, including its
 * formatting and trailing newline.
 */
export function downloadCanonicalDictionary(text: string): void {
  const blob = new Blob([text], { type: "application/schema+json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = DICTIONARY_FILENAME;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export { DICTIONARY_FILENAME };
