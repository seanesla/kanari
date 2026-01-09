# FullCalendar missing base CSS (broken layout)

## What it looks like

- The Overview calendar renders, but the grid/headers/events look “unstyled” or misaligned.
- Day columns don’t line up, time slots collapse, and events appear stacked or positioned incorrectly.

## Why it happens

FullCalendar’s React component does **not** ship styles automatically at runtime. The core layout
(scroll grid, time grid, month grid, positioning) depends on the package CSS files:

- Core styles
- DayGrid styles
- TimeGrid styles

If these base styles are missing, any custom theme overrides (like `fullcalendar-theme.css`) can’t
“fix” layout because the underlying structural CSS never loads.

## How to detect it automatically

- Add a regression test that asserts `FullCalendarView` imports the required CSS.
  - See `components/dashboard/calendar/__tests__/fullcalendar-view.test.tsx`.
- Code review checklist: any new FullCalendar view must include base CSS imports **before** the
  local theme stylesheet.

## Fix

In this repo (FullCalendar `6.1.20`), the npm packages don’t expose CSS files via package exports,
so we vendor the required base CSS into `components/dashboard/calendar/fullcalendar-base.css`
(extracted from the `index.global.js` bundles).

In `components/dashboard/calendar/fullcalendar-view.tsx`, import `./fullcalendar-base.css` **before**
`./fullcalendar-theme.css`.
