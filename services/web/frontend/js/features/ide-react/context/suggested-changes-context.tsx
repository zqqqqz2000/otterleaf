import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from 'react'

// Applied change record - tracks changes applied to real document
export interface AppliedChange {
  id: string
  timestamp: number
  // Position in USER document where the change was applied
  userDocFrom: number
  userDocTo: number
  // The text in user document that was replaced
  userDocText: string
  // The new text that was inserted in real document
  insertedText: string
  // Position in REAL document after applying the change
  realDocFrom: number
  realDocTo: number
}

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
  // Reference to the applied change that caused this diff
  changeId: string
}

// Context interface with new dual-document architecture
interface SuggestedChangesContextValue {
  // User document: baseline document from user's perspective
  userDocument: string
  // Applied changes that were made to real document
  appliedChanges: AppliedChange[]
  // Computed diffs between user and real document
  diffs: DiffEntry[]
  // Apply a suggested change to real document (returns change ID)
  applySuggestedChange: (
    userDocFrom: number,
    userDocTo: number,
    text: string
  ) => string
  // Accept a change: sync this change from real document to user document (update baseline)
  acceptChange: (changeId: string) => void
  // Revert a change: restore real document to match user document (undo the change)
  revertChange: (changeId: string) => void
  // Clear all changes
  clearAllChanges: () => void
  // Set the user document baseline
  setUserDocument: (content: string) => void
  // Update real document content (called when CodeMirror changes)
  setRealDocument: (content: string) => void
  // Get callback to apply change to CodeMirror
  getApplyToEditorCallback: () => ((change: AppliedChange) => void) | null
  setApplyToEditorCallback: (callback: (change: AppliedChange) => void) => void
  // Get callback to revert change from CodeMirror
  getRevertFromEditorCallback: () => ((change: AppliedChange) => void) | null
  setRevertFromEditorCallback: (
    callback: (change: AppliedChange) => void
  ) => void
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
  // Applied changes that modified the real document
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([])
  // Current real document content
  const [realDocument, setRealDocument] = useState<string>('')
  
  // Callbacks to interact with CodeMirror editor
  const applyToEditorCallbackRef = useRef<((change: AppliedChange) => void) | null>(null)
  const revertFromEditorCallbackRef = useRef<((change: AppliedChange) => void) | null>(null)

  // Generate unique ID
  const generateId = useCallback(() => {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Map user document position to real document position
  const mapUserPosToRealPos = useCallback((userPos: number): number => {
    let realPos = userPos
    
    // Apply all changes that come before this position
    for (const change of appliedChanges) {
      if (change.userDocTo <= userPos) {
        // This change is completely before userPos, adjust position
        const lengthDiff = change.insertedText.length - (change.userDocTo - change.userDocFrom)
        realPos += lengthDiff
      } else if (change.userDocFrom < userPos) {
        // userPos is inside this change range
        // Map to the corresponding position in the inserted text
        const offsetInChange = userPos - change.userDocFrom
        const userLength = change.userDocTo - change.userDocFrom
        const realLength = change.insertedText.length
        
        // Proportional mapping
        const proportionalOffset = Math.round((offsetInChange / userLength) * realLength)
        realPos = change.realDocFrom + proportionalOffset
        return realPos
      }
    }
    
    return realPos
  }, [appliedChanges])

  // Compute diffs between user document and real document
  const computeDiffs = useCallback((): DiffEntry[] => {
    const diffs: DiffEntry[] = []
    
    // Sort applied changes by position in user document
    const sortedChanges = [...appliedChanges].sort((a, b) => a.userDocFrom - b.userDocFrom)
    
    let userPos = 0
    let realPos = 0
    
    for (const change of sortedChanges) {
      // Verify positions are in sync up to this change
      // Skip unchanged regions before this change
      if (change.userDocFrom > userPos) {
        const unchangedLength = change.userDocFrom - userPos
        userPos = change.userDocFrom
        realPos += unchangedLength
      }
      
      // Create diff entry for this change
      const diff: DiffEntry = {
        id: generateId(),
        userFrom: change.userDocFrom,
        userTo: change.userDocTo,
        userText: change.userDocText,
        realFrom: realPos,
        realTo: realPos + change.insertedText.length,
        realText: change.insertedText,
        changeId: change.id,
      }
      diffs.push(diff)
      
      // Update positions
      userPos = change.userDocTo
      realPos += change.insertedText.length
    }
    
    return diffs
  }, [appliedChanges, generateId])

  const diffs = computeDiffs()

  // Apply a suggested change to the real document
  const applySuggestedChange = useCallback(
    (userDocFrom: number, userDocTo: number, text: string): string => {
      const changeId = generateId()
      
      // Calculate position in real document
      // Need to account for all previous changes
      let realFrom = userDocFrom
      let realTo = userDocTo
      
      // Check for overlapping changes and handle them
      const overlappingChanges: AppliedChange[] = []
      
      for (const prevChange of appliedChanges) {
        if (prevChange.userDocTo <= userDocFrom) {
          // Previous change is before this one
          const lengthDiff = prevChange.insertedText.length - (prevChange.userDocTo - prevChange.userDocFrom)
          realFrom += lengthDiff
          realTo += lengthDiff
        } else if (prevChange.userDocFrom < userDocTo && prevChange.userDocTo > userDocFrom) {
          // Previous change overlaps with this range
          overlappingChanges.push(prevChange)
        }
      }
      
      if (overlappingChanges.length > 0) {
        // New change replaces/covers overlapping changes
        console.log('New change replaces overlapping changes:', overlappingChanges)
        
        // Map user document range to real document range
        const replaceRealFrom = mapUserPosToRealPos(userDocFrom)
        const replaceRealTo = mapUserPosToRealPos(userDocTo)
        
        const change: AppliedChange = {
          id: changeId,
          timestamp: Date.now(),
          userDocFrom,
          userDocTo,
          userDocText: userDocument.slice(userDocFrom, userDocTo),
          insertedText: text,
          realDocFrom: replaceRealFrom,
          realDocTo: replaceRealFrom + text.length,
        }
        
        // Remove overlapping changes and add new change
        setAppliedChanges(prev => [
          ...prev.filter(c => !overlappingChanges.includes(c)),
          change
        ])
        
        // Apply to CodeMirror editor
        const callback = applyToEditorCallbackRef.current
        if (callback) {
          // Replace the range in real document
          const virtualUserDocLength = replaceRealTo - replaceRealFrom
          const replaceChange: AppliedChange = {
            ...change,
            realDocFrom: replaceRealFrom,
            userDocText: ' '.repeat(virtualUserDocLength), // dummy text with correct length for replacement
          }
          callback(replaceChange)
        }
        
        return changeId
      }
      
      // No overlap, add new change
      const change: AppliedChange = {
        id: changeId,
        timestamp: Date.now(),
        userDocFrom,
        userDocTo,
        userDocText: userDocument.slice(userDocFrom, userDocTo),
        insertedText: text,
        realDocFrom: realFrom,
        realDocTo: realFrom + text.length,
      }
      
      setAppliedChanges(prev => [...prev, change])
      
      // Apply to CodeMirror editor
      const callback = applyToEditorCallbackRef.current
      if (callback) {
        callback(change)
      }
      
      return changeId
    },
    [userDocument, appliedChanges, generateId, mapUserPosToRealPos]
  )

  // Accept a change: sync from real document to user document (update baseline)
  const acceptChange = useCallback(
    (changeId: string) => {
      const change = appliedChanges.find(c => c.id === changeId)
      if (!change) {
        console.warn(`Change ${changeId} not found`)
        return
      }
      
      console.log('Accepting change (syncing to user document):', change)
      
      // Update user document to include this change
      // This makes the change part of the baseline, so the diff disappears
      const newUserDoc =
        userDocument.slice(0, change.userDocFrom) +
        change.insertedText +
        userDocument.slice(change.userDocTo)
      
      // Update positions of other changes
      const lengthDiff = change.insertedText.length - (change.userDocTo - change.userDocFrom)
      
      setUserDocument(newUserDoc)
      
      // Remove this change from applied changes
      setAppliedChanges(prev =>
        prev
          .filter(c => c.id !== changeId)
          .map(c => {
            if (c.userDocFrom >= change.userDocTo) {
              // Adjust positions of changes after this one
              return {
                ...c,
                userDocFrom: c.userDocFrom + lengthDiff,
                userDocTo: c.userDocTo + lengthDiff,
              }
            }
            return c
          })
      )
    },
    [appliedChanges, userDocument]
  )

  // Revert a change: restore real document to match user document (undo)
  const revertChange = useCallback(
    (changeId: string) => {
      const change = appliedChanges.find(c => c.id === changeId)
      if (!change) {
        console.warn(`Change ${changeId} not found`)
        return
      }
      
      console.log('Reverting change (restoring from user document):', change)
      
      // Remove from applied changes
      setAppliedChanges(prev => prev.filter(c => c.id !== changeId))
      
      // Revert in CodeMirror editor
      const callback = revertFromEditorCallbackRef.current
      if (callback) {
        callback(change)
      }
    },
    [appliedChanges]
  )

  // Clear all changes
  const clearAllChanges = useCallback(() => {
    // Revert all changes in reverse order
    const sortedChanges = [...appliedChanges].sort((a, b) => b.realDocFrom - a.realDocFrom)
    for (const change of sortedChanges) {
      const callback = revertFromEditorCallbackRef.current
      if (callback) {
        callback(change)
      }
    }
    setAppliedChanges([])
  }, [appliedChanges])

  const getApplyToEditorCallback = useCallback(() => {
    return applyToEditorCallbackRef.current
  }, [])

  const setApplyToEditorCallback = useCallback(
    (callback: (change: AppliedChange) => void) => {
      applyToEditorCallbackRef.current = callback
    },
    []
  )

  const getRevertFromEditorCallback = useCallback(() => {
    return revertFromEditorCallbackRef.current
  }, [])

  const setRevertFromEditorCallback = useCallback(
    (callback: (change: AppliedChange) => void) => {
      revertFromEditorCallbackRef.current = callback
    },
    []
  )

  const contextValue: SuggestedChangesContextValue = {
    userDocument,
    appliedChanges,
    diffs,
    applySuggestedChange,
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
