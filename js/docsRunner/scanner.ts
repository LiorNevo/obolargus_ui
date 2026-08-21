/**
 * Finds candidate lx_engine example blocks in gateway-rendered docs HTML.
 *
 * Runnable blocks are:
 * - `language-yaml` fenced code blocks inside a `<details>` whose summary
 *   mentions "Example" (the lx_engine README's "YAML Examples" sections)
 * - `language-rust` fenced code blocks inside such a `<details>` that embed
 *   a doc-test input literal (`let input_data = r#"..."#`)
 *
 * Everything else (Rust struct definitions, shell snippets, plain fences)
 * stays untouched.
 */

const EXAMPLE_SUMMARY_PATTERN = /example/i;
const RUST_INPUT_DATA_MARKER = 'let input_data = r#"';

const closestPre = (code: Element): HTMLElement | null =>
  code.parentElement instanceof HTMLElement && code.parentElement.tagName === "PRE"
    ? code.parentElement
    : null;

export const findExampleBlocks = (root: HTMLElement): HTMLElement[] => {
  const blocks: HTMLElement[] = [];
  root.querySelectorAll("details").forEach((details) => {
    const summary = details.querySelector("summary")?.textContent ?? "";
    if (!EXAMPLE_SUMMARY_PATTERN.test(summary)) {
      return;
    }
    details.querySelectorAll("pre > code.language-yaml").forEach((code) => {
      const pre = closestPre(code);
      if (pre) blocks.push(pre);
    });
    details.querySelectorAll("pre > code.language-rust").forEach((code) => {
      if (!code.textContent?.includes(RUST_INPUT_DATA_MARKER)) {
        return;
      }
      const pre = closestPre(code);
      if (pre) blocks.push(pre);
    });
  });
  return blocks;
};
