# Error Pattern: Synthesis Screen Fixed Width in Wide Container

## What it looks like

- The post-check-in screen appears cramped in the center of the page.
- Large empty gutters remain on the left and right, even on wide desktop screens.
- Cards like Narrative, Insights, and Suggestions do not use the available horizontal space.

## Why it happens

This happens when a reusable screen component hard-codes a narrow content cap (for example `max-w-2xl`) and is later rendered inside a much wider surface.

In this repo, `SynthesisScreen` was reused in both:

1. a compact dialog context, and
2. a wide inline check-ins context.

Because the component always enforced the same max width internally, the wide context inherited the narrow dialog layout.

## How to detect it automatically

- Search for hard-coded width caps (`max-w-*`) in reusable content components.
- Check where those components are used; flag cases where one usage is dialog-sized and another is full-page or full-panel.
- Add regression tests that assert width mode/class selection per context (compact vs wide).

## How we fix it in this repo

- Add a `layout` mode to `SynthesisScreen` (`compact` | `wide`).
- Keep compact width for dialog contexts.
- Use wide layout in post-check-in inline flows.
- In wide mode, use a responsive two-column desktop structure:
  - left: voice biomarker + self-check cards
  - right: synthesis narrative, insights, and suggestions
