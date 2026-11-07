# Introduction

The frontend uses React, TypeScript, and Vite. Read the guides in the order below
for a new feature, or go directly to the guide matching your task.

## Find the Right Guide

| What are you changing? | Guide |
|---|---|
| File placement, component boundaries, hooks, and lifecycles | [Ownership](01-ownership.md) |
| Temporary state, queries, APIs, mutations, and render performance | [State and Data](02-state-and-data.md) |
| Saved controls, field rules, restoration, and table layout | [Preferences](03-preferences.md) |
| Generate implementation and colocated test outlines | [Scaffolding](04-scaffolding.md) |
| Test ownership and suite organization | [Testing](../workflows/delivery/testing.md#test-ownership) |

## Find a Component

1. Find the source owner below.
2. Read its types, function documentation, and colocated tests for inputs and behavior.
3. Update contracts at that source owner using the [design recipe](../workflows/documentation.md).

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
