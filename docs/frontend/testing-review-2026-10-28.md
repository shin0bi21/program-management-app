# Frontend testing review — October 28, 2026

The test-standardization diff preserves the important coverage reviewed. Its ownership
rules and paired scaffolds agree with the implementation structure. The wider suite has
specific duplication and coverage gaps; its size alone does not justify broad deletion.
One pre-existing contact-type mismatch was found while tracing a test boundary and has
now been resolved according to the product decision below.

This is a dated review record, not a replacement for the [testing standard](../workflows/testing.md)
or [page test convention](pages/README.md#test-page-coordination). The original audit was read-only. The user subsequently authorized the following fixes;
this status table supersedes the original recommendations and snapshot ledger below.

## Follow-up implementation

| Finding | Resolution |
|---|---|
| R1 — contact relationship | Product decision: primary contacts already serve as emergency contacts. Removed `emergency` from Youth validation and the database enum; retained parent/sibling/guardian. Added one regression case covering both Youth write endpoints. Existing valid fixtures use supported relationships. |
| R2 — auth teardown | Provider tests cover successful/rejected server logout and cross-tab token removal, checking auth state, cache and navigation. |
| R3 — retry limit | Added one 401-then-401 regression proving rejection after the single retry. |
| R4 — re-login | Component retains one composed password/verification flow; hook owns direct login, verification/resend, and three command-failure cases with no persistence/completion. |
| R5 — dashboard duplication | Replaced four broad Sessions dashboard tests with two composition/wiring tests. Actual child prop types and the shared session fixture keep mocks aligned. |
| R6 — hero duplication | Removed the repeated parent fallback scenario; the child test now also asserts the desktop source. |
| R7 — Auth form wiring | Added one valid submission per Login, ResetPassword and VerifyPassword form. |
| R8 — state owners | Added focused roster invalidation, list removal, infinite-query failure/retry and calendar storage recovery cases; extended existing pagination assertions. |
| Helper identity assertion | Improved the existing QueryClient helper test rather than adding another case. |

The contact migration was applied to local development and test databases and database
types were regenerated. Both databases had zero obsolete relationship values. The full
73-migration chain passed on an empty temporary database. A synthetic obsolete record
made the new migration fail and roll back with that record intact; valid relationship
records and the default survived successful conversion. The temporary database was removed.
A deployment containing obsolete values must classify them from verified relationship
information before this migration can proceed; it does not guess or delete contacts.

Validation: Youth **87 tests** and Leads/public signup **50 tests** passed. The final
focused frontend run passed **15 files / 49 tests** after the refinements. A full frontend
run also passed earlier during implementation; concurrent rendering changes after it
are not covered by that evidence. Typecheck and focused lint passed. Browser execution
is not claimed by these results.

The concurrent dashboard/calendar work remains separate from these fixes. The user also
requested two shared dashboard height standards: **normal 125px** by default and
**short 75px** for Hours/Tasks. Both program and session cards in Programming remain
normal. Existing dashboard suites passed **5 files / 20 tests** after the height changes.
These height changes do not imply review of the other concurrent rendering or selection changes. Optional payload-assertion reductions beyond
the named findings were left alone. The final whole-tree pattern check reported one
blocking naming issue in the concurrently changed `HomepageSignupSetting.tsx`: extracted
dashboard cards must use the `*DashboardCard` convention. It also reported five nonblocking
workflow-review signals in concurrently changed page/card sources. Those broader changes
are outside this follow-up's review; the entire working tree is not approved for shipping.

## Scope and concern map

One concern: **frontend test ownership, setup, reading order, and paired scaffolding**.
The input snapshot was `sha256:1bc563caa9e4767f37d30afd9b1802ac6efb3d0d64db4a45e5170a4adcc50f89`
on `develop`, with 36 modified paths and no committed branch changes. It contains 30
frontend test files, three documentation files, and three scaffold files. There are no
application implementation, backend, migration, dependency, or CI changes in that diff.
The exact changed suites are marked in the ledger below. Documentation added by this
review belongs to the same concern. Shipping is not part of this review.

A main reviewer owns this report, severity calibration, infrastructure/scaffold review,
and verification of delegated findings. Three reviewers read the page and common-owner
suites in separate lanes:

| Lane | Test files read |
|---|---:|
| Staff and Programming pages | 95 |
| Auth, Homepage, Leads, Settings, Youth pages | 115 |
| Common components, features, hooks, utilities | 91 |
| App, auth infrastructure, HTTP, query, test helpers | 23 |
| Total colocated frontend suites | 324 |

All six Playwright specs and their nine referenced common/page stories were also read.
The review examined test bodies, changed assertions, sibling ownership, and relevant
implementation boundaries. It is not a statement-coverage measurement, a full backend
audit, or a fresh browser execution. Every rendered page/common-component source file
in the inventory has a matching colocated suite; existence alone does not establish adequacy.

## Findings

### R1 — Medium: a supported contact relationship is missing from the frontend contract

**Pre-existing product mismatch, outside the cleanup diff.** The backend
[youth contact schema](../../backend/src/validation/youthSchemas.ts#L5) accepts
`emergency`, and the [record projection](../../backend/src/services/youth/youthRecordQuery.ts#L137)
returns the stored type. The frontend [contact hook](../../frontend/src/common/features/contacts/hooks/useContacts.ts#L3)
and [request type](../../frontend/src/pages/Youth/youth.api.ts#L14) include only parent,
sibling, and guardian. The [Youth form](../../frontend/src/pages/Youth/components/YouthModal/YouthModal.tsx#L201)
also supplies only those three options. An emergency contact can reach the form through
`initialize`; the cast preserves it, but FloatingSelect has no matching label and displays
its placeholder. This is valid backend data, not a hypothetical malformed response.

The original proposed correction was to expose the backend value in the form. The user
clarified that this was the wrong domain model: primary contacts already serve the emergency
role, while the relationship should remain parent/sibling/guardian. The implemented correction
removes `emergency` from backend validation and persistence instead, with a guard for existing
rows. It does not add a frontend option or silently relabel existing relationships.

### R2 — Medium: authentication teardown lacks owner-level regression coverage

**Pre-existing coverage gap.** [AuthProvider.test.tsx:48](../../frontend/src/auth/AuthProvider.test.tsx#L48)
only checks signed-out initialization preserving a public query. The provider also clears
cached data, authentication state, and navigation on logout and cross-tab token removal.
Storage helper tests do not prove those operations are connected in the provider.

Add focused provider tests using seeded private cache data for explicit logout and token
removal via a storage event, including local cleanup when the logout request fails. Keep
the public-query regression. The production QueryClient used here is intentional because
the provider owns that singleton; do not replace it blindly with an unrelated test client.
No failure of the current implementation was demonstrated.

### R3 — Low: the HTTP retry test does not prove its stated retry limit

**Pre-existing coverage gap.** [client.test.ts:46](../../frontend/src/http/client.test.ts#L46)
is named “retries only once” but returns 401 followed by 200. An implementation that keeps
retrying on repeated 401 responses would also pass. Add a 401-then-401 case asserting rejection,
two requests, and no further re-authentication prompt. This belongs in the HTTP client suite,
not every page or API adapter. The current implementation has a single retry branch.

### R4 — Low: re-login repeats the happy path while leaving failure recovery uncovered

**Pre-existing ownership/coverage gap.** [ReLoginModal.test.tsx:36](../../frontend/src/auth/reauth/components/ReLoginModal/ReLoginModal.test.tsx#L36)
and [useReLogin.test.ts:37](../../frontend/src/auth/reauth/components/ReLoginModal/useReLogin.test.ts#L37)
both verify the exact login call, token storage, and completion. The hook has no focused
password, verification, or resend failure/recovery cases despite owning those transitions.

Keep modal composition, accessible step selection, and submission wiring. Put exact API,
storage, verification/resend transitions, errors, and pending-state recovery in the hook
suite. Retain a representative composed success flow if it protects distinct wiring;
do not delete all integration coverage simply because the hook has a suite.

### R5 — Low: Sessions dashboard repeats descendant workflows

**Pre-existing reduction opportunity.** [SessionDashboard.test.tsx:98](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionDashboard.test.tsx#L98)
rechecks attendance actions, note details, attachment viewing/zooming, and attachment editing.
The dashboard implementation composes three cards and combines errors. Direct card, note
detail, attachment editor, and viewer suites already cover those descendant contracts.

Replace the broad child flows with concise composition and boundary-wiring assertions:
selected session/query key/permissions reach the proper cards, attendance callback is
connected, and child errors reach the page. Preserve any unique assertion by moving it
to its actual owner before removing the parent case. The existing dashboard error-hook
suite should retain aggregation behavior. This is the clearest substantial reduction target.

### R6 — Low: HeroSection repeats HeroPhoto's image fallback lifecycle

**Pre-existing reduction opportunity.** [HeroSection.test.tsx:76](../../frontend/src/pages/Homepage/PublicHomepage/components/HeroSection/HeroSection.test.tsx#L76)
repeats the failed mobile source followed by unavailable display-image case in
[HeroPhoto.test.tsx:6](../../frontend/src/pages/Homepage/PublicHomepage/components/HeroSection/HeroPhoto.test.tsx#L6).
Keep the fallback sequence in HeroPhoto; move any unique desktop-source assertion there.
HeroSection should retain active-photo/caption composition, navigation, loading/error,
and preload behavior. Remove the duplicate fallback scenario from the parent.

### R7 — Low: valid Auth form submission wiring is not exercised

**Pre-existing coverage gap.** Login's page suite covers authenticated redirects and invalid
credentials; ResetPassword covers missing-token and mismatch states; VerifyPassword covers
input/resend behavior. Their hook suites cover successful commands independently. A valid
submit disconnected from the hook could escape these tests.

Add one representative valid submission through each form and assert its observable
completion/status or consumer callback. Keep detailed payload, session, delay, and retry
matrices in the hooks. References: [Login.test.tsx:58](../../frontend/src/pages/Auth/Login/Login.test.tsx#L58),
[ResetPassword.test.tsx:31](../../frontend/src/pages/Auth/ResetPassword/ResetPassword.test.tsx#L31),
and [VerifyPassword.test.tsx](../../frontend/src/pages/Auth/VerifyPassword/VerifyPassword.test.tsx).

### R8 — Low: a few authoritative state-owner contracts lack direct cases

**Pre-existing coverage gaps; these are targeted additions, not a lifecycle checklist.**

- [useCohortActions.test.ts:16](../../frontend/src/pages/Programming/Cohorts/hooks/actions/useCohortActions.test.ts#L16)
  covers deletion, but not `refreshRoster` invalidating the cohort table/options and youth
  queries. The roster modal only proves it calls the callback. Assert this set in the action
  hook rather than through the page.
- [useInfiniteListQuery.test.tsx](../../frontend/src/query/hooks/useInfiniteListQuery.test.tsx)
  covers cursors, deduplication and retained rows on key change, but not its error mapping,
  retry callback, or the distinction between refresh and next-page loading. Qualify the
  existing cursor case with pending-state assertions and add a focused failure/retry case.
  Do not add this generic matrix to every domain table hook.
- [useListQuery.test.tsx](../../frontend/src/query/hooks/useListQuery.test.tsx) covers upsert;
  the wrapper's own `remove` cache behavior has no direct case. Add a focused removal case
  preserving other records; avoid tests that merely re-prove TanStack Query.
- [calendarPosition.ts:10](../../frontend/src/common/components/TimelineCalendar/utils/calendarPosition.ts#L10)
  explicitly removes corrupt JSON, invalid dates and invalid offsets from storage. Existing
  browser restore cases use valid saved values. Put malformed-storage recovery in a focused
  utility suite, not in every calendar page or an expanded browser matrix.

## Optional improvements and rejected reductions

[queryClientTestUtils.test.tsx:23](../../frontend/src/tests/queryClientTestUtils.test.tsx#L23)
claims to return the provided client, but renders a plain span and only checks that the
returned client has a cache. Replace that weak assertion with a `useQueryClient` probe and
compare the observed and returned instances. This improves the same test without adding
another case.

SignupSection/useSignupSection and LeadModal/useLeadModal repeat some exact normalized
payload assertions. Keep form validation, field wiring, and visible success; centralize
normalization permutations in the hooks when editing these suites. This is optional:
a real-hook form submission is useful integration coverage and is not itself over-testing.

Do not reduce finite status/capability mappings merely because they have several cases.
HoursTypeLabel's CSS/label output differs from the pure classification utility's contract.
Likewise, page selection reaching a dashboard differs from a table emitting a selected row.
Shared calendar pointer/geometry/lifecycle tests and real-browser tests cover different
failure modes; no broad reduction was justified there. Repeated source fixtures are not
proof of repeated behavioral coverage.

## Standardization assessment

| Accepted change | Review result |
|---|---|
| Shared QueryClient setup and local page renderers | Aligned; changed suites retain isolated clients and assertions. Synchronous cache-helper tests and the AuthProvider singleton regression are justified exceptions to wrapper use. |
| Hours fixture cleanup | Aligned; explicit API responses replace a mock server's filtering/sorting logic; page assertions still describe filters, bounds, readiness and coordination. |
| Sessions typed mock and fixture | Aligned; mock props derive from the actual calendar contract, with meaningful selection/deletion/permission/dialog coverage retained. |
| Homepage image modal component/hook split | Aligned; component covers fields/wiring, workflow covers commands and success/error sequencing. |
| UserTable/CohortTable adapter tests | Aligned; typed shared-Table mocks check inputs, states, callbacks and domain selection behavior without re-proving shared rendering. |
| Shared Table duplicate removal | Aligned; the remaining unavailable-state case covers header, title, message and retry together. |
| Five page reading groups | Aligned for substantial page suites; small cohesive suites need no empty headings. Tests remain independent, not an execution pipeline. |
| Code and test scaffolding | Aligned: page/table/modal generate component and hook test pairs; calendar/dashboard generate their own test pair. Generated cases are TODO prompts, not completed coverage. |
| Full-suite adoption | Substantially aligned, with the pre-existing exceptions above. No claim that every suite must look identical. |

The canonical guidance already states finite-contract coverage and smallest-owner testing;
the findings are adoption/coverage gaps, not a need for another competing standard.
Code reads in execution/lifecycle order. Tests read by observable behavior, with error cases
beside the behavior they qualify. Matching ownership does not mean copying source statement
order into test headings.

## Page-level assessment

The detailed ledger below lists each page, nested component, hook, adapter and utility suite.
These summaries explain which contracts should remain at the page boundary.

| Page | Preserve at the page boundary | Assessment |
|---|---|---|
| Auth/ForgotPassword | Validation, submit/status and back navigation | Keep |
| Auth/Login | Existing-session destination and form-to-workflow wiring | Keep; R7 |
| Auth/ResetPassword | Token availability, form validation and visible completion | Keep; R7 |
| Auth/VerifyPassword | Code/resend controls and verification handoff | Keep; R7 |
| Homepage/ManageHomepage | Permission-aware image management, modal targets and signup setting coordination | Keep |
| Homepage/PublicHomepage | Section composition/readiness and route/scroll coordination | Keep; R6 is in its HeroSection child |
| Leads | Origin/search controls, selected lead, dashboard/dialog/action coordination | Keep |
| Programming/Cohorts | Readiness, cohort selection, roster/dialog coordination | Keep; action owner has R8 |
| Programming/Sessions | Shared filters/cycle gates, table/calendar selection, URL and dialog coordination | Keep; dashboard child has R5 |
| Settings/Account | Identity/program presentation and retry wiring | Keep |
| Settings/Programming | Program/cycle composition and command/dialog targets | Keep |
| Settings/Users | Permission/search controls and account action/dialog coordination | Keep |
| Staff/Hours | Resource permissions, cycle bounds, cross-view controls/selection and commands | Keep |
| Staff/Tasks | Readiness, cycles, filters, selected task and page-owned workflows | Keep |
| Youth | Profile selection, table/dashboard/dialog wiring and saved-result coordination | Keep; YouthModal/contact owner has R1 |

## Verification and handoff

Reused evidence from the unchanged implementation work: full frontend run **324 files /
1,209 tests passed**; final reordered page subset **83 tests passed**; current scaffold
suite **6 tests passed**; root typecheck, focused scaffold lint, changed-pattern and
whitespace checks passed. The earlier broader lint run had three warnings in unchanged
application files (`FilterCategoryCard.tsx`, `useCycleModal.ts`, `HoursCalendar.tsx`).

No frontend or browser suites were rerun solely because review began. No tests were added
to prove findings: gaps are established by the inspected assertion/source boundaries, and
R1 by the supported backend value traced into the frontend selector. Browser runtime
behavior was read, not freshly executed. This review authored only this audit document. Changed-pattern and whitespace checks
passed, and all local report links resolved. These checks do not establish coverage or
validate browser layout.

At handoff, the map has two concerns: (1) the 36 original cleanup paths plus this
report; (2) a concurrent, unrelated change to
[Item.css](../../frontend/src/common/components/TimelineCalendar/components/Item/Item.css),
replacing fixed detail-label widths with a shared intrinsic grid/subgrid. The CSS path
appeared after the input snapshot and was left untouched. It requires its own review and
browser-layout verification; earlier test evidence does not validate that new CSS change.
There is no dependency between these concerns.

The cleanup remains one reviewable concern with no introduced correctness defect found.
R1 is a separate proposed product fix, not silently included in this diff. Other findings
are follow-up test maintenance. They were subsequently addressed as listed in the follow-up table above.
Implementation does not authorize shipping or deployment.

## Complete suite ledger

Every path below was read. **Changed** marks the input diff, not a test run in this review.
**Keep** means no specific reduction or gap was identified for that suite, not proof of
complete behavior coverage. Findings are linked where their owner or consumer is affected.
Boundary labels describe the owner's role; composed tests may run real children while
asserting that role. Shared primitive mechanics belong in their shared owner suites.

### app — 4 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [App.test.tsx](../../frontend/src/app/App.test.tsx) | Component rendering / public wiring | Keep |
| [ErrorBoundary/ErrorBoundary.test.tsx](../../frontend/src/app/ErrorBoundary/ErrorBoundary.test.tsx) | Component rendering / public wiring | Keep |
| [components/AppNavigation/AppNavigation.test.tsx](../../frontend/src/app/components/AppNavigation/AppNavigation.test.tsx) | Component rendering / public wiring | Keep |
| [components/AppNavigation/useAppNavigation.test.tsx](../../frontend/src/app/components/AppNavigation/useAppNavigation.test.tsx) | Hook policy, state or lifecycle | Keep |

### auth — 12 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [AuthProvider.test.tsx](../../frontend/src/auth/AuthProvider.test.tsx) | Component rendering / public wiring | R2: add teardown/cache-isolation coverage |
| [accessToken.test.ts](../../frontend/src/auth/accessToken.test.ts) | Policy / utility / infrastructure | Keep |
| [auth.api.test.ts](../../frontend/src/auth/auth.api.test.ts) | API adapter / serialization | Keep |
| [deviceFingerprint.test.ts](../../frontend/src/auth/deviceFingerprint.test.ts) | Policy / utility / infrastructure | Keep |
| [jwt.test.ts](../../frontend/src/auth/jwt.test.ts) | Policy / utility / infrastructure | Keep |
| [reauth/ReAuthProvider.test.tsx](../../frontend/src/auth/reauth/ReAuthProvider.test.tsx) | Component rendering / public wiring | Keep |
| [reauth/components/ReLoginModal/ReLoginModal.test.tsx](../../frontend/src/auth/reauth/components/ReLoginModal/ReLoginModal.test.tsx) | Component rendering / public wiring | R4: retain wiring; trim duplicate hook assertions |
| [reauth/components/ReLoginModal/components/PasswordStep.test.tsx](../../frontend/src/auth/reauth/components/ReLoginModal/components/PasswordStep.test.tsx) | Component rendering / public wiring | Keep |
| [reauth/components/ReLoginModal/components/VerificationStep.test.tsx](../../frontend/src/auth/reauth/components/ReLoginModal/components/VerificationStep.test.tsx) | Component rendering / public wiring | Keep |
| [reauth/components/ReLoginModal/useReLogin.test.ts](../../frontend/src/auth/reauth/components/ReLoginModal/useReLogin.test.ts) | Hook policy, state or lifecycle | R4: add failure/recovery lifecycle |
| [reauth/reAuthCoordinator.test.ts](../../frontend/src/auth/reauth/reAuthCoordinator.test.ts) | Policy / utility / infrastructure | Keep |
| [storage.test.ts](../../frontend/src/auth/storage.test.ts) | Policy / utility / infrastructure | Keep |

### common/components/ActionsMenu — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ActionsMenu.test.tsx](../../frontend/src/common/components/ActionsMenu/ActionsMenu.test.tsx) | Component rendering / public wiring | Keep |

### common/components/AuthLayout — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [AuthLayout.test.tsx](../../frontend/src/common/components/AuthLayout/AuthLayout.test.tsx) | Component rendering / public wiring | Keep |

### common/components/Badge — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Badge.test.tsx](../../frontend/src/common/components/Badge/Badge.test.tsx) | Component rendering / public wiring | Keep |

### common/components/Button — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Button.test.tsx](../../frontend/src/common/components/Button/Button.test.tsx) | Component rendering / public wiring | Keep |

### common/components/ColumnVisibilityMenu — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ColumnVisibilityMenu.test.tsx](../../frontend/src/common/components/ColumnVisibilityMenu/ColumnVisibilityMenu.test.tsx) | Component rendering / public wiring | Keep |

### common/components/ConfirmModal — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ConfirmModal.test.tsx](../../frontend/src/common/components/ConfirmModal/ConfirmModal.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useConfirmModal.test.tsx](../../frontend/src/common/components/ConfirmModal/hooks/useConfirmModal.test.tsx) | Hook policy, state or lifecycle | Keep |

### common/components/DashboardCard — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [DashboardCard.test.tsx](../../frontend/src/common/components/DashboardCard/DashboardCard.test.tsx) | Component rendering / public wiring | Keep |

### common/components/FilterCard — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [FilterCard.test.tsx](../../frontend/src/common/components/FilterCard/FilterCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/FilterCategoryCard.test.tsx](../../frontend/src/common/components/FilterCard/components/FilterCategoryCard.test.tsx) | Component rendering / public wiring | Keep |

### common/components/FloatingMenu — 4 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [FloatingMenuPanel.test.tsx](../../frontend/src/common/components/FloatingMenu/FloatingMenuPanel.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useFloatingMenu.test.ts](../../frontend/src/common/components/FloatingMenu/hooks/useFloatingMenu.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useViewportDismissal.test.tsx](../../frontend/src/common/components/FloatingMenu/hooks/useViewportDismissal.test.tsx) | Hook policy, state or lifecycle | Keep |
| [utils/floatingPosition.test.ts](../../frontend/src/common/components/FloatingMenu/utils/floatingPosition.test.ts) | Policy / utility / infrastructure | Keep |

### common/components/FloatingSelect — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [FloatingSelect.test.tsx](../../frontend/src/common/components/FloatingSelect/FloatingSelect.test.tsx) | Component rendering / public wiring | Keep |

### common/components/FormField — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [FormField.test.tsx](../../frontend/src/common/components/FormField/FormField.test.tsx) | Component rendering / public wiring | Keep |

### common/components/LoadingSpinner — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [LoadingSpinner.test.tsx](../../frontend/src/common/components/LoadingSpinner/LoadingSpinner.test.tsx) | Component rendering / public wiring | Keep |

### common/components/Modal — 3 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Modal.test.tsx](../../frontend/src/common/components/Modal/Modal.test.tsx) | Component rendering / public wiring | Keep |
| [components/ModalFormFooter.test.tsx](../../frontend/src/common/components/Modal/components/ModalFormFooter.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useModalFocusTrap.test.tsx](../../frontend/src/common/components/Modal/hooks/useModalFocusTrap.test.tsx) | Hook policy, state or lifecycle | Keep |

### common/components/PageBody — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [PageBody.test.tsx](../../frontend/src/common/components/PageBody/PageBody.test.tsx) | Component rendering / public wiring | Keep |

### common/components/PageErrorOverlay — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [PageErrorOverlay.test.tsx](../../frontend/src/common/components/PageErrorOverlay/PageErrorOverlay.test.tsx) | Component rendering / public wiring | Keep |
| [usePageErrorReporter.test.tsx](../../frontend/src/common/components/PageErrorOverlay/usePageErrorReporter.test.tsx) | Hook policy, state or lifecycle | Keep |

### common/components/PageHeader — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [PageHeader.test.tsx](../../frontend/src/common/components/PageHeader/PageHeader.test.tsx) | Component rendering / public wiring | Keep |

### common/components/ProtectedRoute — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ProtectedRoute.test.tsx](../../frontend/src/common/components/ProtectedRoute/ProtectedRoute.test.tsx) | Component rendering / public wiring | Keep |

### common/components/RouteLoading — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [RouteLoading.test.tsx](../../frontend/src/common/components/RouteLoading/RouteLoading.test.tsx) | Component rendering / public wiring | Keep |

### common/components/SearchInput — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [SearchInput.test.tsx](../../frontend/src/common/components/SearchInput/SearchInput.test.tsx) | Component rendering / public wiring | Keep |

### common/components/StatusBadge — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [StatusBadge.test.tsx](../../frontend/src/common/components/StatusBadge/StatusBadge.test.tsx) | Component rendering / public wiring | Keep |

### common/components/Table — 8 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Table.test.tsx](../../frontend/src/common/components/Table/Table.test.tsx) | Component rendering / public wiring | Keep; changed |
| [Table.types.test.ts](../../frontend/src/common/components/Table/Table.types.test.ts) | Type contract | Keep |
| [components/TableBody.test.tsx](../../frontend/src/common/components/Table/components/TableBody.test.tsx) | Component rendering / public wiring | Keep |
| [components/TableHeader.test.tsx](../../frontend/src/common/components/Table/components/TableHeader.test.tsx) | Component rendering / public wiring | Keep |
| [components/TableRow.test.tsx](../../frontend/src/common/components/Table/components/TableRow.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useTableInfiniteScroll.test.ts](../../frontend/src/common/components/Table/hooks/useTableInfiniteScroll.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useTableModel.test.ts](../../frontend/src/common/components/Table/hooks/useTableModel.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useTableNavigation.test.ts](../../frontend/src/common/components/Table/hooks/useTableNavigation.test.ts) | Hook policy, state or lifecycle | Keep |

### common/components/TimelineCalendar — 19 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [TimelineCalendar.test.tsx](../../frontend/src/common/components/TimelineCalendar/TimelineCalendar.test.tsx) | Component rendering / public wiring | Keep |
| [components/Cell/Cell.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Cell/Cell.test.tsx) | Component rendering / public wiring | Keep |
| [components/Cell/hooks/useCellActions/useCellActions.test.ts](../../frontend/src/common/components/TimelineCalendar/components/Cell/hooks/useCellActions/useCellActions.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/Grid/Grid.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Grid/Grid.test.tsx) | Component rendering / public wiring | Keep |
| [components/Item/Item.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Item/Item.test.tsx) | Component rendering / public wiring | Keep |
| [components/Item/hooks/useItemDetails/useItemDetails.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Item/hooks/useItemDetails/useItemDetails.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/Item/hooks/useItemMenu/useItemMenu.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Item/hooks/useItemMenu/useItemMenu.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/Item/hooks/useItemMove/useItemMove.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Item/hooks/useItemMove/useItemMove.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/Item/hooks/useItemResize/useItemResize.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Item/hooks/useItemResize/useItemResize.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/Item/utils/getVisibleItemAnchor.test.ts](../../frontend/src/common/components/TimelineCalendar/components/Item/utils/getVisibleItemAnchor.test.ts) | Policy / utility / infrastructure | Keep |
| [components/Row/Row.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Row/Row.test.tsx) | Component rendering / public wiring | Keep |
| [components/Toolbar/Toolbar.test.tsx](../../frontend/src/common/components/TimelineCalendar/components/Toolbar/Toolbar.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useDataBuffer/DataBuffer.test.ts](../../frontend/src/common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer.test.ts) | Component rendering / public wiring | Keep |
| [hooks/useDataBuffer/useDataBuffer.test.ts](../../frontend/src/common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/usePeriodVirtualization/usePeriodVirtualization.test.ts](../../frontend/src/common/components/TimelineCalendar/hooks/usePeriodVirtualization/usePeriodVirtualization.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/usePointerSession/usePointerSession.test.ts](../../frontend/src/common/components/TimelineCalendar/hooks/usePointerSession/usePointerSession.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useRowVirtualization/useRowVirtualization.test.ts](../../frontend/src/common/components/TimelineCalendar/hooks/useRowVirtualization/useRowVirtualization.test.ts) | Hook policy, state or lifecycle | Keep |
| [utils/itemPosition.test.ts](../../frontend/src/common/components/TimelineCalendar/utils/itemPosition.test.ts) | Policy / utility / infrastructure | Keep |
| [utils/periods.test.ts](../../frontend/src/common/components/TimelineCalendar/utils/periods.test.ts) | Policy / utility / infrastructure | Keep |

### common/components/UnavailableState — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [UnavailableState.test.tsx](../../frontend/src/common/components/UnavailableState/UnavailableState.test.tsx) | Component rendering / public wiring | Keep |

### common/components/ViewMenu — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ViewMenu.test.tsx](../../frontend/src/common/components/ViewMenu/ViewMenu.test.tsx) | Component rendering / public wiring | Keep |

### common/features/AttendanceStatusSelect — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [AttendanceStatusSelect.test.tsx](../../frontend/src/common/features/AttendanceStatusSelect/AttendanceStatusSelect.test.tsx) | Component rendering / public wiring | Keep |

### common/features/Notes — 4 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [NoteCategoryBadge/NoteCategoryBadge.test.tsx](../../frontend/src/common/features/Notes/NoteCategoryBadge/NoteCategoryBadge.test.tsx) | Component rendering / public wiring | Keep |
| [NoteDetails/NoteDetails.test.tsx](../../frontend/src/common/features/Notes/NoteDetails/NoteDetails.test.tsx) | Component rendering / public wiring | Keep |
| [NoteModal/NoteModal.test.tsx](../../frontend/src/common/features/Notes/NoteModal/NoteModal.test.tsx) | Component rendering / public wiring | Keep |
| [NoteRow/NoteRow.test.tsx](../../frontend/src/common/features/Notes/NoteRow/NoteRow.test.tsx) | Component rendering / public wiring | Keep |

### common/features/OutreachForm — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [OutreachFormFields.test.tsx](../../frontend/src/common/features/OutreachForm/OutreachFormFields.test.tsx) | Component rendering / public wiring | Keep |
| [outreachFormSchema.test.ts](../../frontend/src/common/features/OutreachForm/outreachFormSchema.test.ts) | Policy / utility / infrastructure | Keep |

### common/features/Preferences — 3 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [preferences.api.test.ts](../../frontend/src/common/features/Preferences/preferences.api.test.ts) | API adapter / serialization | Keep |
| [preferences.test.ts](../../frontend/src/common/features/Preferences/preferences.test.ts) | Policy / utility / infrastructure | Keep |
| [usePreferences.test.tsx](../../frontend/src/common/features/Preferences/usePreferences.test.tsx) | Hook policy, state or lifecycle | Keep |

### common/features/SchoolModal — 4 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [SchoolModal.test.tsx](../../frontend/src/common/features/SchoolModal/SchoolModal.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useSchoolModal.test.ts](../../frontend/src/common/features/SchoolModal/hooks/useSchoolModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useSchools.test.tsx](../../frontend/src/common/features/SchoolModal/hooks/useSchools.test.tsx) | Hook policy, state or lifecycle | Keep |
| [schoolModal.api.test.ts](../../frontend/src/common/features/SchoolModal/schoolModal.api.test.ts) | API adapter / serialization | Keep |

### common/features/ViewFileModal — 3 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ViewFileModal.test.tsx](../../frontend/src/common/features/ViewFileModal/ViewFileModal.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useFilePreview.test.ts](../../frontend/src/common/features/ViewFileModal/hooks/useFilePreview.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useViewFileModal.test.ts](../../frontend/src/common/features/ViewFileModal/hooks/useViewFileModal.test.ts) | Hook policy, state or lifecycle | Keep |

### common/features/YouthReportModal — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [YouthReportModal.test.tsx](../../frontend/src/common/features/YouthReportModal/YouthReportModal.test.tsx) | Component rendering / public wiring | Keep |
| [youthReport.api.test.ts](../../frontend/src/common/features/YouthReportModal/youthReport.api.test.ts) | API adapter / serialization | Keep |

### common/features/contacts — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [components/PrimaryContactDashboardCard/PrimaryContactDashboardCard.test.tsx](../../frontend/src/common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useContacts.test.ts](../../frontend/src/common/features/contacts/hooks/useContacts.test.ts) | Hook policy, state or lifecycle | R1: supported emergency relationship |

### common/features/programming — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [cycles/cycleDateRange.test.ts](../../frontend/src/common/features/programming/cycles/cycleDateRange.test.ts) | Policy / utility / infrastructure | Keep |
| [cycles/cycles.api.test.ts](../../frontend/src/common/features/programming/cycles/cycles.api.test.ts) | API adapter / serialization | Keep |

### common/features/programs — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [hooks/usePrograms.test.tsx](../../frontend/src/common/features/programs/hooks/usePrograms.test.tsx) | Hook policy, state or lifecycle | Keep |
| [programs.api.test.ts](../../frontend/src/common/features/programs/programs.api.test.ts) | API adapter / serialization | Keep |

### common/features/referenceData — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [hooks/useReferenceData.test.tsx](../../frontend/src/common/features/referenceData/hooks/useReferenceData.test.tsx) | Hook policy, state or lifecycle | Keep |
| [referenceData.api.test.ts](../../frontend/src/common/features/referenceData/referenceData.api.test.ts) | API adapter / serialization | Keep |

### common/features/youth — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [dateOfBirth.test.ts](../../frontend/src/common/features/youth/dateOfBirth.test.ts) | Policy / utility / infrastructure | Keep |

### common/hooks — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [useSubmitLock.test.ts](../../frontend/src/common/hooks/useSubmitLock.test.ts) | Hook policy, state or lifecycle | Keep |
| [useSubmitStatus.test.ts](../../frontend/src/common/hooks/useSubmitStatus.test.ts) | Hook policy, state or lifecycle | Keep |

### common/utils — 4 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [date.test.ts](../../frontend/src/common/utils/date.test.ts) | Policy / utility / infrastructure | Keep |
| [dateRange.test.ts](../../frontend/src/common/utils/dateRange.test.ts) | Policy / utility / infrastructure | Keep |
| [name.test.ts](../../frontend/src/common/utils/name.test.ts) | Policy / utility / infrastructure | Keep |
| [time.test.ts](../../frontend/src/common/utils/time.test.ts) | Policy / utility / infrastructure | Keep |

### http — 3 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [client.test.ts](../../frontend/src/http/client.test.ts) | Policy / utility / infrastructure | R3: qualify repeated-401 retry limit |
| [errors.test.ts](../../frontend/src/http/errors.test.ts) | Policy / utility / infrastructure | Keep |
| [transport.test.ts](../../frontend/src/http/transport.test.ts) | Policy / utility / infrastructure | Keep |

### pages/Auth/ForgotPassword — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ForgotPassword.test.tsx](../../frontend/src/pages/Auth/ForgotPassword/ForgotPassword.test.tsx) | Page coordination | Keep |
| [hooks/useForgotPassword.test.tsx](../../frontend/src/pages/Auth/ForgotPassword/hooks/useForgotPassword.test.tsx) | Hook policy, state or lifecycle | Keep |

### pages/Auth/Login — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Login.test.tsx](../../frontend/src/pages/Auth/Login/Login.test.tsx) | Page coordination | R7: valid form submission wiring |
| [hooks/useLogin.test.tsx](../../frontend/src/pages/Auth/Login/hooks/useLogin.test.tsx) | Hook policy, state or lifecycle | Keep |

### pages/Auth/ResetPassword — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ResetPassword.test.tsx](../../frontend/src/pages/Auth/ResetPassword/ResetPassword.test.tsx) | Page coordination | R7: valid form submission wiring |
| [hooks/useResetPassword.test.tsx](../../frontend/src/pages/Auth/ResetPassword/hooks/useResetPassword.test.tsx) | Hook policy, state or lifecycle | Keep |

### pages/Auth/VerifyPassword — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [VerifyPassword.test.tsx](../../frontend/src/pages/Auth/VerifyPassword/VerifyPassword.test.tsx) | Page coordination | R7: valid form submission wiring |
| [hooks/useVerifyPassword.test.tsx](../../frontend/src/pages/Auth/VerifyPassword/hooks/useVerifyPassword.test.tsx) | Hook policy, state or lifecycle | Keep |

### pages/Homepage/ManageHomepage — 9 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [ManageHomepage.test.tsx](../../frontend/src/pages/Homepage/ManageHomepage/ManageHomepage.test.tsx) | Page coordination | Keep; changed |
| [components/HomepageImageList/HomepageImageList.test.tsx](../../frontend/src/pages/Homepage/ManageHomepage/components/HomepageImageList/HomepageImageList.test.tsx) | Component rendering / public wiring | Keep |
| [components/HomepageImageModal/HomepageImageModal.test.tsx](../../frontend/src/pages/Homepage/ManageHomepage/components/HomepageImageModal/HomepageImageModal.test.tsx) | Component rendering / public wiring | Keep; changed |
| [components/HomepageImageModal/hooks/useHomepageImageModal.test.ts](../../frontend/src/pages/Homepage/ManageHomepage/components/HomepageImageModal/hooks/useHomepageImageModal.test.ts) | Hook policy, state or lifecycle | Keep; changed |
| [components/HomepageSignupSetting/HomepageSignupSetting.test.tsx](../../frontend/src/pages/Homepage/ManageHomepage/components/HomepageSignupSetting/HomepageSignupSetting.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useHomepageModals.test.tsx](../../frontend/src/pages/Homepage/ManageHomepage/hooks/useHomepageModals.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/useHomepageSignupSetting.test.tsx](../../frontend/src/pages/Homepage/ManageHomepage/hooks/useHomepageSignupSetting.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/useManagedHomepage.test.tsx](../../frontend/src/pages/Homepage/ManageHomepage/hooks/useManagedHomepage.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [manageHomepage.api.test.ts](../../frontend/src/pages/Homepage/ManageHomepage/manageHomepage.api.test.ts) | API adapter / serialization | Keep |

### pages/Homepage/PublicHomepage — 20 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [PublicHomepage.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/PublicHomepage.test.tsx) | Page coordination | Keep; changed |
| [components/HeroSection/HeroPhoto.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/HeroSection/HeroPhoto.test.tsx) | Component rendering / public wiring | Keep |
| [components/HeroSection/HeroSection.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/HeroSection/HeroSection.test.tsx) | Component rendering / public wiring | R6: remove duplicate image fallback sequence |
| [components/HeroSection/useHeroPhotoCarousel.test.ts](../../frontend/src/pages/Homepage/PublicHomepage/components/HeroSection/useHeroPhotoCarousel.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/HistorySection/HistorySection.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/HistorySection/HistorySection.test.tsx) | Component rendering / public wiring | Keep |
| [components/PartnersSection/PartnersSection.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/PartnersSection/PartnersSection.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProgrammingSection/ProgramCard/ProgramCard.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/ProgrammingSection/ProgramCard/ProgramCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProgrammingSection/ProgrammingSection.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/ProgrammingSection/ProgrammingSection.test.tsx) | Component rendering / public wiring | Keep |
| [components/PublicTopBar/PublicTopBar.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/PublicTopBar/PublicTopBar.test.tsx) | Component rendering / public wiring | Keep |
| [components/PublicTopBar/hooks/usePublicTopBarScroll.test.ts](../../frontend/src/pages/Homepage/PublicHomepage/components/PublicTopBar/hooks/usePublicTopBarScroll.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/ResourceCard/ResourceCard.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/ResourceCard/ResourceCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/SignupSection/SignupSection.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/SignupSection/SignupSection.test.tsx) | Component rendering / public wiring | Keep |
| [components/SignupSection/useSignupSection.test.ts](../../frontend/src/pages/Homepage/PublicHomepage/components/SignupSection/useSignupSection.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/SiteFooter/SiteFooter.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/SiteFooter/SiteFooter.test.tsx) | Component rendering / public wiring | Keep |
| [components/TeamSection/TeamSection.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/components/TeamSection/TeamSection.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/useHomepageImages.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/hooks/useHomepageImages.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/useHomepagePrograms.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/hooks/useHomepagePrograms.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/useHomepageSignup.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/hooks/useHomepageSignup.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/useSectionRouting.test.tsx](../../frontend/src/pages/Homepage/PublicHomepage/hooks/useSectionRouting.test.tsx) | Hook policy, state or lifecycle | Keep |
| [publicHomepage.api.test.ts](../../frontend/src/pages/Homepage/PublicHomepage/publicHomepage.api.test.ts) | API adapter / serialization | Keep |

### pages/Leads — 21 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Leads.test.tsx](../../frontend/src/pages/Leads/Leads.test.tsx) | Page coordination | Keep; changed |
| [components/LeadDashboard/IntakeInformationDashboardCard.test.tsx](../../frontend/src/pages/Leads/components/LeadDashboard/IntakeInformationDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/LeadDashboard/LeadDashboard.test.tsx](../../frontend/src/pages/Leads/components/LeadDashboard/LeadDashboard.test.tsx) | Component rendering / public wiring | Keep |
| [components/LeadDashboard/LeadNotesDashboardCard/LeadNoteEditModal.test.tsx](../../frontend/src/pages/Leads/components/LeadDashboard/LeadNotesDashboardCard/LeadNoteEditModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/LeadDashboard/LeadNotesDashboardCard/LeadNotesDashboardCard.test.tsx](../../frontend/src/pages/Leads/components/LeadDashboard/LeadNotesDashboardCard/LeadNotesDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/LeadDashboard/LeadNotesDashboardCard/useLeadNoteEditModal.test.ts](../../frontend/src/pages/Leads/components/LeadDashboard/LeadNotesDashboardCard/useLeadNoteEditModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/LeadDashboard/LeadNotesDashboardCard/useLeadNotes.test.tsx](../../frontend/src/pages/Leads/components/LeadDashboard/LeadNotesDashboardCard/useLeadNotes.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/LeadModal/LeadModal.test.tsx](../../frontend/src/pages/Leads/components/LeadModal/LeadModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/LeadModal/useLeadModal.test.tsx](../../frontend/src/pages/Leads/components/LeadModal/useLeadModal.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/LeadNoteModal/LeadNoteModal.test.tsx](../../frontend/src/pages/Leads/components/LeadNoteModal/LeadNoteModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/LeadNoteModal/hooks/useLeadNoteModal.test.ts](../../frontend/src/pages/Leads/components/LeadNoteModal/hooks/useLeadNoteModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/LeadTable/LeadTable.test.tsx](../../frontend/src/pages/Leads/components/LeadTable/LeadTable.test.tsx) | Component rendering / public wiring | Keep |
| [components/LeadTable/hooks/useLeadTable.test.tsx](../../frontend/src/pages/Leads/components/LeadTable/hooks/useLeadTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/LeadTable/hooks/useLeadTableData.test.tsx](../../frontend/src/pages/Leads/components/LeadTable/hooks/useLeadTableData.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/SignUpLeadModal/SignUpLeadModal.test.tsx](../../frontend/src/pages/Leads/components/SignUpLeadModal/SignUpLeadModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/SignUpLeadModal/useSignUpLeadModal.test.ts](../../frontend/src/pages/Leads/components/SignUpLeadModal/useSignUpLeadModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/actions/useLeadActions.test.tsx](../../frontend/src/pages/Leads/hooks/actions/useLeadActions.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/data/useLeadData.test.ts](../../frontend/src/pages/Leads/hooks/data/useLeadData.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/preferences/useLeadPreferences.test.ts](../../frontend/src/pages/Leads/hooks/preferences/useLeadPreferences.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/selection/useLeadSelection.test.ts](../../frontend/src/pages/Leads/hooks/selection/useLeadSelection.test.ts) | Hook policy, state or lifecycle | Keep |
| [leads.api.test.ts](../../frontend/src/pages/Leads/leads.api.test.ts) | API adapter / serialization | Keep |

### pages/Programming/Cohorts — 16 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Cohorts.test.tsx](../../frontend/src/pages/Programming/Cohorts/Cohorts.test.tsx) | Page coordination | Keep; changed |
| [cohorts.api.test.ts](../../frontend/src/pages/Programming/Cohorts/cohorts.api.test.ts) | API adapter / serialization | Keep |
| [components/CohortModal/AddCohortModal.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/CohortModal/AddCohortModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/CohortModal/EditCohortModal.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/CohortModal/EditCohortModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/CohortModal/hooks/useAddCohortModal.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/CohortModal/hooks/useAddCohortModal.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/CohortModal/hooks/useEditCohortModal.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/CohortModal/hooks/useEditCohortModal.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/CohortTable/CohortTable.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/CohortTable/CohortTable.test.tsx) | Component rendering / public wiring | Keep; changed |
| [components/CohortTable/hooks/useCohortTable.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/CohortTable/hooks/useCohortTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/CohortTable/hooks/useCohortTableData.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/CohortTable/hooks/useCohortTableData.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/ManageRosterModal/ManageRosterModal.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/ManageRosterModal/ManageRosterModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/ManageRosterModal/hooks/useManageRosterModal.test.tsx](../../frontend/src/pages/Programming/Cohorts/components/ManageRosterModal/hooks/useManageRosterModal.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/actions/useCohortActions.test.ts](../../frontend/src/pages/Programming/Cohorts/hooks/actions/useCohortActions.test.ts) | Hook policy, state or lifecycle | R8: cover roster invalidation set; changed |
| [hooks/data/useCohortData.test.ts](../../frontend/src/pages/Programming/Cohorts/hooks/data/useCohortData.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/selection/useCohortSelection.test.ts](../../frontend/src/pages/Programming/Cohorts/hooks/selection/useCohortSelection.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useCohortControls.test.ts](../../frontend/src/pages/Programming/Cohorts/hooks/useCohortControls.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useCohortRoster.test.tsx](../../frontend/src/pages/Programming/Cohorts/hooks/useCohortRoster.test.tsx) | Hook policy, state or lifecycle | Keep; changed |

### pages/Programming/Sessions — 41 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Sessions.test.tsx](../../frontend/src/pages/Programming/Sessions/Sessions.test.tsx) | Page coordination | Keep; changed |
| [components/AddSessionModal/AddSessionModal.test.tsx](../../frontend/src/pages/Programming/Sessions/components/AddSessionModal/AddSessionModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/AddSessionModal/hooks/useAddSessionModal.test.ts](../../frontend/src/pages/Programming/Sessions/components/AddSessionModal/hooks/useAddSessionModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/EditSessionModal/EditSessionModal.test.tsx](../../frontend/src/pages/Programming/Sessions/components/EditSessionModal/EditSessionModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/EditSessionModal/hooks/useEditSessionModal.test.ts](../../frontend/src/pages/Programming/Sessions/components/EditSessionModal/hooks/useEditSessionModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/ProgramOverviewDashboardCard/ProgramOverviewDashboardCard.test.tsx](../../frontend/src/pages/Programming/Sessions/components/ProgramOverviewDashboardCard/ProgramOverviewDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionAttendanceModal/OpenAttendancePicker.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionAttendanceModal/OpenAttendancePicker.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionAttendanceModal/SessionAttendanceModal.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionAttendanceModal/SessionAttendanceModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionAttendanceModal/SessionAttendanceRoster.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionAttendanceModal/SessionAttendanceRoster.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionAttendanceModal/hooks/useSessionAttendanceModal.test.ts](../../frontend/src/pages/Programming/Sessions/components/SessionAttendanceModal/hooks/useSessionAttendanceModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/SessionCalendar/SessionCalendar.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionCalendar/SessionCalendar.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionCalendar/SessionItem/SessionItem.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionCalendar/SessionItem/SessionItem.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionCalendar/sessionCalendarDates.test.ts](../../frontend/src/pages/Programming/Sessions/components/SessionCalendar/sessionCalendarDates.test.ts) | Component rendering / public wiring | Keep |
| [components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentModal/SessionAttachmentModal.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentModal/SessionAttachmentModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentModal/hooks/useSessionAttachmentModal.test.ts](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentModal/hooks/useSessionAttachmentModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentRow/SessionAttachmentRow.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentRow/SessionAttachmentRow.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentViewerModal/SessionAttachmentViewerModal.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentViewerModal/SessionAttachmentViewerModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionDashboard/SessionAttachmentsDashboardCard/hooks/useSessionAttachments.test.ts](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionAttachmentsDashboardCard/hooks/useSessionAttachments.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/SessionDashboard/SessionAttendanceDashboardCard/SessionAttendanceDashboardCard.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionAttendanceDashboardCard/SessionAttendanceDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionDashboard/SessionDashboard.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionDashboard.test.tsx) | Component rendering / public wiring | R5: simplify to composition and wiring |
| [components/SessionDashboard/SessionNotesDashboardCard/SessionNotesDashboardCard.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionNotesDashboardCard/SessionNotesDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionDashboard/SessionNotesDashboardCard/hooks/useSessionNotes.test.ts](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/SessionNotesDashboardCard/hooks/useSessionNotes.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/SessionDashboard/hooks/useSessionDashboardErrors.test.ts](../../frontend/src/pages/Programming/Sessions/components/SessionDashboard/hooks/useSessionDashboardErrors.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/SessionNoteDetails/SessionNoteDetails.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionNoteDetails/SessionNoteDetails.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionNoteModal/SessionNoteModal.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionNoteModal/SessionNoteModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionNoteModal/SessionYouthChecklist.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionNoteModal/SessionYouthChecklist.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionNoteModal/hooks/useSessionNoteModal.test.ts](../../frontend/src/pages/Programming/Sessions/components/SessionNoteModal/hooks/useSessionNoteModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/SessionNoteRow/SessionNoteRow.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionNoteRow/SessionNoteRow.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionTable/SessionTable.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionTable/SessionTable.test.tsx) | Component rendering / public wiring | Keep |
| [components/SessionTable/hooks/useSessionTable.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionTable/hooks/useSessionTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/SessionTable/hooks/useSessionTableData.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionTable/hooks/useSessionTableData.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/SessionTypeBadge/SessionTypeBadge.test.tsx](../../frontend/src/pages/Programming/Sessions/components/SessionTypeBadge/SessionTypeBadge.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/actions/useSessionActions.test.ts](../../frontend/src/pages/Programming/Sessions/hooks/actions/useSessionActions.test.ts) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/data/useCohorts.test.tsx](../../frontend/src/pages/Programming/Sessions/hooks/data/useCohorts.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/data/useSessionData.test.ts](../../frontend/src/pages/Programming/Sessions/hooks/data/useSessionData.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/data/useSessionTypes.test.tsx](../../frontend/src/pages/Programming/Sessions/hooks/data/useSessionTypes.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/selection/useSessionSelection.test.tsx](../../frontend/src/pages/Programming/Sessions/hooks/selection/useSessionSelection.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/useSessionControls.test.ts](../../frontend/src/pages/Programming/Sessions/hooks/useSessionControls.test.ts) | Hook policy, state or lifecycle | Keep |
| [sessions.api.test.ts](../../frontend/src/pages/Programming/Sessions/sessions.api.test.ts) | API adapter / serialization | Keep |
| [utils/sessionSchedule.test.ts](../../frontend/src/pages/Programming/Sessions/utils/sessionSchedule.test.ts) | Policy / utility / infrastructure | Keep |

### pages/Settings/Account — 2 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Account.test.tsx](../../frontend/src/pages/Settings/Account/Account.test.tsx) | Page coordination | Keep |
| [hooks/data/useAccountData.test.ts](../../frontend/src/pages/Settings/Account/hooks/data/useAccountData.test.ts) | Hook policy, state or lifecycle | Keep |

### pages/Settings/Programming — 14 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Programming.test.tsx](../../frontend/src/pages/Settings/Programming/Programming.test.tsx) | Page coordination | Keep; changed |
| [components/CycleModal/CycleModal.test.tsx](../../frontend/src/pages/Settings/Programming/components/CycleModal/CycleModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/CycleModal/hooks/useCycleModal.test.ts](../../frontend/src/pages/Settings/Programming/components/CycleModal/hooks/useCycleModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/CycleTable/CycleTable.test.tsx](../../frontend/src/pages/Settings/Programming/components/CycleTable/CycleTable.test.tsx) | Component rendering / public wiring | Keep |
| [components/CycleTable/hooks/useCycleTable.test.tsx](../../frontend/src/pages/Settings/Programming/components/CycleTable/hooks/useCycleTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/ProgramCyclesModal/ProgramCyclesModal.test.tsx](../../frontend/src/pages/Settings/Programming/components/ProgramCyclesModal/ProgramCyclesModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProgramCyclesModal/hooks/useProgramCyclesModal.test.ts](../../frontend/src/pages/Settings/Programming/components/ProgramCyclesModal/hooks/useProgramCyclesModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/ProgramModal/ProgramModal.test.tsx](../../frontend/src/pages/Settings/Programming/components/ProgramModal/ProgramModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProgramModal/hooks/useProgramModal.test.ts](../../frontend/src/pages/Settings/Programming/components/ProgramModal/hooks/useProgramModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/ProgramTable/ProgramTable.test.tsx](../../frontend/src/pages/Settings/Programming/components/ProgramTable/ProgramTable.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProgramTable/hooks/useProgramTable.test.tsx](../../frontend/src/pages/Settings/Programming/components/ProgramTable/hooks/useProgramTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/actions/useProgrammingActions.test.ts](../../frontend/src/pages/Settings/Programming/hooks/actions/useProgrammingActions.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/data/useProgrammingData.test.ts](../../frontend/src/pages/Settings/Programming/hooks/data/useProgrammingData.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useProgrammingModals.test.ts](../../frontend/src/pages/Settings/Programming/hooks/useProgrammingModals.test.ts) | Hook policy, state or lifecycle | Keep |

### pages/Settings/Users — 10 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Users.test.tsx](../../frontend/src/pages/Settings/Users/Users.test.tsx) | Page coordination | Keep; changed |
| [accounts.api.test.ts](../../frontend/src/pages/Settings/Users/accounts.api.test.ts) | API adapter / serialization | Keep |
| [components/AccountModal/AccountModal.test.tsx](../../frontend/src/pages/Settings/Users/components/AccountModal/AccountModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/AccountModal/useAccountModal.test.tsx](../../frontend/src/pages/Settings/Users/components/AccountModal/useAccountModal.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/UserTable/UserTable.test.tsx](../../frontend/src/pages/Settings/Users/components/UserTable/UserTable.test.tsx) | Component rendering / public wiring | Keep; changed |
| [components/UserTable/hooks/useUserTable.test.tsx](../../frontend/src/pages/Settings/Users/components/UserTable/hooks/useUserTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/UserTable/hooks/useUserTableData.test.tsx](../../frontend/src/pages/Settings/Users/components/UserTable/hooks/useUserTableData.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/actions/useAccountActions.test.tsx](../../frontend/src/pages/Settings/Users/hooks/actions/useAccountActions.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/useAccountControls.test.ts](../../frontend/src/pages/Settings/Users/hooks/useAccountControls.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/useAccountModals.test.ts](../../frontend/src/pages/Settings/Users/hooks/useAccountModals.test.ts) | Hook policy, state or lifecycle | Keep |

### pages/Staff/Hours — 18 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Hours.test.tsx](../../frontend/src/pages/Staff/Hours/Hours.test.tsx) | Page coordination | Keep; changed |
| [components/HoursCalendar/HoursCalendar.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursCalendar/HoursCalendar.test.tsx) | Component rendering / public wiring | Keep |
| [components/HoursCalendar/HoursItem/HoursItem.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursCalendar/HoursItem/HoursItem.test.tsx) | Component rendering / public wiring | Keep |
| [components/HoursDashboard/HoursDashboard.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursDashboard/HoursDashboard.test.tsx) | Component rendering / public wiring | Keep |
| [components/HoursDashboard/HoursDashboardCard/HoursDashboardCard.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursDashboard/HoursDashboardCard/HoursDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/HoursDashboard/hooks/useHoursOverviewData.test.ts](../../frontend/src/pages/Staff/Hours/components/HoursDashboard/hooks/useHoursOverviewData.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/HoursModal/HoursModal.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursModal/HoursModal.test.tsx) | Component rendering / public wiring | Keep; changed |
| [components/HoursModal/hooks/useHoursModal.test.ts](../../frontend/src/pages/Staff/Hours/components/HoursModal/hooks/useHoursModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/HoursTable/HoursTable.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursTable/HoursTable.test.tsx) | Component rendering / public wiring | Keep |
| [components/HoursTable/hooks/useHoursTable.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursTable/hooks/useHoursTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/HoursTable/hooks/useHoursTableData.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursTable/hooks/useHoursTableData.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/HoursTypeLabel/HoursTypeLabel.test.tsx](../../frontend/src/pages/Staff/Hours/components/HoursTypeLabel/HoursTypeLabel.test.tsx) | Component rendering / public wiring | Keep |
| [hooks/actions/useHoursActions.test.ts](../../frontend/src/pages/Staff/Hours/hooks/actions/useHoursActions.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/data/useHoursData.test.ts](../../frontend/src/pages/Staff/Hours/hooks/data/useHoursData.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/preferences/useHoursPreferences.test.ts](../../frontend/src/pages/Staff/Hours/hooks/preferences/useHoursPreferences.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/selection/useHoursSelection.test.ts](../../frontend/src/pages/Staff/Hours/hooks/selection/useHoursSelection.test.ts) | Hook policy, state or lifecycle | Keep |
| [hours.api.test.ts](../../frontend/src/pages/Staff/Hours/hours.api.test.ts) | API adapter / serialization | Keep |
| [utils/hoursEntryType.test.ts](../../frontend/src/pages/Staff/Hours/utils/hoursEntryType.test.ts) | Policy / utility / infrastructure | Keep |

### pages/Staff/Tasks — 20 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Tasks.test.tsx](../../frontend/src/pages/Staff/Tasks/Tasks.test.tsx) | Page coordination | Keep; changed |
| [components/TaskCalendar/TaskCalendar.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskCalendar/TaskCalendar.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskCalendar/TaskItem/TaskItem.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskCalendar/TaskItem/TaskItem.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskDashboard/TaskDashboard.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskDashboard/TaskDashboard.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskDashboard/TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskDashboard/TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskDashboard/TaskOverviewDashboardCard/TaskOverviewDashboardCard.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskDashboard/TaskOverviewDashboardCard/TaskOverviewDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskDashboard/TaskOverviewDashboardCard/hooks/useTaskOverviewData.test.ts](../../frontend/src/pages/Staff/Tasks/components/TaskDashboard/TaskOverviewDashboardCard/hooks/useTaskOverviewData.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/TaskModal/TaskModal.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskModal/TaskModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskModal/hooks/useTaskModal.test.ts](../../frontend/src/pages/Staff/Tasks/components/TaskModal/hooks/useTaskModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/TaskStatusBadge/TaskStatusBadge.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskStatusBadge/TaskStatusBadge.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskTable/TaskActionsMenu.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskTable/TaskActionsMenu.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskTable/TaskTable.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskTable/TaskTable.test.tsx) | Component rendering / public wiring | Keep |
| [components/TaskTable/hooks/useTaskTable.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskTable/hooks/useTaskTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/TaskTable/hooks/useTaskTableData.test.tsx](../../frontend/src/pages/Staff/Tasks/components/TaskTable/hooks/useTaskTableData.test.tsx) | Hook policy, state or lifecycle | Keep |
| [hooks/actions/useTaskActions.test.ts](../../frontend/src/pages/Staff/Tasks/hooks/actions/useTaskActions.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/data/useTaskData.test.ts](../../frontend/src/pages/Staff/Tasks/hooks/data/useTaskData.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/preferences/useTaskPreferences.test.ts](../../frontend/src/pages/Staff/Tasks/hooks/preferences/useTaskPreferences.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/selection/useTaskSelection.test.ts](../../frontend/src/pages/Staff/Tasks/hooks/selection/useTaskSelection.test.ts) | Hook policy, state or lifecycle | Keep |
| [tasks.api.test.ts](../../frontend/src/pages/Staff/Tasks/tasks.api.test.ts) | API adapter / serialization | Keep |
| [utils/taskCapabilities.test.ts](../../frontend/src/pages/Staff/Tasks/utils/taskCapabilities.test.ts) | Policy / utility / infrastructure | Keep |

### pages/Youth — 31 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [Youth.test.tsx](../../frontend/src/pages/Youth/Youth.test.tsx) | Page coordination | Keep; changed |
| [components/ProfileNotes/ProfileNoteDetails.test.tsx](../../frontend/src/pages/Youth/components/ProfileNotes/ProfileNoteDetails.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProfileNotes/ProfileNoteDialogs.test.tsx](../../frontend/src/pages/Youth/components/ProfileNotes/ProfileNoteDialogs.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProfileNotes/ProfileNoteModal.test.tsx](../../frontend/src/pages/Youth/components/ProfileNotes/ProfileNoteModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProfileNotes/ProfileNoteRow.test.tsx](../../frontend/src/pages/Youth/components/ProfileNotes/ProfileNoteRow.test.tsx) | Component rendering / public wiring | Keep |
| [components/ProfileNotes/hooks/useProfileNoteModal.test.ts](../../frontend/src/pages/Youth/components/ProfileNotes/hooks/useProfileNoteModal.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/ProfileNotes/useProfileNotes.test.tsx](../../frontend/src/pages/Youth/components/ProfileNotes/useProfileNotes.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/YouthAttendanceModal/YouthAttendanceModal.test.tsx](../../frontend/src/pages/Youth/components/YouthAttendanceModal/YouthAttendanceModal.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthAttendanceModal/components/SessionAttendanceItem.test.tsx](../../frontend/src/pages/Youth/components/YouthAttendanceModal/components/SessionAttendanceItem.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthAttendanceModal/components/SessionNoteCard.test.tsx](../../frontend/src/pages/Youth/components/YouthAttendanceModal/components/SessionNoteCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthAttendanceModal/components/YouthSessionNoteDialogs.test.tsx](../../frontend/src/pages/Youth/components/YouthAttendanceModal/components/YouthSessionNoteDialogs.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthAttendanceModal/hooks/useYouthAttendance.test.ts](../../frontend/src/pages/Youth/components/YouthAttendanceModal/hooks/useYouthAttendance.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/YouthAttendanceModal/hooks/useYouthSessionNotes.test.ts](../../frontend/src/pages/Youth/components/YouthAttendanceModal/hooks/useYouthSessionNotes.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/YouthAttendanceModal/youthAttendance.api.test.ts](../../frontend/src/pages/Youth/components/YouthAttendanceModal/youthAttendance.api.test.ts) | API adapter / serialization | Keep |
| [components/YouthDashboard/YouthAttendanceDashboardCard/YouthAttendanceDashboardCard.test.tsx](../../frontend/src/pages/Youth/components/YouthDashboard/YouthAttendanceDashboardCard/YouthAttendanceDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthDashboard/YouthAttendanceDashboardCard/YouthDashboardTabs/YouthDashboardTabs.test.tsx](../../frontend/src/pages/Youth/components/YouthDashboard/YouthAttendanceDashboardCard/YouthDashboardTabs/YouthDashboardTabs.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthDashboard/YouthDashboard.test.tsx](../../frontend/src/pages/Youth/components/YouthDashboard/YouthDashboard.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthDashboard/YouthNotesDashboardCard/YouthNotesDashboardCard.test.tsx](../../frontend/src/pages/Youth/components/YouthDashboard/YouthNotesDashboardCard/YouthNotesDashboardCard.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthModal/YouthModal.test.tsx](../../frontend/src/pages/Youth/components/YouthModal/YouthModal.test.tsx) | Component rendering / public wiring | R1: display/submit emergency relationship |
| [components/YouthModal/hooks/useAddresses.test.ts](../../frontend/src/pages/Youth/components/YouthModal/hooks/useAddresses.test.ts) | Hook policy, state or lifecycle | Keep |
| [components/YouthModal/hooks/useYouthModal.test.tsx](../../frontend/src/pages/Youth/components/YouthModal/hooks/useYouthModal.test.tsx) | Hook policy, state or lifecycle | Keep wiring; contact policy remains below (R1) |
| [components/YouthModal/youthSchema.test.ts](../../frontend/src/pages/Youth/components/YouthModal/youthSchema.test.ts) | Component rendering / public wiring | Keep |
| [components/YouthTable/YouthTable.integration.test.tsx](../../frontend/src/pages/Youth/components/YouthTable/YouthTable.integration.test.tsx) | Component rendering / public wiring | Keep; changed |
| [components/YouthTable/YouthTable.test.tsx](../../frontend/src/pages/Youth/components/YouthTable/YouthTable.test.tsx) | Component rendering / public wiring | Keep |
| [components/YouthTable/hooks/useYouthTable.test.tsx](../../frontend/src/pages/Youth/components/YouthTable/hooks/useYouthTable.test.tsx) | Hook policy, state or lifecycle | Keep |
| [components/YouthTable/hooks/useYouthTableData.test.tsx](../../frontend/src/pages/Youth/components/YouthTable/hooks/useYouthTableData.test.tsx) | Hook policy, state or lifecycle | Keep; changed |
| [hooks/actions/useYouthActions.test.ts](../../frontend/src/pages/Youth/hooks/actions/useYouthActions.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/controls/useYouthControls.test.ts](../../frontend/src/pages/Youth/hooks/controls/useYouthControls.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/data/useYouthData.test.ts](../../frontend/src/pages/Youth/hooks/data/useYouthData.test.ts) | Hook policy, state or lifecycle | Keep |
| [hooks/selection/useYouthSelection.test.ts](../../frontend/src/pages/Youth/hooks/selection/useYouthSelection.test.ts) | Hook policy, state or lifecycle | Keep |
| [youth.api.test.ts](../../frontend/src/pages/Youth/youth.api.test.ts) | API adapter / serialization | R1: align request contact type |

### query — 3 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [hooks/useInfiniteListQuery.test.tsx](../../frontend/src/query/hooks/useInfiniteListQuery.test.tsx) | Hook policy, state or lifecycle | R8: qualify error/retry and loading states; changed |
| [hooks/useListQuery.test.tsx](../../frontend/src/query/hooks/useListQuery.test.tsx) | Hook policy, state or lifecycle | R8: cover owned remove behavior; changed |
| [infiniteListCache.test.ts](../../frontend/src/query/infiniteListCache.test.ts) | Policy / utility / infrastructure | Keep |

### tests — 1 suites

| Suite | Boundary | Assessment |
|---|---|---|
| [queryClientTestUtils.test.tsx](../../frontend/src/tests/queryClientTestUtils.test.tsx) | Component rendering / public wiring | Improve existing client identity assertion |

### Browser specs and scaffold tooling

| Reviewed owner | Contract / assessment |
|---|---|
| [shared-components.spec.ts](../../frontend/playwright/tests/shared-components.spec.ts) | Real modal/menu focus and placement, table scroll/resizing, search interaction; keep |
| [timeline-calendar.spec.ts](../../frontend/playwright/tests/timeline-calendar.spec.ts) | Virtualization, geometry, pointer capture, drag/resize/cancellation and saved position; keep; add malformed-storage unit owner separately (R8) |
| [date-range-calendar.spec.ts](../../frontend/playwright/tests/date-range-calendar.spec.ts) | Calendar date bounds/navigation across ranges; keep |
| [hours-calendar.spec.ts](../../frontend/playwright/tests/hours-calendar.spec.ts) | Hours item browser interaction contract; keep |
| [task-calendar.spec.ts](../../frontend/playwright/tests/task-calendar.spec.ts) | Task item browser interaction contract; keep |
| [session-calendar.spec.ts](../../frontend/playwright/tests/session-calendar.spec.ts) | Session item browser interaction contract; keep |
| [scaffold/index.test.ts](../../scripts/agents/scaffold/frontend/index.test.ts) | Paired output, owner validation, no-overwrite, dry-run, page behavior groups, composed calendar-page generation; keep; changed |

The six shared stories (FloatingMenu, Modal, SearchInput, Table, TimelineCalendar,
CycleCalendar) and three domain-item stories (HoursItem, TaskItem, SessionItem) were read
as browser fixtures. They are not counted as separate test suites.
