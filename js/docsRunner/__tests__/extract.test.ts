import { parseExample } from "../extract";

const mountPre = (codeClass: string, codeText: string): HTMLElement => {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = codeClass;
  code.textContent = codeText;
  pre.appendChild(code);
  document.body.appendChild(pre);
  return pre;
};

describe("parseExample (yaml fences)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("wraps a bare rule expression as a single-rule document", () => {
    const element = mountPre("language-yaml", "abs:\n- -50\n- 2");
    const snippet = parseExample(element);
    expect(snippet).not.toBeNull();
    expect(snippet?.sourceType).toBe("yaml-fence");
    expect(snippet?.rulesYaml).toContain("rules");
    expect(snippet?.rulesYaml).toContain("abs");
    expect(snippet?.inputData).toBeUndefined();
    expect(snippet?.expectedOutput).toBeUndefined();
  });

  it("splits a full inputs document into rules, input data, and timeout", () => {
    const element = mountPre(
      "language-yaml",
      "rules:\n- get: { selector: assets }\ninput_data:\n  assets:\n  - value: 10\ntimeout: 10"
    );
    const snippet = parseExample(element);
    expect(snippet?.inputData).toEqual({ assets: [{ value: 10 }] });
    expect(snippet?.timeout).toBe(10);
    expect(snippet?.rulesYaml).toContain("selector");
    expect(snippet?.rulesYaml).not.toContain("input_data");
  });

  it("wraps a list of rules directly", () => {
    const element = mountPre("language-yaml", "- abs: -1\n- abs: -2");
    const snippet = parseExample(element);
    expect(snippet?.rulesYaml).toContain("rules");
    expect(snippet?.rulesYaml).toContain("abs");
  });

  it("returns null for non-object yaml (scalar document)", () => {
    const element = mountPre("language-yaml", "42");
    expect(parseExample(element)).toBeNull();
  });

  it("returns null for invalid yaml", () => {
    const element = mountPre("language-yaml", "key: [unclosed");
    expect(parseExample(element)).toBeNull();
  });

  it("produces stable ids for identical content", () => {
    const first = mountPre("language-yaml", "abs: [1]");
    const second = mountPre("language-yaml", "abs: [1]");
    expect(parseExample(first)?.id).toBe(parseExample(second)?.id);
  });
});

describe("parseExample (rust doc-tests)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const docTest = (inputs: string, expected?: string): string =>
    `use lx_engine::run_rules;\nlet input_data = r#"\n${inputs}\n"#;\n${
      expected ? `let expected = r#"\n${expected}\n"#;\n` : ""
    }let results = run_rules(inputs);`;

  it("extracts rules, input data, and expected output", () => {
    const element = mountPre(
      "language-rust",
      docTest(
        "rules:\n- get: { selector: value }\ninput_data:\n  value: 12\ntimeout: 10",
        "- result: 12"
      )
    );
    const snippet = parseExample(element);
    expect(snippet?.sourceType).toBe("rust-doctest");
    expect(snippet?.inputData).toEqual({ value: 12 });
    expect(snippet?.timeout).toBe(10);
    expect(snippet?.expectedOutput).toEqual([{ result: 12 }]);
  });

  it("leaves expected output undefined when the block has none", () => {
    const element = mountPre("language-rust", docTest("rules:\n- abs: -1"));
    const snippet = parseExample(element);
    expect(snippet?.expectedOutput).toBeUndefined();
  });

  it("returns null when the rust block has no input_data literal", () => {
    const element = mountPre("language-rust", "struct LxAdd;");
    expect(parseExample(element)).toBeNull();
  });

  it("returns null when the extracted yaml lacks a rules key", () => {
    const element = mountPre(
      "language-rust",
      docTest("not_rules:\n- something")
    );
    expect(parseExample(element)).toBeNull();
  });
});
