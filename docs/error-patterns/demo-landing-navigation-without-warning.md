# Demo mode landing navigation must warn before exit

## What the error looks like

- User is in Demo Mode on an app page and clicks a link to landing (`/` or `/#...`).
- App navigates immediately without warning.
- Landing mount exits demo workspace (`setWorkspace("real")`) and reloads, so the user loses in-progress demo context.

## Why it happens

Landing page intentionally runs demo-exit cleanup (`ExitDemoOnLanding`) on mount.

Without a pre-navigation guard, any internal link to landing silently triggers that cleanup path. Users read this as "demo reset happened unexpectedly."

## How to fix

- Before navigating to landing from a non-landing route, check `isDemoWorkspace()`.
- If demo is active, block immediate navigation and show an explicit confirmation dialog.
- Only continue navigation after user confirms.
- Cover both `"/"` and landing hash links like `"/#problem"`.

## How to detect automatically

- Search for internal links targeting landing:
  - `href="/"`
  - `href="/#`
  - `router.push("/")`
- Flag cases that do not pass through a demo-exit confirmation guard.
- In tests, verify two paths:
  - cancel => no navigation
  - confirm => navigation proceeds
