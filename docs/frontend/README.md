# Frontend

The frontend uses React, TypeScript, and Vite.

## Find the Right Guide

| What are you changing? | Guide |
|---|---|
| Where code should live | [Ownership](architecture/ownership.md) |
| State, API calls, queries, or mutations | [State and Data](architecture/state-and-data.md) |
| Data preferences, table layout preferences, and field rules | [Preferences](architecture/preferences.md) |
| Generate implementation and colocated test outlines | [Scaffolding](architecture/scaffolding.md) |
| Test ownership and suite organization | [Testing](../workflows/delivery/testing.md#test-ownership) |

## Find a Component

Read the component's types, function documentation, and colocated tests for its
inputs and behavior. Keep those contracts with their source owners; use the
[design recipe](../workflows/documentation.md) when changing them.

| Surface | Source owner |
|---|---|
| Collection page layout and controls | [PageContainer](../../frontend/src/common/components/PageContainer/PageContainer.tsx) |
| Page errors, warnings, and retry actions | [PageMessageOverlay](../../frontend/src/common/components/PageMessageOverlay/PageMessageOverlay.tsx) |
| Summary cards | [DashboardCard](../../frontend/src/common/components/DashboardCard/DashboardCard.tsx) |
| Tables | [Table](../../frontend/src/common/components/Table/Table.tsx) and [props](../../frontend/src/common/components/Table/Table.types.ts) |
| Remote table data and row updates | [useInfiniteListQuery](../../frontend/src/query/hooks/useInfiniteListQuery.ts) and [infiniteListCache](../../frontend/src/query/infiniteListCache.ts) |
| Calendars and range loading | [TimelineCalendar](../../frontend/src/common/components/TimelineCalendar/TimelineCalendar.tsx) and [useDataBuffer](../../frontend/src/common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer.ts) |
| Dialogs | [Modal](../../frontend/src/common/components/Modal/Modal.tsx) |
| Floating menus and forms | [FloatingMenuPanel](../../frontend/src/common/components/FloatingMenu/FloatingMenuPanel.tsx) and [useFloatingMenu](../../frontend/src/common/components/FloatingMenu/hooks/useFloatingMenu.ts) |
| Grouped filters | [FilterCard](../../frontend/src/common/components/FilterCard/FilterCard.tsx) |
| Form fields and grouped choices | [FormField](../../frontend/src/common/components/FormField/FormField.tsx) and [Checklist](../../frontend/src/common/components/Checklist/Checklist.tsx) |
| Type and status labels | [Label](../../frontend/src/common/components/Label/Label.tsx) and [StatusLabel](../../frontend/src/common/components/StatusLabel/StatusLabel.tsx) |
| Sidebar destinations and route visibility | [AppNavigation](../../frontend/src/app/components/AppNavigation/AppNavigation.tsx) and [useAppNavigation](../../frontend/src/app/components/AppNavigation/useAppNavigation.ts) |
