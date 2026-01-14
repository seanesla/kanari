"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Trash2, CheckSquare, X } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { GlassPanel } from "@/components/ui/glass-panel"

interface SelectionActionBarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onDeleteSelected: () => void
}

/**
 * Floating action bar that appears when items are selected.
 * Shows selected count, select all/clear toggle, and delete button.
 */
export function SelectionActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
}: SelectionActionBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <GlassPanel glow blur="xl" className="px-4 py-3 flex items-center gap-4">
            {/* Selected count */}
            <span className="text-sm font-medium text-foreground">
              {selectedCount} selected
            </span>

            {/* Divider */}
            <div className="h-4 w-px bg-border/50" />

            {/* Select All / Clear button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={allSelected ? onClearSelection : onSelectAll}
              className="gap-2"
            >
              {allSelected ? (
                <>
                  <X className="h-4 w-4" />
                  Clear
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4" />
                  Select All
                </>
              )}
            </Button>

            {/* Delete button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteSelected}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
