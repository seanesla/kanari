# Demo video briefly shows “drop file” placeholder

## What the error looks like
- Opening `/demo`, the first slide flashes a native video placeholder (Chrome: “Drop file”) for a split second before the demo video plays.

## Why it happens
- The browser picks the first `<source>` it can decode (based on the `type` attribute + `canPlayType`).
- If that first `<source>` points to a missing asset (404), Chrome can briefly show its built-in empty-state UI while it falls back to the next `<source>`.
- This commonly happens when `.webm` is listed first but only the `.mp4` is present in `public/demo/`.

## How to detect it automatically
- Unit test the ordering logic for demo video sources (prefer mp4 first) so missing optional `.webm` files don’t get requested by default.
- In manual verification, open DevTools Network and confirm there are no 404s for the first slide video on initial load.

