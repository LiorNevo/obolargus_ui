import { createPageRegistry } from "lx_client/js/navigation/registry";
import type { PageDefinition } from "lx_client/js/navigation/types";
import { UI_ACCESS_CONTEXT } from "../access";
import { PAGES } from "../pages";

const USER_FACING_IDS = [
  "dashboard",
  "data-load",
  "semantic-layer",
  "portfolios",
  "analysis",
  "rules",
  "settings",
] as const;

const EXPECTED_PAGES: Record<
  (typeof USER_FACING_IDS)[number],
  { label: string; permission: string; availability: string }
> = {
  dashboard: {
    label: "Dashboard",
    permission: "workspace:view",
    availability: "available",
  },
  "data-load": {
    label: "Data Load",
    permission: "workspace:view",
    availability: "available",
  },
  "semantic-layer": {
    label: "Semantic Layer",
    permission: "workspace:view",
    availability: "available",
  },
  portfolios: {
    label: "Portfolios",
    permission: "portfolio:view",
    availability: "not_yet_available",
  },
  analysis: {
    label: "Analysis",
    permission: "analysis:view",
    availability: "not_yet_available",
  },
  rules: {
    label: "Rules",
    permission: "rules:view",
    availability: "not_yet_available",
  },
  settings: {
    label: "Settings",
    permission: "settings:view",
    availability: "not_yet_available",
  },
};

function userFacingPages(): PageDefinition[] {
  return PAGES.filter((page) => page.id !== "component-test");
}

describe("financial page registry", () => {
  it("makes the dashboard the root page and keeps the registered placeholders", () => {
    const root = PAGES.find((page) => page.path === "/");
    expect(root?.id).toBe("dashboard");
    expect(userFacingPages().map((page) => page.id)).toEqual([
      ...USER_FACING_IDS,
      "dashboard-redirect",
    ]);
    expect(userFacingPages().map((page) => page.label)).toEqual([
      ...USER_FACING_IDS.map((id) => EXPECTED_PAGES[id].label),
      "Dashboard",
    ]);
  });

  it("classifies every user-facing page as restricted with a permission", () => {
    for (const page of userFacingPages()) {
      const expected =
        EXPECTED_PAGES[page.id as (typeof USER_FACING_IDS)[number]];

      expect(page.visibility).toBe("restricted");
      expect(page.requiredPermission?.length).toBeGreaterThan(0);
      if (expected) {
        expect(page.requiredPermission).toBe(expected.permission);
      }
    }
  });

  it("keeps the implemented pages available and the four placeholders unavailable", () => {
    for (const page of userFacingPages()) {
      if (page.id === "dashboard-redirect") {
        expect(page.availability).toBe("available");
        expect(page.showInNavigation).toBe(false);
        continue;
      }
      const expected =
        EXPECTED_PAGES[page.id as (typeof USER_FACING_IDS)[number]];

      expect(page.availability).toBe(expected.availability);
    }
  });

  it("derives navigation entries for every user-facing page", () => {
    const entries = createPageRegistry(PAGES).getNavigationEntries(
      UI_ACCESS_CONTEXT,
    );

    expect(entries.map((entry) => entry.id)).toEqual([...USER_FACING_IDS]);
    expect(entries.map((entry) => entry.path)).toContain("/");
    expect(entries.map((entry) => entry.label)).not.toContain("Home");
  });

  it("keeps developer surfaces out of navigation", () => {
    const entries = createPageRegistry(PAGES).getNavigationEntries(
      UI_ACCESS_CONTEXT,
    );
    const ids = entries.map((entry) => entry.id);
    const labels = entries.map((entry) => entry.label);

    expect(ids).not.toContain("component-test");
    expect(ids).not.toContain("docs-runner");
    expect(ids).not.toContain("dashboard-redirect");
    expect(labels).not.toContain("Component test");
    expect(labels.some((label) => label.includes("__components"))).toBe(false);
  });
});
