# Dates and Times

Use one domain representation from storage through API responses, frontend state,
forms, and save requests. Formatting changes labels, not stored values.

## Choose the Value

| Meaning | PostgreSQL | API and frontend |
|---|---|---|
| Business date: Session date, Task start/due date, Hours work date, Cycle boundary, DOB | `DATE` | `YYYY-MM-DD` string |
| Business clock time: Session start/end, program defaults | `TIME WITHOUT TIME ZONE` | `HH:mm` string |
| Exact event: authentication, audit, creation, update, cancellation | `TIMESTAMPTZ` | ISO timestamp representing a UTC instant |

Business dates use real Gregorian dates in years 0001–9999. Business clock times
use hours and minutes only; reject seconds and fractions. Sessions occur on one
date and require end time after start time. Overnight sessions are unsupported.
Date-range start and end bounds are inclusive.

## Preserve Shapes Across Layers

- Keep business dates and clock times unchanged across requests, saved rows,
  frontend drafts, and responses. Native date/time inputs use those same strings.
- Serialize PostgreSQL dates as `YYYY-MM-DD` and times as `HH:mm` at the query
  boundary. These projections prevent driver-specific values or seconds from
  leaking into the API; frontend adapters do not convert them back into timestamps.
- Use PostgreSQL date arithmetic in backend queries and `Temporal.PlainDate` /
  `Temporal.PlainTime` in the frontend for date-only arithmetic and formatting.
  Do not append noon, midnight, `Z`, or an offset merely to display a date or add days.
- A Session calendar move changes its business date and resolves the assigned
  cycle while preserving its start/end clock times. Calendar layout belongs to
  the frontend; backend validation owns saved dates, times, and relationships.

## Keep Timezone Work at Its Boundary

Saved business dates and clock times do not shift with the viewer's timezone.
Use the current Eastern context (`America/Toronto`) to determine today and
upcoming/completed status. Session daylight-saving validity checks remain an
explicit scheduling rule; they do not turn stored clock times into UTC values.
See [Session Creation and Ranges](../backend/api.md#session-creation-and-ranges)
for scheduling behavior. Configurable project timezone is separate future work.

Authentication, audit, and lifecycle events remain exact instants. Convert those
instants to a timezone only when a rule or display needs the corresponding local
date/time. Never reuse an event-timestamp conversion for a business date.
