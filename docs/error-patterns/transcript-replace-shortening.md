# Error Pattern: Transcript “Replace” Shortens and Makes Text Disappear

## What it looks like

- During a streaming assistant reply, the transcript bubble briefly shows a longer sentence and then “shrinks” to a shorter variant.
- Users report: “the bot starts responding and some text disappears”.

## Why it happens

Some streaming sources emit *corrected cumulative* transcript snapshots that revise earlier words. Our merge logic sometimes chose a **replace** strategy (to avoid duplication), but if the replacement snapshot is **shorter** than what was already shown, the UI appears to delete text mid-turn.

This is extra confusing for assistant responses because the user is reading the text as it appears.

## How to detect it automatically

- Unit test the transcript merge utility with:
  - a “previous” transcript that’s long
  - an “incoming” snapshot that revises earlier words **and is shorter**
  - expected behavior: do **not** replace with the shorter snapshot

## Fix / Prevention

- Allow shortening replacements only for true restarts / short openers (e.g., greeting restarts).
- Otherwise, refuse to replace if it would shorten the visible transcript.

