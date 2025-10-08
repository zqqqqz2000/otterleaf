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
  // AI diff mode: whether to show diffs for AI-generated changes
  isAiDiffMode: boolean
  openAiDiff: () => void
  closeAiDiff: () => void
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
  // AI diff mode: whether to show diffs for AI-generated changes
  const [isAiDiffMode, setIsAiDiffMode] = useState<boolean>(false)
  const view = useCodeMirrorViewContext()

  // Generate diff id based on diff content using Web Crypto API SHA256 hash first 8 characters
  const generateDiffId = useCallback(
    async (diffEntry: Omit<DiffEntry, 'id'>): Promise<string> => {
      const encoder = new TextEncoder()
      const data = encoder.encode(JSON.stringify(diffEntry))
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      return hashHex.substring(0, 8)
    },
    []
  )
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

  // Merge adjacent diffs to optimize display and reduce complexity
  const mergeAdjacentDiffs = useCallback(
    async (diffs: DiffEntry[]): Promise<DiffEntry[]> => {
      if (diffs.length === 0) return []

      console.log('=== Merging adjacent diffs ===')
      console.log('Original diffs count:', diffs.length)
      console.log('Original diffs:', diffs)

      const merged: DiffEntry[] = []
      let current = { ...diffs[0] }

      for (let i = 1; i < diffs.length; i++) {
        const next = diffs[i]

        // Check if we can merge with the next diff
        const canMerge =
          // Adjacent positions
          (current.realTo === next.realFrom &&
            current.userTo === next.userFrom) ||
          // Same position (overlapping)
          (current.realFrom === next.realFrom &&
            current.userFrom === next.userFrom)

        console.log(`Checking merge between diff ${i - 1} and ${i}:`, {
          current: {
            type: current.type,
            userText: current.userText,
            realText: current.realText,
          },
          next: {
            type: next.type,
            userText: next.userText,
            realText: next.realText,
          },
          canMerge,
        })

        if (canMerge) {
          // Merge insert + delete into replace/update
          if (
            (current.type === 'insert' && next.type === 'delete') ||
            (current.type === 'delete' && next.type === 'insert')
          ) {
            console.log('Merging insert+delete into replace')

            if (current.type === 'delete' && next.type === 'insert') {
              // current: delete operation (has userText), next: insert operation (has realText)
              // Keep current.userText, add next.realText, update positions
              current.realText = next.realText
              current.realTo = next.realTo
              current.type = 'replace'
              // userTo and userFrom should already be correct from current
            } else {
              // current: insert operation (has realText), next: delete operation (has userText)
              // Add next.userText, keep current.realText, update positions
              current.userText = next.userText
              current.userTo = next.userTo
              current.type = 'replace'
              // realTo and realFrom should already be correct from current
            }
          }
          // Merge consecutive inserts
          else if (current.type === 'insert' && next.type === 'insert') {
            console.log('Merging consecutive inserts')
            current.realText += next.realText
            current.realTo = next.realTo
          }
          // Merge consecutive deletes
          else if (current.type === 'delete' && next.type === 'delete') {
            console.log('Merging consecutive deletes')
            current.userText += next.userText
            current.userTo = next.userTo
          }
          // Merge consecutive replaces
          else if (current.type === 'replace' && next.type === 'replace') {
            console.log('Merging consecutive replaces')
            current.userText += next.userText
            current.realText += next.realText
            current.userTo = next.userTo
            current.realTo = next.realTo
          }
          // Merge replace with insert/delete
          else if (
            current.type === 'replace' &&
            (next.type === 'insert' || next.type === 'delete')
          ) {
            console.log('Merging replace with insert/delete')
            if (next.type === 'insert') {
              current.realText += next.realText
              current.realTo = next.realTo
            } else {
              current.userText += next.userText
              current.userTo = next.userTo
            }
          }
          // Merge insert/delete with replace
          else if (
            (current.type === 'insert' || current.type === 'delete') &&
            next.type === 'replace'
          ) {
            console.log('Merging insert/delete with replace')
            current.type = 'replace'
            current.userText = next.userText
            current.realText = current.realText || next.realText
            current.userTo = next.userTo
            current.realTo = next.realTo
          }
        } else {
          // Cannot merge, push current and start new
          console.log('Cannot merge, pushing current diff')
          const { id, ...currentWithoutId } = current
          current.id = await generateDiffId(currentWithoutId)
          merged.push(current)
          current = { ...next }
        }
      }

      // Push the last diff
      const { id, ...currentWithoutId } = current
      current.id = await generateDiffId(currentWithoutId)
      merged.push(current)

      console.log('Merged diffs count:', merged.length)
      console.log('Merged diffs:', merged)
      console.log('=== Merge complete ===')

      return merged
    },
    [generateDiffId]
  )

  // Compute diffs between user document and real document using diff library
  const computeDiffs = useCallback(async (): Promise<DiffEntry[]> => {
    const realDocument = view.state.doc.toString()
    if (userDocument === undefined || realDocument === undefined) {
      return []
    }

    // Only compute diffs when AI diff mode is enabled
    if (!isAiDiffMode) {
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

    for (const change of changes) {
      if (change.added) {
        // Text was added to real document (not in user document)
        const diffEntryWithoutId = {
          userFrom: userPos,
          userTo: userPos,
          userText: '',
          realFrom: realPos,
          realTo: realPos + change.value.length,
          realText: change.value,
          type: 'insert' as const,
        }
        const diffEntry: DiffEntry = {
          id: await generateDiffId(diffEntryWithoutId),
          ...diffEntryWithoutId,
        }
        diffs.push(diffEntry)
        realPos += change.value.length
      } else if (change.removed) {
        // Text was removed from user document (not in real document)
        const diffEntryWithoutId = {
          userFrom: userPos,
          userTo: userPos + change.value.length,
          userText: change.value,
          realFrom: realPos,
          realTo: realPos,
          realText: '',
          type: 'delete' as const,
        }
        const diffEntry: DiffEntry = {
          id: await generateDiffId(diffEntryWithoutId),
          ...diffEntryWithoutId,
        }
        diffs.push(diffEntry)
        userPos += change.value.length
      } else {
        // Text is the same in both documents
        userPos += change.value.length
        realPos += change.value.length
      }
    }

    // Merge adjacent diffs to optimize the result
    return await mergeAdjacentDiffs(diffs)
  }, [
    userDocument,
    view.state.doc.toString(),
    mergeAdjacentDiffs,
    generateDiffId,
    isAiDiffMode,
  ])

  const [diffs, setDiffs] = useState<DiffEntry[]>([])
  const realDocument = view.state.doc.toString()

  // Update diffs when user document or real document changes
  React.useEffect(() => {
    const updateDiffs = async () => {
      const newDiffs = await computeDiffs()
      setDiffs(newDiffs)
    }
    updateDiffs()
  }, [computeDiffs])

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

  // AI diff mode control functions
  const openAiDiff = useCallback(() => {
    console.log('Opening AI diff mode')
    
    // When opening AI diff mode, set the current editor content as the baseline (user document)
    // if user document is empty or different from current content
    const currentContent = view.state.doc.toString()
    if (userDocument === '' || userDocument !== currentContent) {
      console.log('Setting user document baseline:', currentContent)
      setUserDocument(currentContent)
    }
    
    setIsAiDiffMode(true)
  }, [view.state.doc.toString()]) // 移除 userDocument 依赖，避免循环

  const closeAiDiff = useCallback(() => {
    console.log('Closing AI diff mode')
    setIsAiDiffMode(false)
    // Clear all diffs when closing AI diff mode
    setDiffs([])
  }, [])

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
    isAiDiffMode,
    openAiDiff,
    closeAiDiff,
  }

  return (
    <SuggestedChangesContext.Provider value={contextValue}>
      {children}
    </SuggestedChangesContext.Provider>
  )
}
