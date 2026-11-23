import {
  loadGoogleIdentityServices,
  resetGoogleIdentityServicesForTests,
} from "../gis";

const GIS_SRC = "https://accounts.google.com/gsi/client";

function fakeGoogle() {
  return {
    accounts: {
      id: {
        initialize: jest.fn(),
        renderButton: jest.fn(),
        disableAutoSelect: jest.fn(),
      },
    },
  };
}

describe("Google Identity Services loader", () => {
  afterEach(() => {
    resetGoogleIdentityServicesForTests();
    delete window.google;
    document
      .querySelectorAll(`script[src="${GIS_SRC}"]`)
      .forEach((script) => script.remove());
  });

  it("loads the script once and shares the API", async () => {
    const first = loadGoogleIdentityServices();
    const second = loadGoogleIdentityServices();
    expect(second).toBe(first);

    const script = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    expect(script).not.toBeNull();
    window.google = fakeGoogle();
    script?.dispatchEvent(new Event("load"));

    await expect(first).resolves.toBe(window.google);
    await expect(loadGoogleIdentityServices()).resolves.toBe(window.google);
    expect(
      document.querySelectorAll(`script[src="${GIS_SRC}"]`).length,
    ).toBe(1);
  });

  it("rejects and allows a retry when the script fails", async () => {
    const failed = loadGoogleIdentityServices();
    const script = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    script?.dispatchEvent(new Event("error"));

    await expect(failed).rejects.toThrow(/could not be loaded/i);
    const retry = loadGoogleIdentityServices();
    expect(retry).not.toBe(failed);
    const retryScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    window.google = fakeGoogle();
    retryScript?.dispatchEvent(new Event("load"));
    await expect(retry).resolves.toBe(window.google);
  });
});
