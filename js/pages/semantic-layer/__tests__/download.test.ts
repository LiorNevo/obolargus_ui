import {
  DICTIONARY_FILENAME,
  downloadCanonicalDictionary,
} from "../download";

describe("downloadCanonicalDictionary", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("downloads the canonical text with the declared filename", async () => {
    const createObjectURL = jest.fn().mockReturnValue("blob:test");
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicked: HTMLAnchorElement[] = [];
    jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });

    downloadCanonicalDictionary("canonical text\n");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe(DICTIONARY_FILENAME);
    expect(clicked[0].href).toBe("blob:test");
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(text).toBe("canonical text\n");
    expect(blob.type).toBe("application/schema+json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
