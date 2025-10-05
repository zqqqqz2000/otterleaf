import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from 'react'
import * as diff from 'diff'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'

// Diff entry representing difference between user and real document
export interface DiffEntry {
  id: string
  // Position in user document
  userFrom: number
  userTo: number
  userText: string
  // Position in real document
  realFrom: number
  realTo: number
  realText: string
  // Type of change: 'insert', 'delete', or 'replace'
  type: 'insert' | 'delete' | 'replace'
}

// Context interface with new dual-document architecture
interface SuggestedChangesContextValue {
  // User document: baseline document from user's perspective
  userDocument: string
  // Computed diffs between user and real document
  diffs: DiffEntry[]
  // Accept a change: sync this change from real document to user document (update baseline)
  acceptChange: (changeId: string) => void
  // Revert a change: restore real document to match user document (undo the change)
  revertChange: (changeId: string) => void
  // Clear all changes
  clearAllChanges: () => void
  setRealDocument: (content: string) => void
  // Set the user document baseline
  setUserDocument: (content: string) => void
  // Get callback to apply change to CodeMirror
  getApplyToEditorCallback: () => ((diff: DiffEntry) => void) | null
  setApplyToEditorCallback: (callback: (diff: DiffEntry) => void) => void
  // Get callback to revert change from CodeMirror
  getRevertFromEditorCallback: () => ((diff: DiffEntry) => void) | null
  setRevertFromEditorCallback: (callback: (diff: DiffEntry) => void) => void
}

const SuggestedChangesContext =
  createContext<SuggestedChangesContextValue | null>(null)

export function useSuggestedChanges() {
  const context = useContext(SuggestedChangesContext)
  if (!context) {
    throw new Error(
      'useSuggestedChanges must be used within SuggestedChangesProvider'
    )
  }
  return context
}

interface SuggestedChangesProviderProps {
  children: ReactNode
}

export function SuggestedChangesProvider({
  children,
}: SuggestedChangesProviderProps) {
  // User document: the baseline from user's perspective
  const [userDocument, setUserDocument] = useState<string>('')
  const view = useCodeMirrorViewContext()
  // Current real document content
  const setRealDocument = (docContent: string) => {
    const realDocument = view.state.doc.toString()
    view.dispatch({
      changes: {
        from: 0,
        to: realDocument.length,
        insert: docContent,
      },
    })
  }

  // Callbacks to interact with CodeMirror editor
  const applyToEditorCallbackRef = useRef<((diff: DiffEntry) => void) | null>(
    null
  )
  const revertFromEditorCallbackRef = useRef<
    ((diff: DiffEntry) => void) | null
  >(null)

  // Compute diffs between user document and real document using diff library
  const computeDiffs = useCallback((): DiffEntry[] => {
    const realDocument = view.state.doc.toString()
    if (userDocument === undefined || realDocument === undefined) {
      return []
    }

    const diffs: DiffEntry[] = []
    console.log(
      '==============================================================='
    )
    console.log('user: ', userDocument)
    console.log('real: ', realDocument)
    const changes = diff.diffChars(userDocument, realDocument)

    let userPos = 0
    let realPos = 0
    let diffId = 0

    for (const change of changes) {
      if (change.added) {
        // Text was added to real document (not in user document)
        const diffEntry: DiffEntry = {
          id: `diff_${diffId++}`,
          userFrom: userPos,
          userTo: userPos,
          userText: '',
          realFrom: realPos,
          realTo: realPos + change.value.length,
          realText: change.value,
          type: 'insert',
        }
        diffs.push(diffEntry)
        realPos += change.value.length
      } else if (change.removed) {
        // Text was removed from user document (not in real document)
        const diffEntry: DiffEntry = {
          id: `diff_${diffId++}`,
          userFrom: userPos,
          userTo: userPos + change.value.length,
          userText: change.value,
          realFrom: realPos,
          realTo: realPos,
          realText: '',
          type: 'delete',
        }
        diffs.push(diffEntry)
        userPos += change.value.length
      } else {
        // Text is the same in both documents
        userPos += change.value.length
        realPos += change.value.length
      }
    }

    return diffs
  }, [userDocument])

  const diffs = computeDiffs()
  const realDocument = view.state.doc.toString()

  // Accept a change: sync from real document to user document (update baseline)
  const acceptChange = useCallback(
    (changeId: string) => {
      const diffEntry = diffs.find(d => d.id === changeId)
      if (!diffEntry) {
        console.warn(`Change ${changeId} not found`)
        return
      }

      console.log('Accepting change (syncing to user document):', diffEntry)

      applyToEditorCallbackRef.current?.(diffEntry)
    },
    [diffs, realDocument]
  )

  // Revert a change: restore real document to match user document (undo)
  const revertChange = useCallback(
    (changeId: string) => {
      const diffEntry = diffs.find(d => d.id === changeId)
      if (!diffEntry) {
        console.warn(`Change ${changeId} not found`)
        return
      }

      console.log('Reverting change (restoring from user document):', diffEntry)

      revertFromEditorCallbackRef.current?.(diffEntry)
    },
    [diffs, userDocument]
  )

  // Clear all changes
  const clearAllChanges = useCallback(() => {
    // Reset real document to match user document
    setRealDocument(userDocument)
  }, [userDocument])

  const getApplyToEditorCallback = useCallback(() => {
    return applyToEditorCallbackRef.current
  }, [])

  const setApplyToEditorCallback = useCallback(
    (callback: (diff: DiffEntry) => void) => {
      applyToEditorCallbackRef.current = callback
    },
    []
  )

  const getRevertFromEditorCallback = useCallback(() => {
    return revertFromEditorCallbackRef.current
  }, [])

  const setRevertFromEditorCallback = useCallback(
    (callback: (diff: DiffEntry) => void) => {
      revertFromEditorCallbackRef.current = callback
    },
    []
  )

  const contextValue: SuggestedChangesContextValue = {
    userDocument,
    diffs,
    acceptChange,
    revertChange,
    clearAllChanges,
    setUserDocument,
    setRealDocument,
    getApplyToEditorCallback,
    setApplyToEditorCallback,
    getRevertFromEditorCallback,
    setRevertFromEditorCallback,
  }

  return (
    <SuggestedChangesContext.Provider value={contextValue}>
      {children}
    </SuggestedChangesContext.Provider>
  )
}
