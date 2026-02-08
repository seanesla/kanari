# Check-in quiet-period auto-scroll jitter

## What the error looks like

While waiting for the assistant to respond (especially after scheduling), the chat view can:

- flicker/jump as if it is repeatedly scrolling
- move even when no new visible message was added

## Why it happens

- `ConversationView` was auto-scrolling with `smooth` behavior on broad dependencies, including state transitions.
- During long processing/quiet windows, state changes can still occur without real message growth.
- Re-triggering smooth scroll in those moments causes visible jitter/flicker.

## How to detect it automatically

- Component test:
  - render with a stable message list
  - rerender with only state changed
  - assert no `scrollIntoView` call

- Streaming test:
  - rerender with same message ID but updated content
  - assert scroll behavior uses `auto` (not `smooth`) to avoid animation jitter during streaming updates

See: `components/check-in/__tests__/conversation-view.test.tsx`

## Fix / prevention

- Use a signature-based auto-scroll policy:
  - smooth only when a new message arrives
  - auto for in-place streaming updates
  - no scroll for state-only quiet-period updates

## References

- `components/check-in/conversation-view.tsx`
- `components/check-in/__tests__/conversation-view.test.tsx`
