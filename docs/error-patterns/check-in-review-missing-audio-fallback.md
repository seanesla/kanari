# Check-in review missing playback audio and cramped mobile controls

## What the error looks like

- In History/Check-ins review, some sessions show transcript but no playable audio.
- This is common for older/legacy sessions tied to a `recordingId` but missing `session.audioData`.
- On mobile, playback controls feel cramped because all controls are forced into a single horizontal row.

## Why it happens

- The detail view only used `session.audioData` for playback.
- Older sessions may have audio in the linked recording record, not copied into the session object.
- The player layout assumed desktop width and did not adapt control density for small screens.

## How to detect it automatically

- Detail-view regression test:
  - Render a session with no `session.audioData` but with `recordingId` + linked recording audio.
  - Assert the audio player still renders.
- Source-priority regression test:
  - Render with both session audio and linked recording audio.
  - Assert session audio is preferred.
- Mobile layout regression test:
  - Force mobile mode.
  - Assert the player uses a stacked layout with a full-width progress bar.

## Fix / prevention

- In check-in review, fall back to linked recording audio when session audio is absent.
- Normalize legacy audio shapes before playback (typed arrays + legacy arrays).
- Keep a mobile-specific playback layout with larger seek target and less horizontal crowding.
