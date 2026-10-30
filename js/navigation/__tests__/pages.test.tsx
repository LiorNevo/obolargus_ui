import { createPageRegistry } from "lx_client/js/navigation/registry";
import type { PageDefinition } from "lx_client/js/navigation/types";
import { UI_ACCESS_CONTEXT } from "../access";
import { PAGES } from "../pages";

const USER_FACING_IDS = [
  "home",
  "data-load",
  "dashboard",
  "portfolios",
  "analysis",
  "rules",
  "settings",
] as const;

const EXPECTED_PAGES: Record<
  (typeof USER_FACING_IDS)[number],
  { label: string; permission: string; availability: string }
> = {
  home: {
    label: "Home",
    permission: "workspace:view",
    availability: "available",
  },
  "data-load": {
    label: "Data Load",
    permission: "workspace:view",
    availability: "available",
  },
  dashboard: {
    label: "Dashboard",
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
  it("contains Home, Data Load, and exactly the four placeholders", () => {
    expect(userFacingPages().map((page) => page.id)).toEqual([
      ...USER_FACING_IDS,
    ]);
    expect(userFacingPages().map((page) => page.label)).toEqual(
      USER_FACING_IDS.map((id) => EXPECTED_PAGES[id].label),
    );
  });

  it("classifies every user-facing page as restricted with a permission", () => {
    for (const page of userFacingPages()) {
      const expected =
        EXPECTED_PAGES[page.id as (typeof USER_FACING_IDS)[number]];

      expect(page.visibility).toBe("restricted");
      expect(page.requiredPermission).toBe(expected.permission);
      expect(page.requiredPermission?.length).toBeGreaterThan(0);
    }
  });

  it("keeps Home, Data Load, and Dashboard available and four placeholders unavailable", () => {
    for (const page of userFacingPages()) {
      const expected =
        EXPECTED_PAGES[page.id as (typeof USER_FACING_IDS)[number]];

      expect(page.availability).toBe(expected.availability);
    }
  });

  it("derives navigation entries for all seven user-facing pages", () => {
    const entries = createPageRegistry(PAGES).getNavigationEntries(
      UI_ACCESS_CONTEXT,
    );

    expect(entries.map((entry) => entry.id)).toEqual([...USER_FACING_IDS]);
  });

  it("keeps developer surfaces out of navigation", () => {
    const entries = createPageRegistry(PAGES).getNavigationEntries(
      UI_ACCESS_CONTEXT,
    );
    const ids = entries.map((entry) => entry.id);
    const labels = entries.map((entry) => entry.label);

    expect(ids).not.toContain("component-test");
    expect(ids).not.toContain("docs-runner");
    expect(labels).not.toContain("Component test");
    expect(labels.some((label) => label.includes("__components"))).toBe(false);
  });
});
