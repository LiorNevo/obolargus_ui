import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dashboard } from "lx_client/js/components/Dashboard";
import { OfflineReadSummary } from "../offline/LastUpdatedLabel";
import { createDashboardAdapter } from "./dashboard/createDashboardAdapter";

/**
 * Dashboard page. It owns only HTTP wiring; all dashboard behavior lives in
 * the `lx_client` library.
 */
export function DashboardPage() {
  const queryClient = useQueryClient();
  const dataAdapter = useMemo(
    () => createDashboardAdapter(queryClient),
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
