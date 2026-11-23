import type { QueryClient } from "@tanstack/react-query";
import type { LoadReport, RangeReport } from "../types/dataLoad";
import { queryKeys } from "./keys";

/** Whether the report is a bounded range report (no per-identifier lines). */
function isRangeReport(report: LoadReport | RangeReport): report is RangeReport {
  return "dates" in report;
}

function affectedAssetIds(report: LoadReport | RangeReport): string[] {
  if (isRangeReport(report)) {
    // A range response carries per-date summaries only; per-identifier
    // detail stays on the history detail endpoint.
    return [];
  }
  const ids = new Set<string>();
  for (const outcome of report.identifiers) {
    if (outcome.asset_id) ids.add(outcome.asset_id);
  }
  return [...ids];
}

function assetsCreatedOrAdopted(report: LoadReport | RangeReport): number {
  if (isRangeReport(report)) {
    return report.totals.assets_created + report.totals.assets_adopted;
  }
  return report.assets_created + report.assets_adopted;
}

function loadedCount(report: LoadReport | RangeReport): number {
  return isRangeReport(report) ? report.totals.loaded : report.loaded;
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

/** Invalidates the reads affected by a bounded chart history load. */
export async function invalidateAfterHistoryLoad(
  client: QueryClient,
  assetId: string,
  options: { createdAssets?: boolean } = {},
): Promise<void> {
  const tasks: Array<Promise<void>> = [
    client.invalidateQueries({
      queryKey: queryKeys.marketSeries.forAsset(assetId),
    }),
  ];
  if (options.createdAssets) {
    tasks.push(
      client.invalidateQueries({ queryKey: queryKeys.assets.allSearches() }),
      client.invalidateQueries({
        queryKey: queryKeys.dataLoad.allIdentifierSearches(),
      }),
    );
  }
  await Promise.all(tasks);
}
