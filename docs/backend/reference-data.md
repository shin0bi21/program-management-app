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
| `GET /reference-data/cycles` | `id`, `name`, `startsOn`, `endsOn`, `state` | Any consuming capability listed below |
| `GET /reference-data/programs` | `id`, `name` | Any consuming capability below, or `write:accounts` |
| `GET /reference-data/programs?assignedOnly=true` | Assigned program IDs and names | Any authenticated actor; the program-access policy determines assignments |
| `GET /reference-data/staff?feature=tasks` | Identity, display name, role, `writable` | `read:tasks`, with task read/write scope |
| `GET /reference-data/staff?feature=hours` | Identity, display name, role, `writable` | `read:hours`, with hours read/write scope |
| `GET /reference-data/schools` | `id`, `name` | Any of `read:schools`, `write:schools`, `read:youth_profiles` |

Cycle and unrestricted program consumers are `read:programs`, `write:programs`,
`read:sessions`, `read:tasks`, `read:hours`, `read:youth_profiles`, `read:outreach`,
and `read:accounts`. The additional program-only cases support account assignment
and the authenticated My Account page. These are alternative permissions for
minimal metadata, not permission to read or manage the complete domain records.
Management endpoints retain their existing permissions and record policies.

Staff results include only active staff/admin resources visible under the shared
staff-resource read policy. The required `feature` determines both read
authorization and the domain-specific `writable` flag. A Tasks capability must not
authorize an Hours lookup or make an Hours resource writable.

## Compose Feature-Owned Options

Keep domain choices beside their feature. `/tasks/reference-data` returns only
`categories` and `statuses`; `/hours/reference-data` returns only `categories` and
`types`. Their page hooks compose these results with shared cycle, program, and
staff queries. Avoid a global registry for unrelated statuses or categories.

Sessions require complete assigned program scheduling defaults, rather than just
labels. `GET /cohorts/sessions/reference-data` requires `read:sessions` and composes
the existing assigned-program query with session types. This feature endpoint
does not grant access to program management.

## Frontend Ownership and Reconciliation

`common/features/referenceData/referenceData.api.ts` owns projection types and
endpoint serialization. `hooks/useReferenceData.ts` owns query keys and forwards
cancellation through the centralized HTTP client. Keys include `assignedOnly`
for programs and `feature` for staff; these results must not share a cache entry.
`toFilterOptions` converts named projections to the standard filter option shape.
Page hooks compose these shared hooks with their own feature choices and expose
loading/error state per source. They do not fetch shared data from another page's
API adapter.

Successful mutations reconcile affected caches. Use authoritative responses when
they contain the complete projection; otherwise invalidate or refetch the shared
query. For example, cycle create/edit responses omit derived `state`, so Settings
refetches the canonical cycle projection instead of inserting an incomplete row.
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

## Verification Ownership

`backend/tests/referenceData/` covers route permissions, strict projections,
assignment/resource scope, and feature-specific staff capabilities. Feature tests
cover their local choices and composition. Frontend adapter tests verify paths,
scope serialization, and cancellation; shared hook tests verify cache keys and
scope separation. Page tests cover permission-specific wiring, reference failures,
and query gating rather than repeating generic query-cache mechanics.
