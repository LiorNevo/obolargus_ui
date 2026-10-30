import { useMemo } from "react";
import { Dashboard } from "lx_client/js/components/Dashboard";
import { createDashboardAdapter } from "./dashboard/createDashboardAdapter";

/**
 * Dashboard page. It owns only HTTP wiring; all dashboard behavior lives in
 * the `lx_client` library.
 */
export function DashboardPage() {
  const dataAdapter = useMemo(() => createDashboardAdapter(), []);
  return (
    <main>
      <Dashboard dataAdapter={dataAdapter} />
    </main>
  );
}

export default DashboardPage;
