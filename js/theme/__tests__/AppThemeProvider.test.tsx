import { act, render } from "@testing-library/react";
import { useThemeStore } from "lx_client/js/components/ThemeProvider/store";
import { AppThemeProvider } from "../AppThemeProvider";

function dispatchTheme(themeId: string): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "lx-theme-change", themeId },
      origin: window.location.origin,
    }),
  );
}

describe("AppThemeProvider", () => {
  beforeEach(() => {
    useThemeStore.setState({ activeThemeId: "dark" });
    document.documentElement.className = "";
  });

  it("applies the persisted theme class", () => {
    render(
      <AppThemeProvider>
        <div>content</div>
      </AppThemeProvider>,
    );
    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);
  });

  it("switches the root class when the theme changes", () => {
    render(
      <AppThemeProvider>
        <div>content</div>
      </AppThemeProvider>,
    );
    act(() => useThemeStore.getState().setActiveThemeId("light"));
    expect(document.documentElement.classList.contains("theme-light")).toBe(true);
    expect(document.documentElement.classList.contains("theme-dark")).toBe(false);
  });

  it("accepts a same-origin cross-frame theme message", () => {
    render(
      <AppThemeProvider>
        <div>content</div>
      </AppThemeProvider>,
    );
    act(() => dispatchTheme("light"));
    expect(useThemeStore.getState().activeThemeId).toBe("light");
    expect(document.documentElement.classList.contains("theme-light")).toBe(true);
  });

  it("ignores malformed and cross-origin messages", () => {
    render(
      <AppThemeProvider>
        <div>content</div>
      </AppThemeProvider>,
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "lx-theme-change", themeId: "sepia" },
          origin: window.location.origin,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "other", themeId: "light" },
          origin: window.location.origin,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "lx-theme-change", themeId: "light" },
          origin: "https://other.test",
        }),
      );
    });
    expect(useThemeStore.getState().activeThemeId).toBe("dark");
  });

  it("falls back to dark when a persisted theme is unknown", () => {
    useThemeStore.setState({ activeThemeId: "sepia" as never });
    render(
      <AppThemeProvider>
        <div>content</div>
      </AppThemeProvider>,
    );
    expect(useThemeStore.getState().activeThemeId).toBe("dark");
    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);
  });
});
