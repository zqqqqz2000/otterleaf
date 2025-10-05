import React, {
  createContext,
  useContext,
  useState,
  useCallback,
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
  originalDocument: string
  modifiedDocument: string
  addSuggestedChange: (from: number, to: number, text: string) => string
  acceptChange: (changeId: string) => void
  rejectChange: (changeId: string) => void
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

  // 检测两个suggested changes是否有交集
  const hasOverlap = useCallback(
    (change1: SuggestedChange, change2: SuggestedChange): boolean => {
      return !(change1.to <= change2.from || change2.to <= change1.from)
    },
    []
  )

  // 合并两个suggested changes
  const mergeChanges = useCallback(
    (
      existingChange: SuggestedChange,
      newChange: SuggestedChange
    ): SuggestedChange => {
      const mergedFrom = Math.min(existingChange.from, newChange.from)
      const mergedTo = Math.max(existingChange.to, newChange.to)

      // 获取合并后的原始文本
      const mergedOriginalText = originalDocument.slice(mergedFrom, mergedTo)

      // 构建合并后的建议文本
      let mergedSuggestedText = ''

      if (newChange.from <= existingChange.from) {
        // 新修改在左边或重叠
        mergedSuggestedText = newChange.suggestedText
        if (newChange.to < existingChange.to) {
          // 需要添加中间部分和右边部分
          const middleText = originalDocument.slice(
            newChange.to,
            existingChange.from
          )
          const rightText = existingChange.suggestedText
          mergedSuggestedText += middleText + rightText
        }
      } else {
        // 新修改在右边或重叠
        mergedSuggestedText = existingChange.suggestedText
        if (existingChange.to < newChange.from) {
          // 需要添加中间部分和右边部分
          const middleText = originalDocument.slice(
            existingChange.to,
            newChange.from
          )
          mergedSuggestedText += middleText + newChange.suggestedText
        } else {
          // 有重叠，需要处理重叠部分
          const overlapStart = Math.max(existingChange.from, newChange.from)
          const overlapEnd = Math.min(existingChange.to, newChange.to)
          const leftPart = existingChange.suggestedText.slice(
            0,
            overlapStart - existingChange.from
          )
          const rightPart = existingChange.suggestedText.slice(
            overlapEnd - existingChange.from
          )
          mergedSuggestedText = leftPart + newChange.suggestedText + rightPart
        }
      }

      return {
        ...existingChange,
        from: mergedFrom,
        to: mergedTo,
        originalText: mergedOriginalText,
        suggestedText: mergedSuggestedText,
        timestamp: Math.max(existingChange.timestamp, newChange.timestamp), // 使用较新的时间戳
      }
    },
    [originalDocument]
  )

  // 应用所有待处理的建议修改到文档
  const applyChangesToDocument = useCallback(
    (content: string, changes: SuggestedChange[]) => {
      // 按位置倒序排列，从后往前应用修改，避免位置偏移问题
      const sortedChanges = changes
        .filter(change => change.status === 'pending')
        .sort((a, b) => b.from - a.from)

      let result = content
      for (const change of sortedChanges) {
        result =
          result.slice(0, change.from) +
          change.suggestedText +
          result.slice(change.to)
      }
      return result
    },
    []
  )

  // 计算修改后的文档内容
  const modifiedDocument = applyChangesToDocument(
    originalDocument,
    suggestedChanges
  )

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

      setSuggestedChanges(prev => {
        // 查找是否有重叠的现有修改
        const overlappingChangeIndex = prev.findIndex(
          existingChange =>
            existingChange.status === 'pending' &&
            hasOverlap(existingChange, newChange)
        )

        if (overlappingChangeIndex !== -1) {
          // 找到重叠的修改，进行合并
          const existingChange = prev[overlappingChangeIndex]
          const mergedChange = mergeChanges(existingChange, newChange)

          // 替换现有的修改
          const updatedChanges = [...prev]
          updatedChanges[overlappingChangeIndex] = mergedChange
          return updatedChanges
        } else {
          // 没有重叠，添加新的修改
          return [...prev, newChange]
        }
      })

      return changeId
    },
    [originalDocument, generateId, hasOverlap, mergeChanges]
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

  // 清除所有修改
  const clearAllChanges = useCallback(() => {
    setSuggestedChanges([])
  }, [])

  const contextValue: SuggestedChangesContextValue = {
    suggestedChanges,
    originalDocument,
    modifiedDocument,
    addSuggestedChange,
    acceptChange,
    rejectChange,
    clearAllChanges,
    setOriginalDocument,
  }

  return (
    <SuggestedChangesContext.Provider value={contextValue}>
      {children}
    </SuggestedChangesContext.Provider>
  )
}
