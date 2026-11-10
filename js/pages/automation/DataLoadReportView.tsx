import { CodeBlock } from "lx_client/js/components/CodeBlock";
import { LoadReport } from "../data-load/LoadReport";
import { RangeReport } from "../data-load/RangeReport";
import type { LoadReport as LoadReportData, RangeReport as RangeReportData } from "../../types/dataLoad";

function isRangeReport(value: unknown): value is RangeReportData {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { dates?: unknown }).dates)
  );
}

function isLoadReport(value: unknown): value is LoadReportData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { report_version?: unknown }).report_version === "number"
  );
}

/** Renders the report emitted by a `data_load` or `data_load_range` node. */
export function DataLoadReportView({ payload }: { payload: unknown }) {
  const candidate =
    typeof payload === "object" && payload !== null && "report" in payload
      ? (payload as { report: unknown }).report
      : payload;

  if (isRangeReport(candidate)) {
    return <RangeReport report={candidate} />;
  }
  if (isLoadReport(candidate)) {
    return <LoadReport report={candidate} />;
  }
  return (
    <section aria-label="Data-load report">
      <h2>Data-load report</h2>
      <p>This payload does not contain a recognizable load report.</p>
      <CodeBlock ariaLabel="Unrecognized data-load payload">
        {JSON.stringify(payload, null, 2)}
      </CodeBlock>
    </section>
  );
}
