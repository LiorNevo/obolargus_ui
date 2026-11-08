import { copyText } from "../clipboard";

describe("copyText", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the asynchronous clipboard when available", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to the DOM copy command when the clipboard fails", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockRejectedValue(new Error("denied")),
      },
    });
    const execCommand = jest.fn().mockReturnValue(true);
    Object.assign(document, { execCommand });

    await expect(copyText("fallback")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports a failure when no copy mechanism works", async () => {
    Object.assign(navigator, { clipboard: undefined });
    Object.assign(document, { execCommand: jest.fn().mockReturnValue(false) });

    await expect(copyText("nope")).resolves.toBe(false);
  });
});
