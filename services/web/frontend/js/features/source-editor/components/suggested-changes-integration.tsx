import React, { useEffect, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'
import { useCodeMirrorViewContext } from './codemirror-context'
import { useSuggestedChanges } from '../../ide-react/context/suggested-changes-context'
import { setGlobalSuggestedChangesContext } from '../../ide-react/api/editor-api'
import { updateSuggestedChanges, updateSuggestedChangesEffect } from '../extensions/suggested-changes'

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

  // 同步原始文档内容 - 只在编辑器初始化时同步
  useEffect(() => {
    if (view && view.state.doc && !suggestedChangesContext.originalDocument) {
      const currentContent = view.state.doc.toString()
      suggestedChangesContext.setOriginalDocument(currentContent)
    }
  }, [view]) // 移除 suggestedChangesContext 依赖，避免循环更新

  // 处理接受修改
  const handleAcceptChange = useCallback((changeId: string) => {
    console.log('Accepting change:', changeId)
    
    if (!view) return
    
    // 首先在合并后的修改中查找
    let change = suggestedChangesContext.mergedSuggestedChanges.find(c => c.id === changeId)
    
    if (change) {
      // 应用修改到 CodeMirror 编辑器（使用合并后的位置和内容）
      view.dispatch({
        changes: {
          from: change.from,
          to: change.to,
          insert: change.suggestedText
        }
      })
      
      // 更新原始文档内容以反映接受的修改
      const newOriginalContent = view.state.doc.toString().slice(0, change.from) + 
                                 change.suggestedText + 
                                 view.state.doc.toString().slice(change.to)
      
      // 立即移除相关修改，避免出现"幽灵"修改
      if (changeId.startsWith('merged_')) {
        const mergedPart = changeId.replace('merged_', '')
        const originalIds = mergedPart.split('_').filter(id => id && id.length > 0)
        console.log('Accepting merged change, removing original IDs:', originalIds)
        
        // 立即批量移除，不等待
        suggestedChangesContext.batchRemoveChanges(originalIds)
      } else {
        // 普通修改，直接移除
        suggestedChangesContext.acceptChange(changeId)
      }
      
      // 立即同步原始文档，确保状态一致
      setTimeout(() => {
        const finalContent = view.state.doc.toString()
        suggestedChangesContext.setOriginalDocument(finalContent)
        console.log('Original document updated after accepting change')
        
        // 强制清除所有装饰器，然后重新渲染
        view.dispatch({
          effects: updateSuggestedChangesEffect.of({
            changes: [],
            onAccept: handleAcceptChange,
            onReject: handleRejectChange
          })
        })
      }, 50) // 增加延迟确保所有状态更新完成
    } else {
      // 在原始修改中查找（备用）
      change = suggestedChangesContext.suggestedChanges.find(c => c.id === changeId)
      if (change) {
        view.dispatch({
          changes: {
            from: change.from,
            to: change.to,
            insert: change.suggestedText
          }
        })
        
        suggestedChangesContext.acceptChange(changeId)
        
        // 同步原始文档
        setTimeout(() => {
          const finalContent = view.state.doc.toString()
          suggestedChangesContext.setOriginalDocument(finalContent)
        }, 0)
      }
    }
  }, [view, suggestedChangesContext])

  // 处理拒绝修改
  const handleRejectChange = useCallback((changeId: string) => {
    console.log('Rejecting change:', changeId)
    
    // 如果是合并的修改，需要拒绝所有原始修改
    if (changeId.startsWith('merged_')) {
      const mergedPart = changeId.replace('merged_', '')
      const originalIds = mergedPart.split('_').filter(id => id && id.length > 0)
      console.log('Rejecting merged change, original IDs:', originalIds)
      
      // 批量移除所有相关的原始修改
      suggestedChangesContext.batchRemoveChanges(originalIds)
    } else {
      // 普通修改
      suggestedChangesContext.rejectChange(changeId)
    }
  }, [suggestedChangesContext])

  // 更新 CodeMirror 中的建议修改装饰器
  useEffect(() => {
    if (view) {
      updateSuggestedChanges(
        view,
        suggestedChangesContext.mergedSuggestedChanges,
        handleAcceptChange,
        handleRejectChange
      )
    }
  }, [view, suggestedChangesContext.mergedSuggestedChanges, handleAcceptChange, handleRejectChange])

  // 注意：我们移除了定期文档同步检查，因为它可能干扰建议修改系统
  // 文档变化现在通过接受修改时的手动更新来处理

  return null // 这是一个逻辑组件，不渲染任何 UI
}

export default SuggestedChangesIntegration
