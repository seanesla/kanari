# Dashboard empty state renders duplicate layout boxes

## What it looks like
- On the Overview page (`/dashboard`), when there are no suggestions yet, extra empty “Kanban” and “Calendar” boxes appear below the real ones.
- On mobile, this can look like “broken boxes” (unexpected empty cards with fixed heights) and adds unnecessary scrolling.

## Why it happens
- `UnifiedDashboard` already renders the Kanban + Calendar layout for both mobile and desktop.
- An “empty state” implementation that additionally renders `DashboardLayout` (which also includes its own Kanban + Calendar wrappers) will duplicate those containers.
- If `DashboardLayout` is rendered with `kanban={null}` / `calendar={null}`, the duplicated containers show up as empty boxes.

## How to detect automatically
- UI unit test:
  - Mock `useSuggestions()` to return no suggestions and `loading: false`.
  - Mock `useResponsive()` to return `isMobile: true`.
  - Assert the empty state CTA is present and that the legacy `DashboardLayout` height classes are not rendered (ex: `h-[260px]`, `h-[70vh]`).
  - File: `components/dashboard/__tests__/unified-dashboard-empty-state.test.tsx`

## Fix pattern
- Render the empty state CTA (text + button) without introducing a second “layout” component.
- If you want to reuse a layout component, render it **instead of** the main layout, not in addition to it.

## Related code
- `components/dashboard/unified-dashboard.tsx`
- `components/dashboard/dashboard-layout.tsx`
- `components/dashboard/__tests__/unified-dashboard-empty-state.test.tsx`

