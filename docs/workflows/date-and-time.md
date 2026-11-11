# Dates and Times

Use one domain representation from storage through API responses, frontend state,
forms, and save requests. Formatting changes labels, not stored values.

## Choose the Value

| Meaning | PostgreSQL | API and frontend |
|---|---|---|
| Business date: Session date, Task start/due date, Hours work date, Cycle boundary, enrollment/withdrawal date, DOB | `DATE` | `YYYY-MM-DD` string |
| Business clock time: Session start/end, program defaults | `TIME WITHOUT TIME ZONE` | `HH:mm` string |
| Exact event: authentication, audit, creation, update, cancellation | `TIMESTAMPTZ` | ISO timestamp representing a UTC instant |

Business dates use real Gregorian dates in years 0001–9999. Business clock times
use hours and minutes only; reject seconds and fractions. Sessions occur on one
date and require end time after start time. Overnight sessions are unsupported.
Date-range start and end bounds are inclusive.

## Preserve Shapes Across Layers

- Keep business dates and clock times unchanged across requests, saved rows,
  frontend drafts, and responses. Native date/time inputs use those same strings.
- The PostgreSQL client reads and writes `DATE` as `YYYY-MM-DD` strings; generated
  database types use strings too. Queries return date columns directly, without
  text/timestamp adapters. Serialize clock times as `HH:mm` at the query boundary;
  frontend adapters do not turn dates or clock values into timestamps.
- Use PostgreSQL date arithmetic in backend queries and `Temporal.PlainDate` /
  `Temporal.PlainTime` in application code for date-only arithmetic and formatting.
  Do not append noon, midnight, `Z`, or an offset merely to display a date or add days.
- A Session calendar move changes its business date and resolves the assigned
  cycle while preserving its start/end clock times. Calendar layout belongs to
  the frontend; backend validation owns saved dates, times, and relationships.

## Keep Timezone Work at Its Boundary

Business dates and clock times display exactly as saved, without program or
viewer timezone conversion. The calendar's Today action uses the viewer's local
calendar date and only changes navigation; it does not change any saved values.

Saved business dates and clock times are authoritative and never shift with the
viewer's timezone. Compare business dates directly for placement, cycle bounds,
and move eligibility. Session source and destination dates must both be strictly
after today; clock times do not affect this date-only rule. Accept valid, ordered
clock values on DST transition dates without constructing or validating instants.
Session completion and upcoming queries also compare dates only: dates before
today are completed; today and later dates are upcoming. Cancellation remains
separate. Attendance counts, public upcoming sessions, and program-cycle summaries
use the same boundary regardless of saved clock times.

The database and its connections retain their existing timezone configuration.
Backend current-day rules use PostgreSQL `CURRENT_DATE` / `LOCALTIME` directly.
Enrollment defaults and withdrawal writes use `CURRENT_DATE`; saved enrollment
dates remain date-only values for eligibility comparisons, without timezone conversion.
The frontend's `getDate()` uses `Temporal.Now.plainDateISO()` for local today.
Calendar period keys, bounds, anchors, and buffered dates remain `YYYY-MM-DD`
strings throughout. Determining today never changes a saved date.
See [Session Creation and Ranges](../backend/api.md#session-creation-and-ranges)
for scheduling behavior.

Authentication, audit, and lifecycle events remain exact UTC instants in storage
and transport. Format those instants in program Eastern time for display; do not
use the browser timezone. Never reuse an event-timestamp conversion for a business date.
