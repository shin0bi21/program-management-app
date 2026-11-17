# Shared Reference Data

Reference data supplies the small projections used by filters and selectors across
route families. Each shared lookup has one query under
`backend/src/services/referenceData/`, one HTTP adapter, and one frontend cache
contract. Feature services compose those lookups when necessary; they do not copy
their SQL into each feature's reference endpoint.

## Projections and Access

All paths below are relative to `/api`. Authentication, rate limiting, request
validation where applicable, and the normal error middleware still apply.

| Endpoint | Projection | Access |
|---|---|---|
| `GET /reference-data/cycles` | `id`, `title`, `startsOn`, `endsOn`, `state` | Any consuming capability listed below |
| `GET /reference-data/programs` | `id`, `title` | Any consuming capability below, or `write:accounts` |
| `GET /reference-data/programs?assignedOnly=true` | Assigned program IDs and titles | Any authenticated user; the program-access policy determines assignments |
| `GET /reference-data/staff?feature=tasks` | Identity, display name, role, `writable` | `read:tasks`, with task read/write scope |
| `GET /reference-data/staff?feature=hours` | Identity, display name, role, `writable` | `read:hours`, with hours read/write scope |
| `GET /reference-data/schools` | `id`, `name` | Any of `read:schools`, `write:schools`, `read:youth_profiles` |

Cycle and unrestricted program consumers are `read:programs`, `write:programs`,
`read:sessions`, `read:tasks`, `read:hours`, `read:youth_profiles`, `read:outreach`,
and `read:accounts`. The additional program-only cases support account assignment
and the authenticated My Account page. These are alternative permissions for
minimal metadata, not permission to read or manage the complete domain records.
Management endpoints retain their existing permissions and record policies.

Staff results include only active staff, project managers, and administrators visible under the shared
staff read policy. Use `staff` and the canonical `StaffReference` projection throughout
these workflows; identities remain stored in `users`, and `staffId` refers to a user ID.
Generic calendar infrastructure still uses rows for staff or programs. The required `feature` determines both read
authorization and the domain-specific `writable` flag. A Tasks capability must not
authorize an Hours lookup or make a staff member writable in Hours.

## Compose Feature-Owned Options

Keep domain choices beside their feature. `/tasks/reference-data` returns only
`categories` and `statuses`; `/hours/reference-data` returns only `categories` and
`types`. Their page hooks compose these results with shared cycle, program, and
staff queries. Avoid a global registry for unrelated statuses or categories.
Declare enum choices explicitly as `{ id, name }` so display wording stays visible at the feature owner.

Sessions require complete assigned program scheduling defaults, rather than just
labels. `GET /sessions/reference-data` requires `read:sessions` and composes
the existing assigned-program query with session types. This feature endpoint
does not grant access to program management.

## Frontend Ownership and Reconciliation

`common/features/referenceData/referenceData.api.ts` owns projection types and
endpoint serialization. `hooks/useReferenceData.ts` owns query keys and forwards
cancellation through the centralized HTTP client. Keys include `assignedOnly`
for programs and `feature` for staff; these results must not share a cache entry.
Program and Cycle references use `{ id, title }`; Staff and School references
retain `name`. Shared option controls accept `{ id, label }`. Map domain rows
once at the control boundary, using their `title` or `name` as the label. Keep
reference rows intact in the cache, including cycle date bounds. Filters display
`label` and persist or submit only selected IDs. Look up those IDs in reference
data when a consumer needs additional fields.
Page hooks compose these shared hooks with their own feature choices and expose
loading/error state per source. They do not fetch shared data from another page's
API adapter.

Successful mutations reconcile affected caches. Use authoritative responses when
they contain the complete projection; otherwise invalidate or refetch the shared
query. For example, cycle create/edit responses include canonical `state`, so Programs
reconciles both the cycle table and any loaded shared cycle choices from that response.
Program edits also invalidate shared program labels and Sessions scheduling
references. School edits reconcile the shared school cache.
Account identity/status edits invalidate staff references; assignment edits also
invalidate assigned program labels and Sessions scheduling references.

Distinguish failed lookups from successful empty results. Do not erase saved
filter IDs because a reference source failed. Sessions, Tasks, and Hours require
cycle bounds before querying either their table or calendar; a failed source,
including an error with cached rows, must not trigger an unbounded collection
request. An empty cycle selection means all available cycles, while a successful
empty cycle lookup means no calendar range is available.
