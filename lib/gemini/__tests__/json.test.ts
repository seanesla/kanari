import { describe, expect, test } from "vitest"
import { parseGeminiJson } from "../json"

describe("parseGeminiJson", () => {
  test("parses plain JSON object", () => {
    const result = parseGeminiJson<{ ok: boolean }>('{"ok":true}')
    expect(result).toEqual({ ok: true })
  })

  test("parses JSON wrapped in ```json fences", () => {
    const result = parseGeminiJson<{ a: number }>("```json\n{ \"a\": 1 }\n```")
    expect(result).toEqual({ a: 1 })
  })

  test("extracts JSON substring when extra text is present", () => {
    const result = parseGeminiJson<{ hello: string }>("Here you go:\n{ \"hello\": \"world\" }\nThanks!")
    expect(result).toEqual({ hello: "world" })
  })

  test("throws a consistent error message when parsing fails", () => {
    expect(() => parseGeminiJson("not json")).toThrow(/Gemini response parse error/i)
  })
})

