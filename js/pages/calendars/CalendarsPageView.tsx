import { useMemo, useState } from "react";
import { Button } from "lx_client/js/components/Button";
import { AUTH_ENABLED } from "../../auth/config";
import { useAuthStore } from "../../auth/store";
import {
  useCalendarAssignmentsQuery,
  useCalendarDetailQuery,
  useCalendarListQuery,
} from "../../query/calendarQueries";
import {
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
  useImportCalendarMutation,
  useRetireCalendarMutation,
} from "../../query/mutations";
import { fetchCalendarExport } from "../../api/calendar";
import type { CalendarDocument } from "../../types/calendar";
import "./calendars.css";

function download(document: CalendarDocument): void {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${document.mic}-calendar.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Calendar list, detail, import/export, retire, and assignments. */
export function CalendarsPageView() {
  const actor = useAuthStore((state) => state.actor);
  const canWrite = !AUTH_ENABLED || actor?.isPrimaryOwner === true;
  const list = useCalendarListQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useCalendarDetailQuery(selected);
  const assignments = useCalendarAssignmentsQuery(
    selected ? { mic: selected } : {},
  );
  const importMutation = useImportCalendarMutation();
  const retireMutation = useRetireCalendarMutation();
  const createAssignment = useCreateAssignmentMutation();
  const deleteAssignment = useDeleteAssignmentMutation();
  const [document, setDocument] = useState("");
  const [expectedVersion, setExpectedVersion] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState({
    assetId: "",
    mic: "",
    from: "",
    to: "",
  });
  const selectedSummary = useMemo(
    () => list.data?.calendars.find((entry) => entry.mic === selected) ?? null,
    [list.data, selected],
  );

  function report(action: () => void): void {
    setError(null);
    try {
      action();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The action could not run.",
      );
    }
  }

  return (
    <main className="obolargus_calendars" aria-labelledby="calendars-title">
      <header className="obolargus_calendars_header">
        <div>
          <h1 id="calendars-title">Exchange calendars</h1>
          <p>
            Session schedules shared by every chart and loader. Only the
            primary owner can change them.
          </p>
        </div>
        {!canWrite && (
          <p className="obolargus_calendars_note">
            Read-only: calendar changes are limited to the primary owner.
          </p>
        )}
      </header>
      {notice && (
        <p role="status" className="obolargus_calendars_notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="obolargus_calendars_error">
          {error}
        </p>
      )}
      {list.isPending && <p role="status">Loading calendars…</p>}
      {list.isError && <p role="alert">Calendars could not be loaded.</p>}
      {list.data && (
        <div className="obolargus_calendars_layout">
          <table className="obolargus_calendars_table">
            <caption className="obolargus_calendars_caption">
              Calendars
            </caption>
            <thead>
              <tr>
                <th scope="col">Venue</th>
                <th scope="col">Coverage</th>
                <th scope="col">Version</th>
                <th scope="col">Assigned</th>
                <th scope="col">Resolved</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {list.data.calendars.map((calendar) => (
                <tr
                  key={calendar.mic}
                  data-active={calendar.mic === selected}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className="obolargus_calendars_link"
                      onClick={() => setSelected(calendar.mic)}
                    >
                      {calendar.mic}
                    </button>
                    <span>{calendar.name}</span>
                  </th>
                  <td>
                    {calendar.coverage_from} to {calendar.coverage_to}
                  </td>
                  <td>{calendar.version}</td>
                  <td>{calendar.assigned_asset_count}</td>
                  <td>{calendar.resolved_asset_count}</td>
                  <td>{calendar.active ? "Active" : "Retired"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="obolargus_calendars_detail" aria-live="polite">
            {!selected && <p>Select a calendar to inspect or change it.</p>}
            {selected && detail.isPending && <p>Loading {selected}…</p>}
            {selected && detail.isError && (
              <p role="alert">{selected} could not be loaded.</p>
            )}
            {selected && detail.data && (
              <>
                <h2>
                  {detail.data.calendar.mic} — {detail.data.calendar.name}
                </h2>
                <dl>
                  <dt>Time zone</dt>
                  <dd>{detail.data.calendar.time_zone}</dd>
                  <dt>Source</dt>
                  <dd>{detail.data.calendar.source}</dd>
                  <dt>Provenance</dt>
                  <dd>{detail.data.calendar.provenance}</dd>
                  <dt>Exceptions</dt>
                  <dd>{detail.data.calendar.exceptions.length}</dd>
                  <dt>Audit entries</dt>
                  <dd>{detail.data.audit.length}</dd>
                </dl>
                {canWrite && (
                  <div className="obolargus_calendars_actions">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        report(() => {
                          void fetchCalendarExport(selected)
                            .then(download)
                            .catch((caught: unknown) =>
                              setError(
                                caught instanceof Error
                                  ? caught.message
                                  : "The export failed.",
                              ),
                            );
                        })
                      }
                    >
                      Export
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        report(() => {
                          retireMutation.mutate(
                            {
                              mic: selected,
                              confirm:
                                selectedSummary?.resolved_asset_count === 0 ||
                                window.confirm(
                                  "Confirm that affected instruments fall back to the weekday estimate.",
                                ),
                            },
                            {
                              onSuccess: () => {
                                setNotice(`${selected} retired.`);
                                setError(null);
                              },
                              onError: (caught) =>
                                setError(
                                  caught instanceof Error
                                    ? caught.message
                                    : "The retirement failed.",
                                ),
                            },
                          );
                        })
                      }
                    >
                      Retire
                    </Button>
                  </div>
                )}
                <h3>Import</h3>
                <textarea
                  aria-label="Calendar JSON document"
                  rows={6}
                  value={document}
                  onChange={(event) => setDocument(event.target.value)}
                  disabled={!canWrite}
                  placeholder='{"mic":"XNAS", …}'
                />
                <label>
                  Expected version
                  <input
                    inputMode="numeric"
                    value={expectedVersion}
                    onChange={(event) => setExpectedVersion(event.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <Button
                  variant="primary"
                  disabled={!canWrite || document.trim() === ""}
                  onClick={() =>
                    report(() => {
                      let parsed: CalendarDocument;
                      try {
                        parsed = JSON.parse(document) as CalendarDocument;
                      } catch {
                        setError("The pasted document is not valid JSON.");
                        return;
                      }
                      importMutation.mutate(
                        {
                          document: parsed,
                          expectedVersion:
                            expectedVersion.trim() === ""
                              ? null
                              : Number(expectedVersion),
                        },
                        {
                          onSuccess: (result) => {
                            setNotice(result.summary);
                            setError(null);
                          },
                          onError: (caught) =>
                            setError(
                              caught instanceof Error
                                ? caught.message
                                : "The import failed.",
                            ),
                        },
                      );
                    })
                  }
                >
                  Save calendar
                </Button>

                <h3>Assignments</h3>
                {assignments.isPending && <p>Loading assignments…</p>}
                {assignments.data && assignments.data.assignments.length === 0 && (
                  <p>No explicit assignments.</p>
                )}
                {assignments.data && assignments.data.assignments.length > 0 && (
                  <ul className="obolargus_calendars_assignments">
                    {assignments.data.assignments.map((entry) => (
                      <li key={entry.id}>
                        <span>
                          {entry.asset_identifier ?? entry.asset_display_name} ·{" "}
                          {entry.valid_from} to {entry.valid_to ?? "open"}
                        </span>
                        {canWrite && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              report(() => {
                                deleteAssignment.mutate(entry.id, {
                                  onSuccess: () => setNotice("Assignment removed."),
                                  onError: (caught) =>
                                    setError(
                                      caught instanceof Error
                                        ? caught.message
                                        : "The assignment could not be removed.",
                                    ),
                                });
                              })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canWrite && (
                  <form
                    className="obolargus_calendars_assign_form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      report(() => {
                        createAssignment.mutate(
                          {
                            asset_id: assignment.assetId.trim(),
                            mic: assignment.mic || selected,
                            valid_from: assignment.from,
                            valid_to: assignment.to.trim() || null,
                          },
                          {
                            onSuccess: () => {
                              setNotice("Assignment created.");
                              setAssignment({
                                assetId: "",
                                mic: "",
                                from: "",
                                to: "",
                              });
                            },
                            onError: (caught) =>
                              setError(
                                caught instanceof Error
                                  ? caught.message
                                  : "The assignment could not be created.",
                              ),
                          },
                        );
                      });
                    }}
                  >
                    <label>
                      Instrument id
                      <input
                        required
                        value={assignment.assetId}
                        onChange={(event) =>
                          setAssignment((current) => ({
                            ...current,
                            assetId: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Venue code
                      <input
                        value={assignment.mic}
                        placeholder={selected}
                        onChange={(event) =>
                          setAssignment((current) => ({
                            ...current,
                            mic: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      From
                      <input
                        required
                        type="date"
                        value={assignment.from}
                        onChange={(event) =>
                          setAssignment((current) => ({
                            ...current,
                            from: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      To (exclusive)
                      <input
                        type="date"
                        value={assignment.to}
                        onChange={(event) =>
                          setAssignment((current) => ({
                            ...current,
                            to: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <Button variant="secondary" type="submit">
                      Assign
                    </Button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default CalendarsPageView;
