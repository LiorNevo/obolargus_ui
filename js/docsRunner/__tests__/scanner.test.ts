import { findExampleBlocks } from "../scanner";

const buildDetails = (summary: string, codeClass: string, code: string): string =>
  `<details><summary>${summary}</summary><pre><code class="${codeClass}">${code}</code></pre></details>`;

const mount = (html: string): HTMLElement => {
  document.body.innerHTML = html;
  return document.body;
};

describe("findExampleBlocks", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds yaml fences inside 'YAML Examples' details", () => {
    mount(buildDetails("YAML Examples", "language-yaml", "abs:\n- -50"));
    const blocks = findExampleBlocks(document.body);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].tagName).toBe("PRE");
  });

  it("finds rust doc-tests containing an input_data literal", () => {
    mount(
      buildDetails(
        "Example in Code",
        "language-rust",
        'let input_data = r#"\n  rules:\n  - abs: -1\n"#;'
      )
    );
    const blocks = findExampleBlocks(document.body);
    expect(blocks).toHaveLength(1);
  });

  it("ignores rust blocks without an input_data literal", () => {
    mount(buildDetails("Example in Code", "language-rust", "struct LxAdd;"));
    expect(findExampleBlocks(document.body)).toHaveLength(0);
  });

  it("ignores yaml fences outside an Example details", () => {
    mount(
      `<pre><code class="language-yaml">abs:\n- -50</code></pre>${buildDetails(
        "Other",
        "language-yaml",
        "abs:\n- -50"
      )}`
    );
    expect(findExampleBlocks(document.body)).toHaveLength(0);
  });

  it("ignores non-example fenced blocks (shell, rust structs, plain code)", () => {
    mount(
      buildDetails("Some Section", "language-bash", "cargo build") +
        buildDetails("Another", "language-rust", "fn main() {}") +
        `<pre><code>plain</code></pre>`
    );
    expect(findExampleBlocks(document.body)).toHaveLength(0);
  });

  it("finds multiple yaml fences in one details block", () => {
    mount(
      `<details><summary>YAML Examples</summary>
        <pre><code class="language-yaml">abs: [1]</code></pre>
        <pre><code class="language-yaml">abs: [2]</code></pre>
      </details>`
    );
    expect(findExampleBlocks(document.body)).toHaveLength(2);
  });

  it("finds yaml and rust examples side by side", () => {
    mount(
      buildDetails("YAML Examples", "language-yaml", "abs: [1]") +
        buildDetails(
          "Example in Code",
          "language-rust",
          'let input_data = r#"rules:\n- abs: -1\n"#;'
        )
    );
    expect(findExampleBlocks(document.body)).toHaveLength(2);
  });
});
