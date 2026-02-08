# Demo guide step context not enforced

## What the error looks like

- Demo walkthrough says "this step is on Check-ins" (or Trends), but the user is still on another page.
- User can keep pressing Next and finish the guide without actually seeing the referenced UI.
- Required moments (like opening New Check-in) are skipped accidentally.

## Why it happens

- Guide steps include route and UI context, but navigation is treated as informational only.
- There is no guard to re-apply step context after route drift, tab changes, or off-target clicks.
- Next is not gated on required DOM state for action-driven steps.

## How to detect it automatically

- Find guide-step models that contain `route` or target metadata.
- Verify the runtime controller does all three for those steps:
  - auto-navigates to the route when the step becomes active,
  - re-enforces context when the current target is missing,
  - disables Next until required completion targets exist.
- Add integration tests for:
  - route enforcement,
  - required-action gating,
  - resume behavior.

## How to fix

- For demo guide steps, treat route/target as required state, not a hint.
- Add a route + target enforcement loop when a step is active.
- Gate Next using a required completion selector (for example `demo-new-checkin-view`).
- Persist demo guide progress and restore it on resume.
