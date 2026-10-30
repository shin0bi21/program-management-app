# Page Message Overlays

Use `PageMessageOverlay` for user-safe errors and warnings that need page-level visibility.
Place it after `PageHeader` and before `PageBody` in the collection-page shell.
Keep the failed view's unavailable state visible so the page does not suggest
that a failed request returned an empty result.

## Report Errors to the Page

The route collects errors from page data, preferences, actions, and child views.
Pass these values through the overlay's `messages` prop. Each entry may be a message
string or an object with `message`, optional `severity` (`error` by default or
`warning`), optional `details`, and an optional `action` containing `label`,
`onClick`, and `disabled`. A message can also be a group of items reported by one child. Empty entries are ignored; repeated messages
appear once. Use a retry action when the error's owner can retry the failed work.

Use `usePageMessageReporter` when a child reports an error through an
`onMessageChange` callback. It clears the reported error when that child changes
or unmounts. Keep request and retry behavior with the data owner.

For table failures, follow [Table Error Handling](tables.md):
report the user-safe error to the route and give the table an unavailable state
with the same retry callback. Avoid repeating the raw error inside the table.

## Supply an Optional Action

The data or page owner supplies the message and action callback. The overlay renders
that optional action; it does not fetch data or infer how to refresh a table. Messages
without actions have no action button.

Table rows stay in place after edits. If an edited sort value violates its position
relative to loaded neighbors in the current direction, the table reports “This table’s
data is out of order.” with a Refresh action. Sort edits that
still fit, unrelated edits, and filter-only changes do not show this warning.
Refresh fetches a fresh first page and resets pagination. Failed refreshes retain the
rows and warning, with the request failure reported alongside it. Clear the warning
when the loaded rows are back in order, including after a correcting edit.

## Dismiss Messages

Errors use alert semantics; warning-only messages use status semantics and amber styling.
The overlay exposes a dismissal button. Dismissing it hides the
current set of messages; changed message content can appear again. Dismissal
does not clear the underlying failure or retry the request.

Keep form-specific validation and submission feedback with
[Modals and Forms](modals-and-forms.md). For dialogs, floating
menus, and tooltips, follow [Overlays](overlays.md).

## Testing

Page tests verify that relevant errors and retry actions reach the overlay.
Child tests own reporting and clearing their errors. Shared overlay tests own
message deduplication, optional actions, details, dismissal, and error/warning rendering. Follow
[Page Testing](../pages/testing.md) for the rest of the route's coordination coverage.
