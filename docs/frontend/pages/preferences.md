# Page preferences

A page preference hook owns every page control that the application restores and saves. This includes the current view, search, filters, sorting, column widths and hidden columns.

## Expose one preference contract

Return named sections so route pages compose equivalent controls consistently:

```ts
{
  ready,
  error,
  view,
  setView,
  search: { value, appliedValue, setValue, apply, clear },
  filters: { ...values, definitions, apply, clear },
  table: { sorting, setSorting, columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns },
}
```

Omit sections the page does not use. Add domain-specific preference operations to the relevant section instead of exposing a general patch function.

## Restore and save preferences

Follow one lifecycle on every page:

1. Define one complete, typed default preference in the page owner.
2. Wait for the authenticated role and the options needed to interpret saved identifiers.
3. Treat a load failure as no saved preference for that visit, then merge the page defaults.
4. Normalize each field with the primitives in `common/features/preferences/preferenceValues.ts`.
5. Set the normalized value as the save baseline before enabling dependent queries.
6. Save complete values while updating controls optimistically.
7. Reconcile saved option identifiers after a failed option query recovers.

Do not erase saved selections while the page cannot verify them. Do not clear backend caches, reset persisted preferences or save defaults only to recover from a transport error.

Keep the final normalizer in the page hook. Each page owns its views, filters, role-based defaults and reference collections. Shared primitives own only repeatable validation and comparison.

## Test preference behaviour

The preference-hook test owns restoration, normalization, saves, failures and recovery. A route-page test only confirms that restored domain values reach the correct controls or body view.
