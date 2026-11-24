import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  fetchAssignments,
  fetchCalendarDetail,
  fetchCalendarList,
} from "../api/calendar";
import { queryKeys } from "./keys";

const CALENDAR_STALE_MS = 60_000;
const CALENDAR_GC_MS = 600_000;

/** Cache options for the calendar list. */
export function calendarListQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.calendars.list(),
    queryFn: fetchCalendarList,
    staleTime: CALENDAR_STALE_MS,
    gcTime: CALENDAR_GC_MS,
  });
}

/** Cache options for one calendar detail. */
export function calendarDetailQueryOptions(mic: string | null) {
  return queryOptions({
    queryKey: queryKeys.calendars.detail(mic ?? ""),
    queryFn: () => {
      if (!mic) throw new Error("A venue code is required.");
      return fetchCalendarDetail(mic);
    },
    enabled: Boolean(mic),
    staleTime: CALENDAR_STALE_MS,
    gcTime: CALENDAR_GC_MS,
  });
}

/** Cache options for one assignment filter. */
export function calendarAssignmentsQueryOptions(filter: {
  assetId?: string;
  mic?: string;
}) {
  return queryOptions({
    queryKey: queryKeys.calendars.assignments(filter),
    queryFn: () => fetchAssignments(filter),
    staleTime: CALENDAR_STALE_MS,
    gcTime: CALENDAR_GC_MS,
  });
}

/** Calendar list hook. */
export function useCalendarListQuery() {
  return useQuery(calendarListQueryOptions());
}

/** Calendar detail hook. */
export function useCalendarDetailQuery(mic: string | null) {
  return useQuery(calendarDetailQueryOptions(mic));
}

/** Assignment list hook. */
export function useCalendarAssignmentsQuery(filter: {
  assetId?: string;
  mic?: string;
}) {
  return useQuery(calendarAssignmentsQueryOptions(filter));
}
