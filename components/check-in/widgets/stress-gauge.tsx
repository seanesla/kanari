"use client"

import { useMemo } from "react"
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import type { StressGaugeWidgetState } from "@/lib/types"
import { WidgetContainer } from "./widget-container"

function clamp0to100(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function Gauge({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  const data = useMemo(() => [{ value: clamp0to100(value) }], [value])
  const safeValue = data[0]?.value ?? 0

  return (
    <div className="flex flex-col items-center">
      <div className="h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="60%"
            innerRadius="70%"
            outerRadius="95%"
            barSize={10}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              tick={false}
            />
            <RadialBar
              background
              dataKey="value"
              fill={color}
              cornerRadius={10}
              isAnimationActive
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 text-center">
        <div className="text-lg font-semibold tabular-nums">{Math.round(safeValue)}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

interface StressGaugeProps {
  widget: StressGaugeWidgetState
  onDismiss?: () => void
}

export function StressGauge({ widget, onDismiss }: StressGaugeProps) {
  const stress = clamp0to100(widget.args.stressLevel)
  const fatigue = clamp0to100(widget.args.fatigueLevel)

  return (
    <WidgetContainer
      title="Voice stress check"
      description="Based on your current session"
      onDismiss={onDismiss}
    >
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">Stress</Badge>
        <Badge variant="secondary">Fatigue</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Gauge label="Stress" value={stress} color="#ef4444" />
        <Gauge label="Fatigue" value={fatigue} color="#a855f7" />
      </div>

      {widget.args.message ? (
        <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
          {widget.args.message}
        </p>
      ) : null}
    </WidgetContainer>
  )
}

