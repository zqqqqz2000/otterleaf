import { useEffect, useCallback, useRef } from 'react'
import { useCodeMirrorViewContext } from './codemirror-context'
import {
  useSuggestedChanges,
  AppliedChange,
} from '../../ide-react/context/suggested-changes-context'
import { setGlobalSuggestedChangesContext } from '../../ide-react/api/editor-api'
import { updateSuggestedChanges } from '../extensions/suggested-changes'

/**
 * Suggested changes integration component
 * Bridges suggested changes context with CodeMirror editor
 */
export function SuggestedChangesIntegration() {
  const view = useCodeMirrorViewContext()
  const suggestedChangesContext = useSuggestedChanges()
  const isApplyingChangeRef = useRef(false)

  // Set global context reference for editor-api
  useEffect(() => {
    setGlobalSuggestedChangesContext(suggestedChangesContext)

    return () => {
      setGlobalSuggestedChangesContext(null)
    }
  }, [suggestedChangesContext])

  // Initialize user document when editor loads
  useEffect(() => {
    if (view && view.state.doc) {
      const currentContent = view.state.doc.toString()
      if (currentContent !== suggestedChangesContext.userDocument && !isApplyingChangeRef.current) {
        suggestedChangesContext.setUserDocument(currentContent)
      }
    }
  }, [view, suggestedChangesContext])

  // Callback to apply a change to CodeMirror editor
  const applyToEditor = useCallback(
    (change: AppliedChange) => {
      if (!view) return

      console.log('Applying change to editor:', change)
      isApplyingChangeRef.current = true

      try {
        view.dispatch({
          changes: {
            from: change.realDocFrom,
            to: change.realDocFrom + change.userDocText.length,
            insert: change.insertedText,
          },
        })
      } finally {
        isApplyingChangeRef.current = false
      }
    },
    [view]
  )

  // Callback to revert a change from CodeMirror editor
  const revertFromEditor = useCallback(
    (change: AppliedChange) => {
      if (!view) return

      console.log('Reverting change from editor:', change)
      isApplyingChangeRef.current = true

      try {
        // Calculate current position in real document
        // Need to account for other changes that might have shifted positions
        const allChanges = suggestedChangesContext.appliedChanges
        let currentRealFrom = change.realDocFrom
        let currentRealTo = change.realDocTo

        // Adjust for other changes applied after this one
        for (const otherChange of allChanges) {
          if (otherChange.id === change.id) continue
          if (otherChange.timestamp > change.timestamp) {
            if (otherChange.realDocFrom <= currentRealFrom) {
              const lengthDiff =
                otherChange.insertedText.length -
                (otherChange.userDocTo - otherChange.userDocFrom)
              currentRealFrom += lengthDiff
              currentRealTo += lengthDiff
            }
          }
        }

        view.dispatch({
          changes: {
            from: currentRealFrom,
            to: currentRealTo,
            insert: change.userDocText,
          },
        })
      } finally {
        isApplyingChangeRef.current = false
      }
    },
    [view, suggestedChangesContext.appliedChanges]
  )

  // Register callbacks with context
  useEffect(() => {
    suggestedChangesContext.setApplyToEditorCallback(applyToEditor)
    suggestedChangesContext.setRevertFromEditorCallback(revertFromEditor)
  }, [suggestedChangesContext, applyToEditor, revertFromEditor])

  // Handle accept change (user clicked accept button)
  const handleAcceptChange = useCallback(
    (changeId: string) => {
      console.log('Accepting change:', changeId)
      suggestedChangesContext.acceptChange(changeId)
    },
    [suggestedChangesContext]
  )

  // Handle revert change (user clicked revert button)
  const handleRevertChange = useCallback(
    (changeId: string) => {
      console.log('Reverting change:', changeId)
      suggestedChangesContext.revertChange(changeId)
    },
    [suggestedChangesContext]
  )

  // Update CodeMirror decorations when diffs change
  useEffect(() => {
    if (view) {
      updateSuggestedChanges(
        view,
        suggestedChangesContext.diffs,
        handleAcceptChange,
        handleRevertChange
      )
    }
  }, [view, suggestedChangesContext.diffs, handleAcceptChange, handleRevertChange])

  return null // Logic component, no UI
}

export default SuggestedChangesIntegration