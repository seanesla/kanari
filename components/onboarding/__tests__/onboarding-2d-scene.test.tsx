// @vitest-environment jsdom

import React from "react"
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { Onboarding2DScene } from "../onboarding-2d-scene"

describe("Onboarding2DScene", () => {
  it("renders only the current step", () => {
    const { queryByText } = render(
      <Onboarding2DScene currentStep={1}>
        <div>Step 0</div>
        <div>Step 1</div>
        <div>Step 2</div>
      </Onboarding2DScene>
    )

    expect(queryByText("Step 0")).toBeNull()
    expect(queryByText("Step 1")).not.toBeNull()
    expect(queryByText("Step 2")).toBeNull()
  })
})

