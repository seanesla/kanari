import type { Theme } from "@nivo/core"
import { DEFAULT_ACCENT } from "@/lib/color-utils"

// Factory function for Nivo theme with dynamic accent color
export function getNivoTheme(accentColor: string = DEFAULT_ACCENT): Theme {
  return {
    background: "transparent",
    text: {
      fontSize: 12,
      fill: "#999",
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    axis: {
      domain: {
        line: {
          stroke: "#333",
          strokeWidth: 1,
        },
      },
      legend: {
        text: {
          fontSize: 12,
          fill: "#999",
          outlineWidth: 0,
          outlineColor: "transparent",
        },
      },
      ticks: {
        line: {
          stroke: "#333",
          strokeWidth: 1,
        },
        text: {
          fontSize: 11,
          fill: "#999",
          outlineWidth: 0,
          outlineColor: "transparent",
        },
      },
    },
    grid: {
      line: {
        stroke: "#333",
        strokeWidth: 1,
        strokeDasharray: "3 3",
      },
    },
    legends: {
      title: {
        text: {
          fontSize: 12,
          fill: "#999",
          outlineWidth: 0,
          outlineColor: "transparent",
        },
      },
      text: {
        fontSize: 12,
        fill: "#999",
        outlineWidth: 0,
        outlineColor: "transparent",
      },
      ticks: {
        line: {},
        text: {
          fontSize: 10,
          fill: "#999",
          outlineWidth: 0,
          outlineColor: "transparent",
        },
      },
    },
    annotations: {
      text: {
        fontSize: 13,
        fill: "#999",
        outlineWidth: 2,
        outlineColor: "#000",
        outlineOpacity: 1,
      },
      link: {
        stroke: "#666",
        strokeWidth: 1,
        outlineWidth: 2,
        outlineColor: "#000",
        outlineOpacity: 1,
      },
      outline: {
        stroke: "#666",
        strokeWidth: 2,
        outlineWidth: 2,
        outlineColor: "#000",
        outlineOpacity: 1,
      },
      symbol: {
        fill: "#666",
        outlineWidth: 2,
        outlineColor: "#000",
        outlineOpacity: 1,
      },
    },
    tooltip: {
      wrapper: {},
      container: {
        background: "rgba(20, 20, 20, 0.95)",
        color: "#fff",
        fontSize: 12,
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
        padding: "12px 16px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(8px)",
      },
      basic: {},
      chip: {},
      table: {},
      tableCell: {},
      tableCellValue: {},
    },
    crosshair: {
      line: {
        stroke: accentColor,
        strokeWidth: 1,
        strokeOpacity: 0.5,
        strokeDasharray: "6 6",
      },
    },
  }
}

// Factory function for chart colors with dynamic accent
export function getChartColors(accentColor: string = DEFAULT_ACCENT) {
  return {
    stress: "#ef4444",    // Red for stress
    fatigue: accentColor, // Dynamic accent color for fatigue
    success: "#22c55e",   // Green for positive/improving
    warning: "#f59e0b",   // Orange for caution
    muted: "#666",        // Muted gray
  }
}

// Factory function for area fill definitions with dynamic accent
export function getAreaFillDefinitions(accentColor: string = DEFAULT_ACCENT) {
  return [
    {
      id: "stressGradient",
      type: "linearGradient" as const,
      colors: [
        { offset: 0, color: "#ef4444", opacity: 0.4 },
        { offset: 100, color: "#ef4444", opacity: 0 },
      ],
    },
    {
      id: "fatigueGradient",
      type: "linearGradient" as const,
      colors: [
        { offset: 0, color: accentColor, opacity: 0.4 },
        { offset: 100, color: accentColor, opacity: 0 },
      ],
    },
  ]
}

// Backwards compatibility: static exports using default accent color
export const nivoTheme = getNivoTheme()
export const chartColors = getChartColors()
export const areaFillDefinitions = getAreaFillDefinitions()
