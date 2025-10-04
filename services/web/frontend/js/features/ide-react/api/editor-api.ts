import { EditorView } from '@codemirror/view'
import { debugConsole } from '@/utils/debugging'
import { SuggestedChange } from '../context/suggested-changes-context'

// 定义API事件类型
export interface EditorApiEvents {
  'editor:getSelection': {
    requestId: string
  }
  'editor:getSelection:response': {
    requestId: string
    success: boolean
    data?: {
      from: number
      to: number
      text: string
      line: number
      column: number
    }
    error?: string
  }
  'editor:setSelection': {
    requestId: string
    from: number
    to: number
  }
  'editor:setSelection:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:replaceText': {
    requestId: string
    from: number
    to: number
    text: string
    suggestedOnly?: boolean  // 新增：是否仅创建建议修改
  }
  'editor:replaceText:response': {
    requestId: string
    success: boolean
    changeId?: string  // 新增：建议修改的ID
    error?: string
  }
  'editor:suggestChange': {
    requestId: string
    from: number
    to: number
    text: string
  }
  'editor:suggestChange:response': {
    requestId: string
    success: boolean
    changeId?: string
    error?: string
  }
  'editor:acceptChange': {
    requestId: string
    changeId: string
  }
  'editor:acceptChange:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:rejectChange': {
    requestId: string
    changeId: string
  }
  'editor:rejectChange:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:getDocument': {
    requestId: string
    includeChanges?: boolean  // 新增：是否包含建议修改
  }
  'editor:getDocument:response': {
    requestId: string
    success: boolean
    data?: {
      content: string
      originalContent?: string  // 新增：原始内容
      length: number
      suggestedChanges?: SuggestedChange[]  // 新增：建议修改列表
    }
    error?: string
  }
  'editor:recompile': {
    requestId: string
    options?: any
  }
  'editor:recompile:response': {
    requestId: string
    success: boolean
    error?: string
  }
}

// 全局编辑器视图引用
let globalEditorView: EditorView | null = null

// 全局编译上下文引用
let globalCompileContext: { startCompile: (options?: any) => void } | null = null

// 全局建议修改上下文引用
let globalSuggestedChangesContext: {
  addSuggestedChange: (from: number, to: number, text: string) => string
  acceptChange: (changeId: string) => void
  rejectChange: (changeId: string) => void
  suggestedChanges: SuggestedChange[]
  originalDocument: string
  modifiedDocument: string
} | null = null

// 设置全局编辑器视图
export function setGlobalEditorView(view: EditorView | null) {
  globalEditorView = view
}

// 设置全局编译上下文
export function setGlobalCompileContext(context: { startCompile: (options?: any) => void } | null) {
  globalCompileContext = context
}

// 设置全局建议修改上下文
export function setGlobalSuggestedChangesContext(context: {
  addSuggestedChange: (from: number, to: number, text: string) => string
  acceptChange: (changeId: string) => void
  rejectChange: (changeId: string) => void
  suggestedChanges: SuggestedChange[]
  originalDocument: string
  modifiedDocument: string
} | null) {
  globalSuggestedChangesContext = context
}

// 获取当前编辑器视图
function getEditorView(): EditorView | null {
  return globalEditorView
}

// 生成唯一请求ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 获取选中文本的位置和内容
function getSelection(): {
  from: number
  to: number
  text: string
  line: number
  column: number
} | null {
  const view = getEditorView()
  if (!view) {
    return null
  }

  const state = view.state
  const selection = state.selection.main

  if (selection.empty) {
    // 没有选中文本，返回光标位置
    const pos = selection.head
    const line = state.doc.lineAt(pos)
    return {
      from: pos,
      to: pos,
      text: '',
      line: line.number - 1, // 0-indexed
      column: pos - line.from,
    }
  }

  const from = selection.from
  const to = selection.to
  const text = state.doc.sliceString(from, to)
  const line = state.doc.lineAt(from)

  return {
    from,
    to,
    text,
    line: line.number - 1, // 0-indexed
    column: from - line.from,
  }
}

// 设置选中文本
function setSelection(from: number, to: number): boolean {
  const view = getEditorView()
  if (!view) {
    return false
  }

  try {
    const state = view.state
    const docLength = state.doc.length

    // 确保位置在文档范围内
    const clampedFrom = Math.max(0, Math.min(from, docLength))
    const clampedTo = Math.max(clampedFrom, Math.min(to, docLength))

    view.dispatch({
      selection: { anchor: clampedFrom, head: clampedTo },
    })

    return true
  } catch (error) {
    debugConsole.error('Failed to set selection:', error)
    return false
  }
}

// 替换文本（支持建议模式）
function replaceText(from: number, to: number, text: string, suggestedOnly: boolean = false): boolean | string {
  if (suggestedOnly && globalSuggestedChangesContext) {
    // 建议模式：仅创建建议修改
    try {
      const changeId = globalSuggestedChangesContext.addSuggestedChange(from, to, text)
      return changeId
    } catch (error) {
      debugConsole.error('Failed to create suggested change:', error)
      return false
    }
  }

  // 直接修改模式
  const view = getEditorView()
  if (!view) {
    return false
  }

  try {
    const state = view.state
    const docLength = state.doc.length

    // 确保位置在文档范围内
    const clampedFrom = Math.max(0, Math.min(from, docLength))
    const clampedTo = Math.max(clampedFrom, Math.min(to, docLength))

    view.dispatch({
      changes: { from: clampedFrom, to: clampedTo, insert: text },
    })

    return true
  } catch (error) {
    debugConsole.error('Failed to replace text:', error)
    return false
  }
}

// 创建建议修改
function suggestChange(from: number, to: number, text: string): string | null {
  if (!globalSuggestedChangesContext) {
    return null
  }

  try {
    return globalSuggestedChangesContext.addSuggestedChange(from, to, text)
  } catch (error) {
    debugConsole.error('Failed to create suggested change:', error)
    return null
  }
}

// 接受建议修改
function acceptChange(changeId: string): boolean {
  if (!globalSuggestedChangesContext) {
    return false
  }

  try {
    globalSuggestedChangesContext.acceptChange(changeId)
    return true
  } catch (error) {
    debugConsole.error('Failed to accept change:', error)
    return false
  }
}

// 拒绝建议修改
function rejectChange(changeId: string): boolean {
  if (!globalSuggestedChangesContext) {
    return false
  }

  try {
    globalSuggestedChangesContext.rejectChange(changeId)
    return true
  } catch (error) {
    debugConsole.error('Failed to reject change:', error)
    return false
  }
}

// 获取文档所有内容（支持包含建议修改）
function getDocument(includeChanges: boolean = true): { 
  content: string
  originalContent?: string
  length: number
  suggestedChanges?: SuggestedChange[]
} | null {
  const view = getEditorView()
  if (!view) {
    return null
  }

  const originalContent = view.state.doc.toString()
  
  if (includeChanges && globalSuggestedChangesContext) {
    // 返回包含建议修改的版本
    const modifiedContent = globalSuggestedChangesContext.modifiedDocument
    return {
      content: modifiedContent,
      originalContent,
      length: modifiedContent.length,
      suggestedChanges: globalSuggestedChangesContext.suggestedChanges
    }
  }

  // 返回原始版本
  return {
    content: originalContent,
    length: originalContent.length,
  }
}

// 处理API事件
function handleApiEvent(event: CustomEvent) {
  const { type, detail } = event

  switch (type) {
    case 'editor:getSelection': {
      const { requestId } = detail as EditorApiEvents['editor:getSelection']
      const selection = getSelection()

      const response: EditorApiEvents['editor:getSelection:response'] = {
        requestId,
        success: selection !== null,
        data: selection || undefined,
        error: selection === null ? 'Editor not available' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:getSelection:response', { detail: response })
      )
      break
    }

    case 'editor:setSelection': {
      const { requestId, from, to } = detail as EditorApiEvents['editor:setSelection']
      const success = setSelection(from, to)

      const response: EditorApiEvents['editor:setSelection:response'] = {
        requestId,
        success,
        error: success ? undefined : 'Failed to set selection',
      }

      window.dispatchEvent(
        new CustomEvent('editor:setSelection:response', { detail: response })
      )
      break
    }

    case 'editor:replaceText': {
      const { requestId, from, to, text, suggestedOnly } = detail as EditorApiEvents['editor:replaceText']
      const result = replaceText(from, to, text, suggestedOnly)

      const response: EditorApiEvents['editor:replaceText:response'] = {
        requestId,
        success: result !== false,
        changeId: typeof result === 'string' ? result : undefined,
        error: result === false ? 'Failed to replace text' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:replaceText:response', { detail: response })
      )
      break
    }

    case 'editor:suggestChange': {
      const { requestId, from, to, text } = detail as EditorApiEvents['editor:suggestChange']
      const changeId = suggestChange(from, to, text)

      const response: EditorApiEvents['editor:suggestChange:response'] = {
        requestId,
        success: changeId !== null,
        changeId: changeId || undefined,
        error: changeId === null ? 'Failed to create suggested change' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:suggestChange:response', { detail: response })
      )
      break
    }

    case 'editor:acceptChange': {
      const { requestId, changeId } = detail as EditorApiEvents['editor:acceptChange']
      const success = acceptChange(changeId)

      const response: EditorApiEvents['editor:acceptChange:response'] = {
        requestId,
        success,
        error: success ? undefined : 'Failed to accept change',
      }

      window.dispatchEvent(
        new CustomEvent('editor:acceptChange:response', { detail: response })
      )
      break
    }

    case 'editor:rejectChange': {
      const { requestId, changeId } = detail as EditorApiEvents['editor:rejectChange']
      const success = rejectChange(changeId)

      const response: EditorApiEvents['editor:rejectChange:response'] = {
        requestId,
        success,
        error: success ? undefined : 'Failed to reject change',
      }

      window.dispatchEvent(
        new CustomEvent('editor:rejectChange:response', { detail: response })
      )
      break
    }

    case 'editor:getDocument': {
      const { requestId, includeChanges } = detail as EditorApiEvents['editor:getDocument']
      const document = getDocument(includeChanges)

      const response: EditorApiEvents['editor:getDocument:response'] = {
        requestId,
        success: document !== null,
        data: document || undefined,
        error: document === null ? 'Editor not available' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:getDocument:response', { detail: response })
      )
      break
    }

    case 'editor:recompile': {
      const { requestId, options } = detail as EditorApiEvents['editor:recompile']
      
      if (!globalCompileContext) {
        const response: EditorApiEvents['editor:recompile:response'] = {
          requestId,
          success: false,
          error: 'Compile context not available',
        }
        window.dispatchEvent(
          new CustomEvent('editor:recompile:response', { detail: response })
        )
        break
      }

      try {
        // 编译时确保使用原始文档内容，不包含建议修改
        // 这里可以通过 options 传递特殊标记来指示使用原始内容
        const compileOptions = {
          ...options,
          useOriginalContent: true  // 标记使用原始内容进行编译
        }
        
        globalCompileContext.startCompile(compileOptions)
        const response: EditorApiEvents['editor:recompile:response'] = {
          requestId,
          success: true,
        }
        window.dispatchEvent(
          new CustomEvent('editor:recompile:response', { detail: response })
        )
      } catch (error) {
        const response: EditorApiEvents['editor:recompile:response'] = {
          requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        window.dispatchEvent(
          new CustomEvent('editor:recompile:response', { detail: response })
        )
      }
      break
    }

    default:
      debugConsole.warn('Unknown editor API event:', type)
  }
}

// 初始化API事件监听器
export function initializeEditorApi() {
  // 监听所有编辑器API事件
  const eventTypes: (keyof EditorApiEvents)[] = [
    'editor:getSelection',
    'editor:setSelection',
    'editor:replaceText',
    'editor:suggestChange',
    'editor:acceptChange',
    'editor:rejectChange',
    'editor:getDocument',
    'editor:recompile',
  ]

  eventTypes.forEach(eventType => {
    window.addEventListener(eventType, handleApiEvent as EventListener)
  })

  debugConsole.log('Editor API initialized')
}

// 清理API事件监听器
export function cleanupEditorApi() {
  const eventTypes: (keyof EditorApiEvents)[] = [
    'editor:getSelection',
    'editor:setSelection',
    'editor:replaceText',
    'editor:suggestChange',
    'editor:acceptChange',
    'editor:rejectChange',
    'editor:getDocument',
    'editor:recompile',
  ]

  eventTypes.forEach(eventType => {
    window.removeEventListener(eventType, handleApiEvent as EventListener)
  })

  debugConsole.log('Editor API cleaned up')
}

// 导出便捷方法供外部使用
export const editorApi = {
  // 获取选中文本
  getSelection: (): Promise<EditorApiEvents['editor:getSelection:response']['data']> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:getSelection:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:getSelection:response', handleResponse as EventListener)
          resolve(detail.data)
        }
      }

      window.addEventListener('editor:getSelection:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:getSelection', {
        detail: { requestId }
      }))
    })
  },

  // 设置选中文本
  setSelection: (from: number, to: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:setSelection:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:setSelection:response', handleResponse as EventListener)
          resolve(detail.success)
        }
      }

      window.addEventListener('editor:setSelection:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:setSelection', {
        detail: { requestId, from, to }
      }))
    })
  },

  // 替换文本
  replaceText: (from: number, to: number, text: string, suggestedOnly?: boolean): Promise<{ success: boolean; changeId?: string }> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:replaceText:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:replaceText:response', handleResponse as EventListener)
          resolve({ success: detail.success, changeId: detail.changeId })
        }
      }

      window.addEventListener('editor:replaceText:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:replaceText', {
        detail: { requestId, from, to, text, suggestedOnly }
      }))
    })
  },

  // 创建建议修改
  suggestChange: (from: number, to: number, text: string): Promise<{ success: boolean; changeId?: string }> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:suggestChange:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:suggestChange:response', handleResponse as EventListener)
          resolve({ success: detail.success, changeId: detail.changeId })
        }
      }

      window.addEventListener('editor:suggestChange:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:suggestChange', {
        detail: { requestId, from, to, text }
      }))
    })
  },

  // 接受建议修改
  acceptChange: (changeId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:acceptChange:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:acceptChange:response', handleResponse as EventListener)
          resolve(detail.success)
        }
      }

      window.addEventListener('editor:acceptChange:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:acceptChange', {
        detail: { requestId, changeId }
      }))
    })
  },

  // 拒绝建议修改
  rejectChange: (changeId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:rejectChange:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:rejectChange:response', handleResponse as EventListener)
          resolve(detail.success)
        }
      }

      window.addEventListener('editor:rejectChange:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:rejectChange', {
        detail: { requestId, changeId }
      }))
    })
  },

  // 获取文档内容
  getDocument: (includeChanges?: boolean): Promise<EditorApiEvents['editor:getDocument:response']['data']> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:getDocument:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:getDocument:response', handleResponse as EventListener)
          resolve(detail.data)
        }
      }

      window.addEventListener('editor:getDocument:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:getDocument', {
        detail: { requestId, includeChanges }
      }))
    })
  },

  // 重新编译
  recompile: (options?: any): Promise<boolean> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:recompile:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:recompile:response', handleResponse as EventListener)
          resolve(detail.success)
        }
      }

      window.addEventListener('editor:recompile:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:recompile', {
        detail: { requestId, options }
      }))
    })
  },
}

// 将API暴露到全局window对象
declare global {
  interface Window {
    overleafEditorApi: typeof editorApi
  }
}

// 在模块加载时暴露API到全局
if (typeof window !== 'undefined') {
  window.overleafEditorApi = editorApi
}
