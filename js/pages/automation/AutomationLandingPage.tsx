import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Skeleton } from "lx_client/js/components/Skeleton";
import { useFlowsQuery } from "../../query/automationQueries";
import { errorMessage } from "./shared";
import "./automation.css";

/**
 * Sends the user straight into the editor for the most recently updated flow.
 * The flow list remains available at `/automation/flows` for creation and
 * management, but it is no longer the default automation destination.
 */
export default function AutomationLandingPage() {
  usePageTitle("Automation");
  const navigate = useNavigate();
  const flows = useFlowsQuery({ limit: 200, offset: 0 });

  const firstFlow = flows.data?.items.find((flow) => flow.status === "active");

  useEffect(() => {
    if (!flows.isSuccess) return;
    navigate(
      firstFlow ? `/automation/flows/${firstFlow.id}` : "/automation/flows",
      { replace: true },
    );
  }, [firstFlow, flows.isSuccess, navigate]);

  if (flows.isError) {
    return (
      <main className="obolargus_automation_page">
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(flows.error)}
        </p>
        <Link to="/automation/flows">Open the flow list</Link>
      </main>
    );
  }

  return (
    <main className="obolargus_automation_page">
      <Skeleton />
    </main>
  );
}
