"use client"

/**
 * Tool Argument Form
 *
 * Inline form for collecting tool arguments before triggering.
 * Dynamically renders fields based on the tool's argument schema.
 */

import { useState, useCallback, useMemo } from "react"
import { X } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getToolDefaultArgs,
  type ManualToolConfig,
  type ManualToolField,
} from "@/lib/gemini/manual-tools"

interface ToolArgumentFormProps {
  /** The tool configuration */
  tool: ManualToolConfig
  /** Called when form is submitted with valid arguments */
  onSubmit: (args: Record<string, unknown>) => void
  /** Called when form is cancelled */
  onCancel: () => void
}

export function ToolArgumentForm({ tool, onSubmit, onCancel }: ToolArgumentFormProps) {
  const defaultArgs = useMemo(() => getToolDefaultArgs(tool), [tool])
  const [values, setValues] = useState<Record<string, string | number | undefined>>(defaultArgs)

  const handleFieldChange = useCallback((name: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      // Convert string values to appropriate types based on field schema
      const args: Record<string, unknown> = {}
      if (tool.argSchema) {
        for (const field of tool.argSchema.fields) {
          const value = values[field.name]
          if (value !== undefined && value !== "") {
            if (field.type === "number") {
              args[field.name] = typeof value === "number" ? value : parseFloat(value as string)
            } else {
              args[field.name] = value
            }
          }
        }
      }

      onSubmit(args)
    },
    [tool, values, onSubmit]
  )

  const Icon = tool.icon

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-3 bg-muted/30 mx-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm flex-1">{tool.displayName}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cancel</span>
        </Button>
      </div>

      {/* Fields */}
      {tool.argSchema && (
        <div className="space-y-3">
          {tool.argSchema.fields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => handleFieldChange(field.name, value)}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Start
        </Button>
      </div>
    </form>
  )
}

// ============================================
// Form Field Component
// ============================================

interface FormFieldProps {
  field: ManualToolField
  value: string | number | undefined
  onChange: (value: string | number) => void
}

function FormField({ field, value, onChange }: FormFieldProps) {
  const id = `tool-arg-${field.name}`

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {field.label}
        {!field.required && (
          <span className="text-muted-foreground ml-1">(optional)</span>
        )}
      </Label>

      {field.type === "select" && field.options && (
        <Select
          value={value?.toString() ?? ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id} className="h-8 text-sm">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "number" && (
        <Input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          value={value?.toString() ?? ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={field.placeholder}
          className="h-8 text-sm"
        />
      )}

      {field.type === "text" && (
        <Input
          id={id}
          type="text"
          value={value?.toString() ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-8 text-sm"
        />
      )}

      {field.type === "date" && (
        <Input
          id={id}
          type="date"
          value={value?.toString() ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
        />
      )}

      {field.type === "time" && (
        <Input
          id={id}
          type="time"
          value={value?.toString() ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
        />
      )}
    </div>
  )
}
