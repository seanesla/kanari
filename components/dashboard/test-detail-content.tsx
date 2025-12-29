import { CheckCircle2, XCircle, Clock, Database } from "lucide-react"
import { getTestDetailById } from "@/lib/data/mock-tests"

export interface TestDetailContentProps {
  testId: string
}

export function TestDetailContent({ testId }: TestDetailContentProps) {
  const test = getTestDetailById(testId)
  const isPassing = test.status === "pass"

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div
        className={`rounded-lg border p-6 ${isPassing ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}
      >
        <div className="flex items-center gap-4">
          {isPassing ? (
            <CheckCircle2 className="h-8 w-8 text-success" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
          <div>
            <h2 className="text-2xl font-semibold">{test.name}</h2>
            <p className="text-muted-foreground">
              {isPassing
                ? "This test is passing. Values match within tolerance."
                : "This test is failing. Significant variance detected."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main comparison */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-6 font-semibold">Value Comparison</h3>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-secondary/30 p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Database className="h-4 w-4" />
                  Dashboard ({test.source})
                </div>
                <p className="text-4xl font-semibold tabular-nums">{test.dashboardValue}</p>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Database className="h-4 w-4" />
                  Ground Truth
                </div>
                <p className={`text-4xl font-semibold tabular-nums ${!isPassing ? "text-destructive" : ""}`}>
                  {test.calculatedValue}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-8 rounded-lg bg-secondary/50 p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Variance</p>
                <p className={`text-2xl font-semibold font-mono ${isPassing ? "text-success" : "text-destructive"}`}>
                  {test.variance}
                </p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Confidence</p>
                <p className="text-2xl font-semibold font-mono">{test.confidence}</p>
              </div>
            </div>
          </div>

          {/* Query */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold">Validation Query</h3>
            <pre className="overflow-x-auto rounded-lg bg-secondary/50 p-4 text-sm font-mono text-muted-foreground">
              {test.query}
            </pre>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold">Details</h3>
            <dl className="space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd className={`text-sm font-medium ${isPassing ? "text-success" : "text-destructive"}`}>
                  {isPassing ? "PASS" : "FAIL"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Source</dt>
                <dd className="text-sm">{test.source}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Last Run</dt>
                <dd className="text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {test.lastRun}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold">History</h3>
            <div className="space-y-3">
              {test.history.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {entry.status === "pass" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-muted-foreground">{entry.time}</span>
                  </div>
                  <span className={`font-mono ${entry.status === "pass" ? "text-success" : "text-destructive"}`}>
                    {entry.variance}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
