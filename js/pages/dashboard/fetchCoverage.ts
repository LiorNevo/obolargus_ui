import type {
  ChartCoverage,
  ChartCoverageSegment,
  DateRange,
} from "lx_client/js/components/Dashboard/types";
import type { CoverageWire } from "../../types/chart";
import type { ReadMeta } from "../../offline/responseProvenance";
import { toDataError } from "./toDataError";

/** The coverage transport used by the dashboard adapter. */
export interface CoverageApi {
  loadCoverage(
    assetId: string,
    params: { from: string; to: string },
    options: { signal: AbortSignal; onMeta?: (meta: ReadMeta) => void },
  ): Promise<CoverageWire>;
}

function mapSegment(segment: CoverageWire["segments"][number]): ChartCoverageSegment {
  return {
    mic: segment.mic,
    name: segment.name,
    from: segment.from,
    to: segment.to,
    exact: segment.exact,
    reason: segment.reason,
  };
}

/** Reads and maps calendar-aware coverage for one chart range. */
export async function fetchCoverage(
  api: CoverageApi,
  assetId: string,
  range: DateRange,
  options: { signal: AbortSignal; onMeta?: (meta: ReadMeta) => void },
): Promise<ChartCoverage> {
  try {
    const wire = await api.loadCoverage(
      assetId,
      { from: range.from, to: range.to },
      options,
    );
    return {
      assetId: wire.asset_id,
      from: wire.from,
      to: wire.to,
      asOf: wire.as_of,
      segments: wire.segments.map(mapSegment),
      expectedSessionCount: wire.expected_session_count,
      missingSessions: wire.missing_sessions,
      latestCompletedSession: wire.latest_completed_session,
    };
  } catch (caught) {
    if (options.signal.aborted) throw caught;
    throw toDataError(caught);
  }
}
