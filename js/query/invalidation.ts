import type { QueryClient } from "@tanstack/react-query";
import type { LoadReport, RangeReport } from "../types/dataLoad";
import { queryKeys } from "./keys";

/** One report per load within a single-date or range result. */
function reportsOf(report: LoadReport | RangeReport): LoadReport[] {
  return "dates" in report ? report.dates.map((section) => section.report) : [report];
}

function affectedAssetIds(report: LoadReport | RangeReport): string[] {
  const ids = new Set<string>();
  for (const loadReport of reportsOf(report)) {
    for (const outcome of loadReport.identifiers) {
      if (outcome.asset_id) ids.add(outcome.asset_id);
    }
  }
  return [...ids];
}

function assetsCreatedOrAdopted(report: LoadReport | RangeReport): number {
  return reportsOf(report).reduce(
    (total, loadReport) =>
      total + loadReport.assets_created + loadReport.assets_adopted,
    0,
  );
}

function loadedCount(report: LoadReport | RangeReport): number {
  return reportsOf(report).reduce(
    (total, loadReport) => total + loadReport.loaded,
    0,
  );
}

/**
 * Invalidates only the reads affected by a source enable/disable.
 *
 * The source catalog for the affected domain and the history entries that
 * record the change are refreshed; unrelated domains and market data remain.
 */
export async function invalidateAfterSourceToggle(
  client: QueryClient,
  domain: string,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({
      queryKey: queryKeys.dataLoad.sources(domain),
    }),
    client.invalidateQueries({
      queryKey: queryKeys.dataLoad.allHistory(),
    }),
    client.invalidateQueries({
      queryKey: queryKeys.dataLoad.allIdentifierSearches(),
    }),
  ]);
}

/** Invalidates history, affected market series, and asset search after a load. */
export async function invalidateAfterLoad(
  client: QueryClient,
  input: { report: LoadReport | RangeReport; groupId?: string | null },
): Promise<void> {
  const tasks: Array<Promise<void>> = [
    client.invalidateQueries({
      queryKey: queryKeys.dataLoad.allHistory(),
    }),
  ];

  const assetIds = affectedAssetIds(input.report);
  if (assetIds.length > 0) {
    for (const assetId of assetIds) {
      tasks.push(
        client.invalidateQueries({
          queryKey: queryKeys.marketSeries.forAsset(assetId),
        }),
      );
    }
  } else if (loadedCount(input.report) > 0) {
    // Stored data without a resolved id is unusual; refresh series broadly so
    // a chart cannot keep pre-load data.
    tasks.push(
      client.invalidateQueries({ queryKey: queryKeys.marketSeries.all() }),
    );
  }

  if (assetsCreatedOrAdopted(input.report) > 0) {
    tasks.push(
      client.invalidateQueries({ queryKey: queryKeys.assets.allSearches() }),
      client.invalidateQueries({
        queryKey: queryKeys.dataLoad.allIdentifierSearches(),
      }),
    );
  }

  if (input.groupId) {
    tasks.push(
      client.invalidateQueries({
        queryKey: queryKeys.dataLoad.progress(input.groupId),
      }),
    );
  }

  await Promise.all(tasks);
}

/** Refreshes history and progress when a restored run reaches a terminal state. */
export async function invalidateAfterProgressTerminal(
  client: QueryClient,
  groupId: string,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({
      queryKey: queryKeys.dataLoad.allHistory(),
    }),
    client.invalidateQueries({
      queryKey: queryKeys.dataLoad.progress(groupId),
    }),
  ]);
}
