# Demo mode must not overwrite real user data

## What the error looks like

- Starting demo mode changes real user settings (name, onboarding status, API key).
- User progress/trends change after a demo run, even after “exiting” demo mode.
- Demo feels flaky: after navigating, the app may suddenly redirect to onboarding or lose state.

## Why it happens

Some tables use **stable, non-demo keys** (e.g. `trendData.id = YYYY-MM-DD`, `userProgress.id = "default"`, `settings.id = "default"`).

If demo seeding writes to those keys without backing up existing records, it overwrites real user data and there’s nothing to restore during cleanup.

## How to fix

- Before seeding demo data, **backup** any records you will overwrite (especially stable IDs).
- On cleanup, **restore** overwritten records and delete any records that were created only for demo.
- Prefer demo-specific IDs (`demo_...`) when the schema allows it.

## How to detect automatically

- In demo/seed code, flag writes to tables where IDs are:
  - `default`
  - date strings like `YYYY-MM-DD`
  - other stable keys that can exist in real usage
- Search for `put/bulkPut` into those tables without a corresponding restore path.

