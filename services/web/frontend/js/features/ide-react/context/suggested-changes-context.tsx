import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'

// 建议修改的数据结构
export interface SuggestedChange {
  id: string
  from: number
  to: number
  originalText: string
  suggestedText: string
  timestamp: number
  status: 'pending' | 'accepted' | 'rejected'
}

// 上下文接口
interface SuggestedChangesContextValue {
  suggestedChanges: SuggestedChange[]
  mergedSuggestedChanges: SuggestedChange[] // 新增：合并后的建议修改
  originalDocument: string
  modifiedDocument: string
  addSuggestedChange: (from: number, to: number, text: string) => string
  acceptChange: (changeId: string) => void
  rejectChange: (changeId: string) => void
  batchRemoveChanges: (changeIds: string[]) => void // 新增：批量移除修改
  clearAllChanges: () => void
  setOriginalDocument: (content: string) => void
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
  const [suggestedChanges, setSuggestedChanges] = useState<SuggestedChange[]>(
    []
  )
  const [originalDocument, setOriginalDocument] = useState<string>('')

  // 生成唯一ID
  const generateId = useCallback(() => {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // 合并重叠的建议修改
  const mergeOverlappingChanges = useCallback(
    (changes: SuggestedChange[]): SuggestedChange[] => {
      if (changes.length <= 1) return changes

      // 按位置排序
      const sortedChanges = [...changes].sort((a, b) => a.from - b.from)
      const merged: SuggestedChange[] = []

      for (const current of sortedChanges) {
        if (merged.length === 0) {
          merged.push(current)
          continue
        }

        const last = merged[merged.length - 1]

        // 检查是否重叠 (current.from <= last.to)
        if (current.from <= last.to) {
          // 合并重叠的修改
          const mergedFrom = Math.min(last.from, current.from)
          const mergedTo = Math.max(last.to, current.to)

          // 获取原始文本范围
          const originalText = originalDocument.slice(mergedFrom, mergedTo)

          // 合并建议文本 - 这里可以根据需要调整合并策略
          let mergedSuggestedText: string
          if (last.from === current.from && last.to === current.to) {
            // 完全重叠，使用最新的建议
            mergedSuggestedText = current.suggestedText
          } else if (current.from >= last.from && current.to <= last.to) {
            // current 完全包含在 last 中，使用 last 的建议
            mergedSuggestedText = last.suggestedText
          } else if (last.from >= current.from && last.to <= current.to) {
            // last 完全包含在 current 中，使用 current 的建议
            mergedSuggestedText = current.suggestedText
          } else {
            // 部分重叠，需要智能合并
            const beforeOverlap = originalDocument.slice(
              mergedFrom,
              Math.min(last.from, current.from)
            )
            const afterOverlap = originalDocument.slice(
              Math.max(last.to, current.to),
              mergedTo
            )

            // 简单策略：使用较新的建议文本
            mergedSuggestedText =
              beforeOverlap + current.suggestedText + afterOverlap
          }

          // 创建合并后的修改
          const mergedChange: SuggestedChange = {
            id: `merged_${last.id}_${current.id}`,
            from: mergedFrom,
            to: mergedTo,
            originalText,
            suggestedText: mergedSuggestedText,
            timestamp: Math.max(last.timestamp, current.timestamp),
            status: 'pending',
          }

          // 替换最后一个修改
          merged[merged.length - 1] = mergedChange
        } else {
          // 没有重叠，直接添加
          merged.push(current)
        }
      }

      return merged
    },
    [originalDocument]
  )

  // 获取合并后的建议修改列表
  const mergedSuggestedChanges = useMemo(() => {
    const pendingChanges = suggestedChanges.filter(
      change => change.status === 'pending'
    )
    console.log(
      'Merging changes:',
      pendingChanges.map(c => ({ id: c.id, from: c.from, to: c.to }))
    )

    const merged = mergeOverlappingChanges(pendingChanges)
    console.log(
      'Merged result:',
      merged.map(c => ({ id: c.id, from: c.from, to: c.to }))
    )

    return merged
  }, [suggestedChanges, mergeOverlappingChanges])

  // 计算修改后的文档内容 - 使用原始的建议修改，不使用合并后的
  const modifiedDocument = useMemo(() => {
    const pendingChanges = suggestedChanges.filter(
      change => change.status === 'pending'
    )
    // 按位置倒序排列，从后往前应用修改，避免位置偏移问题
    const sortedChanges = pendingChanges.sort((a, b) => b.from - a.from)

    let result = originalDocument
    for (const change of sortedChanges) {
      result =
        result.slice(0, change.from) +
        change.suggestedText +
        result.slice(change.to)
    }
    return result
  }, [originalDocument, suggestedChanges])

  // 添加建议修改
  const addSuggestedChange = useCallback(
    (from: number, to: number, text: string): string => {
      const originalText = originalDocument.slice(from, to)
      const changeId = generateId()

      const newChange: SuggestedChange = {
        id: changeId,
        from,
        to,
        originalText,
        suggestedText: text,
        timestamp: Date.now(),
        status: 'pending',
      }

      setSuggestedChanges(prev => [...prev, newChange])
      return changeId
    },
    [originalDocument, generateId]
  )

  // 接受修改
  const acceptChange = useCallback((changeId: string) => {
    setSuggestedChanges(prev => {
      const change = prev.find(c => c.id === changeId)
      if (!change) return prev

      // 移除已接受的修改，并调整其他修改的位置
      const lengthDiff = change.suggestedText.length - (change.to - change.from)

      return prev
        .filter(c => c.id !== changeId)
        .map(c => {
          if (c.from > change.to) {
            return {
              ...c,
              from: c.from + lengthDiff,
              to: c.to + lengthDiff,
            }
          }
          return c
        })
    })
  }, [])

  // 拒绝修改
  const rejectChange = useCallback((changeId: string) => {
    setSuggestedChanges(prev => prev.filter(c => c.id !== changeId))
  }, [])

  // 批量移除修改
  const batchRemoveChanges = useCallback((changeIds: string[]) => {
    console.log('Batch removing changes:', changeIds)
    setSuggestedChanges(prev => {
      const filtered = prev.filter(c => !changeIds.includes(c.id))
      console.log(
        'Remaining changes after batch removal:',
        filtered.map(c => c.id)
      )
      return filtered
    })
  }, [])

  // 清除所有修改
  const clearAllChanges = useCallback(() => {
    setSuggestedChanges([])
  }, [])

  const contextValue: SuggestedChangesContextValue = {
    suggestedChanges,
    mergedSuggestedChanges,
    originalDocument,
    modifiedDocument,
    addSuggestedChange,
    acceptChange,
    rejectChange,
    batchRemoveChanges,
    clearAllChanges,
    setOriginalDocument,
  }

  return (
    <SuggestedChangesContext.Provider value={contextValue}>
      {children}
    </SuggestedChangesContext.Provider>
  )
}
