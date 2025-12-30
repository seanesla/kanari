# Error Pattern: `aria-hidden` Blocked Because a Descendant Retained Focus

## What it looks like

In Chrome DevTools you see a warning like:

- `Blocked aria-hidden on an element because its descendant retained focus.`
- It often points at a focused `<button>` (or other control) inside a container that a modal/drawer is trying to hide.

This commonly happens when opening a Radix/vaul modal/drawer from a focused trigger button.

## Why it happens

Many modal/drawer libraries temporarily apply `aria-hidden="true"` to the rest of the page to hide background content from assistive technologies while a modal is open.

If the **trigger button still has focus** at the moment `aria-hidden` is applied to the background, Chrome blocks the attribute change (because focused content must not be hidden from assistive technology users).

## How to detect it automatically

- Open the app in Chrome, trigger the modal/drawer via keyboard (Enter/Space), and watch the console for the warning.
- Code review:
  - Opening a modal/drawer by setting state directly (instead of using the library’s Trigger component), without moving focus.
  - Custom `onOpenAutoFocus` logic that focuses too late.

## Preferred fixes

Pick the smallest option that fits the component:

1. **Blur the trigger before opening** (simple, works with controlled open state)  
   Call `event.currentTarget.blur()` before setting `open = true`.

2. **Use the library Trigger component** (best when possible)  
   `DialogTrigger` / `DrawerTrigger` usually wires focus management correctly.

3. **Explicitly focus something inside the modal on open**  
   Use `onOpenAutoFocus` (or equivalent) to focus a close button or the first input.

`inert` can also help for background interaction, but the core issue is ensuring focus is not left inside the region being hidden.

