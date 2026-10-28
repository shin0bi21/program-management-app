# Badges

Badges are non-interactive labels for record types and lifecycle states. Use the shared
primitives so tables, calendar details, and other surfaces keep the same typography,
padding, corner radius, and normal text casing.

## Choose the owner

| Owner | Responsibility |
|---|---|
| [Badge](../../../frontend/src/common/components/Badge/Badge.tsx) | Shared label shape and typography; accepts content and a caller appearance class |
| [StatusBadge](../../../frontend/src/common/components/StatusBadge/StatusBadge.tsx) | Shared lifecycle colors; accepts a supported status and its display label |
| Domain badge, such as `SessionTypeBadge`, `HoursTypeLabel`, or `TaskStatusBadge` | Maps the record's type or status to its label and appearance |

Keep record interpretation and business labels with the domain owner. Pass authoritative
labels such as a task's `statusLabel` through to `StatusBadge`; the shared component does
not derive status from dates or records. Session type and Hours entry-type colors stay
with their existing domain components.

```tsx
<Badge className="example-type">Guest Speaker</Badge>
<StatusBadge status="completed" label="Completed" />
```

## Keep presentation consistent

Type and status badges share the base sizing and casing. Do not add uppercase transforms,
different font sizes, or duplicate padding in each domain badge. Keep palette-specific
classes separate from the base badge styles.

`StatusBadge` supports these appearances:

| Status | Appearance |
|---|---|
| `upcoming` | Information color |
| `active` | Active-task color |
| `overdue` | Danger color |
| `completed` | Success color |
| `cancelled` | Muted neutral color |

Use only states the domain actually supports. Sessions have upcoming, completed, and
cancelled states; they do not gain an overdue state from using the shared badge.
Always retain a readable label instead of communicating state through color alone.

Compact or dense calendar rows may reduce an Hours type badge's spacing and text size.
Scope those overrides to the positioned row item so hover/focus details keep the shared
badge sizing. See [calendar presentation](calendars.md#present-item-details) for ordering
and date formatting.

## Testing

Primitive tests cover rendered content and appearance classes. Domain tests cover the
record-to-label/status mapping; consumer tests cover the badge's placement and supplied
values. Use browser tests for layout, clipping, density, and selection geometry rather
than duplicating shared badge mechanics in every consumer.
