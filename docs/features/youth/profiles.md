# Youth profiles and attendance

Youth Profiles separates collection, profile, notes, and attendance workflows.

## Backend ownership

- `youthListService.ts` owns collection filtering, sorting, summaries, and cursor pagination.
- `youthService.ts` owns loading and setting one profile. Youth profile deletion is not currently supported.
- `youthProfileNoteService.ts` owns notes written directly on a Youth profile.
- `youthAttendanceService.ts` manages one youth's attendance across a selected cohort's sessions.
- `youthSchoolService.ts` owns the school options managed from the Youth Profile workflow.
- `youthAddressService.ts` and `youthContactService.ts` reconcile profile addresses and canonical contacts. Lead signup calls the contact service because that command creates a Youth profile; Outreach does not own the resulting contact record.

When a profile field is added, removed, or renamed, check both the list and direct-profile responses, their frontend types, and their tests. They are separate API contracts.

Session notes displayed on a Youth profile remain owned by `programming/sessions/sessionNoteService.ts`. See [Sessions and attendance](../programming/sessions.md) for the shared attendance boundary.

## Implementation ownership

- Backend services: `backend/src/services/youth/`
- Backend HTTP boundary: `backend/src/validation/youthSchemas.ts`, `backend/src/controllers/youthController.ts`, and `backend/src/routes/youthRoutes.ts`
- Backend tests: `backend/tests/youth/`
- Frontend API and shared profile modal: `frontend/src/common/features/youth/`
- Frontend route owner: `frontend/src/pages/Youth/`
- Session-owned notes: `backend/src/services/programming/sessions/sessionNoteService.ts`

## Changing this feature

- Change persistence: [Database changes](../../development/backend/database-changes.md)
- Change services or access: [Backend services](../../development/backend/services.md) and [policies](../../development/backend/policies.md)
- Change the Youth route page: [Adding a frontend page](../../development/frontend/adding-a-page.md)
- Change its list, profile modal, attendance modal, or notes: [List view](../../development/frontend/list-view.md) or [forms and modals](../../development/frontend/forms-and-modals.md)
- Learn an API used by those owners: [Application stack](../../development/stack/README.md)
- Select verification: [Testing](../../operations/testing.md)
