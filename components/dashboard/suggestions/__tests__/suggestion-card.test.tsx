/**
 * @vitest-environment jsdom
 */

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SuggestionCard } from "../suggestion-card"
import type { Suggestion } from "@/lib/types"

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}))

describe("SuggestionCard", () => {
  it("does not throw if suggestion.content is missing (legacy/corrupt data)", () => {
    const suggestion = {
      id: "s1",
      content: undefined,
      rationale: "",
      duration: 10,
      category: "break",
      status: "pending",
      createdAt: new Date().toISOString(),
    } as unknown as Suggestion

    render(<SuggestionCard suggestion={suggestion} />)

    expect(screen.getByText("Untitled suggestion")).toBeInTheDocument()
  })
})

