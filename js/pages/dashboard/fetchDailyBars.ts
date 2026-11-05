import {
  DashboardDataError,
  type DailyBar,
  type DailyBarSeries,
  type DateRange,
} from "lx_client/js/components/Dashboard/types";
import type {
  FactPointWire,
  MarketPriceValueWire,
  SeriesResponseWire,
} from "../../types/dashboard";
import type { ReadMeta } from "../../offline/responseProvenance";
import { toDataError } from "./toDataError";

const PAGE_LIMIT = 5_000;
const PAGE_CAP = 100;

/** The series transport used by the dashboard adapter. */
export interface SeriesApi {
  loadSeriesPage(
    assetId: string,
    params: { from: string; to: string; limit?: number; cursor?: string | null },
    options: { signal: AbortSignal; onMeta?: (meta: ReadMeta) => void },
  ): Promise<SeriesResponseWire>;
}

function addOneDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

function parsePoint(point: FactPointWire): DailyBar {
  const value: MarketPriceValueWire | null =
    point.value?.type === "market_price" ? point.value : null;
  const decimalField = (key: keyof MarketPriceValueWire): string => {
    const raw = value?.[key];
    if (typeof raw === "string") return raw;
    return "";
  };
  return {
    validAt: point.valid_at,
    knownAt: point.known_at,
    open: decimalField("open"),
    high: decimalField("high"),
    low: decimalField("low"),
    close: decimalField("close"),
    adjclose: decimalField("adjclose") || undefined,
    volume: decimalField("volume"),
    source: point.source,
    retracted: false,
  };
}

/**
 * Reads every cursor page for one asset and range and combines them into one
 * logical daily series.
 */
export async function fetchDailyBars(
  api: SeriesApi,
  assetId: string,
  range: DateRange,
  options: { signal: AbortSignal; onMeta?: (meta: ReadMeta) => void },
): Promise<DailyBarSeries> {
  const seen = new Set<string>();
  const points: DailyBar[] = [];
  let cursor: string | null = null;
  let pages = 0;

  try {
    do {
      const page = await api.loadSeriesPage(
        assetId,
        {
          from: `${range.from}T00:00:00Z`,
          to: addOneDay(range.to),
          limit: PAGE_LIMIT,
          cursor,
        },
        options,
      );
      pages += 1;
      for (const point of page.points) {
        const date = point.valid_at.slice(0, 10);
        if (seen.has(date)) continue;
        seen.add(date);
        points.push(parsePoint(point));
      }
      cursor = page.next_cursor;
    } while (cursor && pages < PAGE_CAP);

    if (cursor) {
      throw new DashboardDataError(
        "This range has too many pages to display. Narrow the date range.",
        { code: "too_many_pages", retryable: false },
      );
    }

    points.sort((a, b) => a.validAt.localeCompare(b.validAt));
    return {
      assetId,
      from: range.from,
      to: range.to,
      points,
      coverage: {
        points: points.length,
        first: points[0]?.validAt ?? null,
        last: points.at(-1)?.validAt ?? null,
      },
      pages,
    };
  } catch (caught) {
    if (options.signal.aborted) throw caught;
    throw toDataError(caught);
  }
}
