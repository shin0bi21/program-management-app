# Page Message Overlays

Use `PageMessageOverlay` for user-safe errors and warnings that need page-level visibility.
Pass collection-route messages through [PageContainer](page-container.md#pagemessageoverlay).
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

The table owner decides when to supply an ordering warning and Refresh action;
follow [retained ordering](table-rows.md#explain-retained-ordering).

## Dismiss Messages

Errors use alert semantics; warning-only messages use status semantics and amber styling.
The overlay exposes a dismissal button. Dismissing it hides the
current set of messages; changed message content can appear again. Dismissal
does not clear the underlying failure or retry the request.

Keep form-specific validation and submission feedback with
[Modals and Forms](modals-and-forms.md). For dialogs, floating
menus, and tooltips, follow [Overlays](overlays.md).

Follow [Test Ownership](../../workflows/delivery/testing.md#test-ownership)
for shared interactions and route coordination.
