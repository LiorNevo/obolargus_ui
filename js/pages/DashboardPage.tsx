import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dashboard,
  DashboardDataError,
  useDashboardStore,
} from "lx_client/js/components/Dashboard";
import type { DashboardDataAdapter } from "lx_client/js/components/Dashboard";
import { OfflineReadSummary } from "../offline/LastUpdatedLabel";
import { queryKeys } from "../query/keys";
import { createDashboardAdapter } from "./dashboard/createDashboardAdapter";

/**
 * Clears a persisted instrument that no longer resolves to an asset.
 *
 * The dashboard store survives schema resets, so an old asset id can remain
 * selected after the database is recreated. When the API answers
 * `unknown_subject`, remove that selection (and matching widget overrides) so
 * the user is taken back to the instrument picker instead of seeing an empty
 * chart.
 */
async function clearStaleInstrument(assetId: string): Promise<void> {
  const store = useDashboardStore.getState();
  const global = store.config.globalControls;
  if (global.instrument?.assetId === assetId) {
    await store.setGlobalControls({ ...global, instrument: null });
  }
  for (const widget of Object.values(store.config.widgets)) {
    if (widget.overrides.instrument?.assetId === assetId) {
      await store.clearWidgetOverride(widget.id, "instrument");
    }
  }
}

function createResilientAdapter(
  queryClient: ReturnType<typeof useQueryClient>,
): DashboardDataAdapter {
  const base = createDashboardAdapter(queryClient);
  return {
    ...base,
    async loadDailyBars(assetId, range, options) {
      try {
        return await base.loadDailyBars(assetId, range, options);
      } catch (caught) {
        if (
          caught instanceof DashboardDataError &&
          caught.code === "unknown_subject"
        ) {
          await clearStaleInstrument(assetId);
          queryClient.removeQueries({
            queryKey: queryKeys.marketSeries.forAsset(assetId),
          });
        }
        throw caught;
      }
    },
  };
}

/**
 * Dashboard page. It owns only HTTP wiring; all dashboard behavior lives in
 * the `lx_client` library.
 */
export function DashboardPage() {
  const queryClient = useQueryClient();
  const dataAdapter = useMemo(
    () => createResilientAdapter(queryClient),
    [queryClient],
  );
  return (
    <div className="obolargus_dashboard_page">
      <OfflineReadSummary />
      <div className="obolargus_dashboard_page_body">
        <Dashboard dataAdapter={dataAdapter} />
      </div>
    </div>
  );
}

export default DashboardPage;
