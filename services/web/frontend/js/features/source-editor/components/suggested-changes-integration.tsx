import { useEffect, useCallback, useRef } from 'react'
import { useCodeMirrorViewContext } from './codemirror-context'
import {
  useSuggestedChanges,
  DiffEntry,
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
  }, [])

  // Initialize user document when editor loads
  useEffect(() => {
    if (view && view.state.doc) {
      const currentContent = view.state.doc.toString()
      if (
        currentContent !== suggestedChangesContext.userDocument &&
        !isApplyingChangeRef.current
      ) {
        suggestedChangesContext.setUserDocument(currentContent)
        suggestedChangesContext.setRealDocument(currentContent)
      }
    }
  }, [])

  // Callback to apply a change to CodeMirror editor
  const applyToEditor = useCallback(
    (diff: DiffEntry) => {
      if (!view) return

      console.log('Applying change to editor:', diff)
      isApplyingChangeRef.current = true
      let userDocument = suggestedChangesContext.userDocument

      try {
        if (diff.type === 'insert') {
          userDocument =
            userDocument.slice(0, diff.realFrom) +
            diff.realText +
            userDocument.slice(diff.realFrom)
        } else if (diff.type === 'delete') {
          userDocument =
            userDocument.slice(0, diff.userFrom) +
            userDocument.slice(diff.userTo)
        } else if (diff.type === 'replace') {
          // Replace text at the specified position
          userDocument =
            userDocument.slice(0, diff.userFrom) +
            diff.realText +
            userDocument.slice(diff.userTo)
        }
        console.log('set user', userDocument)
        suggestedChangesContext.setUserDocument(userDocument)
      } finally {
        isApplyingChangeRef.current = false
      }
    },
    [view, suggestedChangesContext.userDocument, suggestedChangesContext]
  )

  // Callback to revert a change from CodeMirror editor
  const revertFromEditor = useCallback(
    (diff: DiffEntry) => {
      if (!view) return

      console.log('Reverting change from editor:', diff)
      isApplyingChangeRef.current = true

      try {
        if (diff.type === 'insert') {
          // Remove the inserted text
          view.dispatch({
            changes: {
              from: diff.realFrom,
              to: diff.realTo,
              insert: '',
            },
          })
        } else if (diff.type === 'delete') {
          // Restore the deleted text
          view.dispatch({
            changes: {
              from: diff.realFrom,
              to: diff.realFrom,
              insert: diff.userText,
            },
          })
        } else if (diff.type === 'replace') {
          // Restore the original text
          view.dispatch({
            changes: {
              from: diff.realFrom,
              to: diff.realTo,
              insert: diff.userText,
            },
          })
        }
      } finally {
        isApplyingChangeRef.current = false
      }
    },
    [view]
  )

  // Register callbacks with context
  useEffect(() => {
    suggestedChangesContext.setApplyToEditorCallback(applyToEditor)
    suggestedChangesContext.setRevertFromEditorCallback(revertFromEditor)
  }, [applyToEditor, revertFromEditor])

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
  }, [view, JSON.stringify(suggestedChangesContext.diffs)])

  return null // Logic component, no UI
}

export default SuggestedChangesIntegration
