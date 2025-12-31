export class KanariError extends Error {
  code: string
  context?: Record<string, unknown>

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message)
    this.name = "KanariError"
    this.code = code
    this.context = context
  }
}

