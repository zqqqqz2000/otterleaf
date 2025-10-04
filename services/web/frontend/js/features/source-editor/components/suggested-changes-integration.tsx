import React, { useEffect, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'
import { useCodeMirrorViewContext } from './codemirror-context'
import { useSuggestedChanges } from '../../ide-react/context/suggested-changes-context'
import { setGlobalSuggestedChangesContext } from '../../ide-react/api/editor-api'
import { updateSuggestedChanges } from '../extensions/suggested-changes'

/**
 * 建议修改集成组件
 * 负责将建议修改上下文与 CodeMirror 编辑器集成
 */
export function SuggestedChangesIntegration() {
  const view = useCodeMirrorViewContext()
  const suggestedChangesContext = useSuggestedChanges()

  // 设置全局上下文引用，供 editor-api 使用
  useEffect(() => {
    setGlobalSuggestedChangesContext(suggestedChangesContext)
    
    return () => {
      setGlobalSuggestedChangesContext(null)
    }
  }, [suggestedChangesContext])

  // 同步原始文档内容
  useEffect(() => {
    if (view && view.state.doc) {
      const currentContent = view.state.doc.toString()
      if (currentContent !== suggestedChangesContext.originalDocument) {
        suggestedChangesContext.setOriginalDocument(currentContent)
      }
    }
  }, [view, suggestedChangesContext])

  // 处理接受修改
  const handleAcceptChange = useCallback((changeId: string) => {
    suggestedChangesContext.acceptChange(changeId)
  }, [suggestedChangesContext])

  // 处理拒绝修改
  const handleRejectChange = useCallback((changeId: string) => {
    suggestedChangesContext.rejectChange(changeId)
  }, [suggestedChangesContext])

  // 更新 CodeMirror 中的建议修改装饰器
  useEffect(() => {
    if (view) {
      updateSuggestedChanges(
        view,
        suggestedChangesContext.suggestedChanges,
        handleAcceptChange,
        handleRejectChange
      )
    }
  }, [view, suggestedChangesContext.suggestedChanges, handleAcceptChange, handleRejectChange])

  // 监听文档变化，同步到原始文档
  useEffect(() => {
    if (!view) return

    // 使用 MutationObserver 或定期检查来监听文档变化
    // 这是一个简化的实现，避免了动态修改 CodeMirror 配置的复杂性
    let lastContent = view.state.doc.toString()
    
    const checkForChanges = () => {
      if (!view) return
      
      const currentContent = view.state.doc.toString()
      if (currentContent !== lastContent && currentContent !== suggestedChangesContext.originalDocument) {
        lastContent = currentContent
        suggestedChangesContext.setOriginalDocument(currentContent)
      }
    }

    // 定期检查文档变化
    const interval = setInterval(checkForChanges, 100)

    return () => {
      clearInterval(interval)
    }
  }, [view, suggestedChangesContext])

  return null // 这是一个逻辑组件，不渲染任何 UI
}

export default SuggestedChangesIntegration
