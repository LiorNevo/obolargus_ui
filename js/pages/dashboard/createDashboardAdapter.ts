import {
  DashboardDataError,
  type AssetOption,
  type DailyBar,
  type DailyBarSeries,
  type DashboardDataAdapter,
  type DateRange,
} from "lx_client/js/components/Dashboard/types";
import { DashboardApiError, loadSeriesPage, searchAssets } from "../../api/dashboard";
import type { FactPointWire } from "../../types/dashboard";

const PAGE_LIMIT = 5_000;
const PAGE_CAP = 100;

function addOneDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

function parsePoint(point: FactPointWire): DailyBar {
  let value: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(point.value) as unknown;
    if (parsed && typeof parsed === "object") {
      value = parsed as Record<string, unknown>;
    }
  } catch {
    // Keep empty fields; the candlestick parser excludes the bar.
  }
  const decimalField = (key: string): string => {
    const raw = value[key];
    if (typeof raw === "string") return raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
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

function toDataError(caught: unknown): DashboardDataError {
  if (caught instanceof DashboardDataError) return caught;
  if (caught instanceof DashboardApiError) {
    return new DashboardDataError(caught.message, {
      code: caught.code,
      retryable: caught.retryable,
      status: caught.status,
    });
  }
  return new DashboardDataError(
    caught instanceof Error ? caught.message : "The market data request failed.",
    { code: "unknown", retryable: true },
  );
}

/** Builds the dashboard adapter over the app's HTTP client. */
export function createDashboardAdapter(api = { loadSeriesPage, searchAssets }): DashboardDataAdapter {
  const inFlight = new Map<string, Promise<DailyBarSeries>>();

  return {
    async searchAssets(
      query: string,
      options: { signal: AbortSignal; limit?: number },
    ): Promise<AssetOption[]> {
      try {
        const response = await api.searchAssets(query, options);
        return response.items.map((item) => ({
          id: item.id,
          displayName: item.display_name,
          assetType: item.asset_type,
          currency: item.currency,
          primaryIdentifier: item.primary_identifier,
        }));
      } catch (caught) {
        if (options.signal.aborted) throw caught;
        throw toDataError(caught);
      }
    },

    loadDailyBars(
      assetId: string,
      range: DateRange,
      options: { signal: AbortSignal },
    ): Promise<DailyBarSeries> {
      const key = `${assetId}|${range.from}|${range.to}`;
      const existing = inFlight.get(key);
      if (existing) return existing;
      const promise = (async () => {
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
        } finally {
          inFlight.delete(key);
        }
      })();
      inFlight.set(key, promise);
      return promise;
    },
  };
}
