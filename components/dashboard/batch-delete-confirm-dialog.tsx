"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface BatchDeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onConfirm: () => void
}

/**
 * Confirmation dialog for batch deletion of check-ins.
 */
export function BatchDeleteConfirmDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: BatchDeleteConfirmDialogProps) {
  const plural = selectedCount !== 1

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {selectedCount} check-in{plural ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the selected
            check-in{plural ? "s" : ""} and remove the data from your device.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
