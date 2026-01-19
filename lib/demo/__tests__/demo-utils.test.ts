/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { findDemoElement } from "../demo-utils"

type RectInput = {
  left: number
  top: number
  width: number
  height: number
}

const makeRect = ({ left, top, width, height }: RectInput): DOMRect => {
  const right = left + width
  const bottom = top + height
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

const mockRect = (element: HTMLElement, rect: DOMRect) => {
  element.getBoundingClientRect = vi.fn(() => rect)
}

describe("demo-utils", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    })
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    })
  })

  it("prefers visible elements when multiple candidates exist", () => {
    const hidden = document.createElement("div")
    hidden.setAttribute("data-demo-id", "demo-target")
    hidden.style.display = "none"
    document.body.appendChild(hidden)
    mockRect(hidden, makeRect({ left: 0, top: 0, width: 120, height: 40 }))

    const visible = document.createElement("div")
    visible.setAttribute("data-demo-id", "demo-target")
    visible.style.display = "block"
    document.body.appendChild(visible)
    mockRect(visible, makeRect({ left: 24, top: 24, width: 200, height: 80 }))

    expect(findDemoElement("demo-target")).toBe(visible)
  })

  it("chooses the most visible candidate in the viewport", () => {
    const offscreen = document.createElement("div")
    offscreen.setAttribute("data-demo-id", "demo-target")
    offscreen.style.display = "block"
    document.body.appendChild(offscreen)
    mockRect(offscreen, makeRect({ left: 0, top: -300, width: 400, height: 200 }))

    const inView = document.createElement("div")
    inView.setAttribute("data-demo-id", "demo-target")
    inView.style.display = "block"
    document.body.appendChild(inView)
    mockRect(inView, makeRect({ left: 120, top: 160, width: 200, height: 120 }))

    expect(findDemoElement("demo-target")).toBe(inView)
  })
})
