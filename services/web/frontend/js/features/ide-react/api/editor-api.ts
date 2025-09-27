import { EditorView } from '@codemirror/view'
import { debugConsole } from '@/utils/debugging'

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
  }
  'editor:replaceText:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:getDocument': {
    requestId: string
  }
  'editor:getDocument:response': {
    requestId: string
    success: boolean
    data?: {
      content: string
      length: number
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

// 设置全局编辑器视图
export function setGlobalEditorView(view: EditorView | null) {
  globalEditorView = view
}

// 设置全局编译上下文
export function setGlobalCompileContext(context: { startCompile: (options?: any) => void } | null) {
  globalCompileContext = context
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

// 替换文本
function replaceText(from: number, to: number, text: string): boolean {
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

// 获取文档所有内容
function getDocument(): { content: string; length: number } | null {
  const view = getEditorView()
  if (!view) {
    return null
  }

  const content = view.state.doc.toString()
  return {
    content,
    length: content.length,
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
      const { requestId, from, to, text } = detail as EditorApiEvents['editor:replaceText']
      const success = replaceText(from, to, text)

      const response: EditorApiEvents['editor:replaceText:response'] = {
        requestId,
        success,
        error: success ? undefined : 'Failed to replace text',
      }

      window.dispatchEvent(
        new CustomEvent('editor:replaceText:response', { detail: response })
      )
      break
    }

    case 'editor:getDocument': {
      const { requestId } = detail as EditorApiEvents['editor:getDocument']
      const document = getDocument()

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
        globalCompileContext.startCompile(options)
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
  replaceText: (from: number, to: number, text: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as { detail: EditorApiEvents['editor:replaceText:response'] }
        if (detail.requestId === requestId) {
          window.removeEventListener('editor:replaceText:response', handleResponse as EventListener)
          resolve(detail.success)
        }
      }

      window.addEventListener('editor:replaceText:response', handleResponse as EventListener)
      window.dispatchEvent(new CustomEvent('editor:replaceText', {
        detail: { requestId, from, to, text }
      }))
    })
  },

  // 获取文档内容
  getDocument: (): Promise<EditorApiEvents['editor:getDocument:response']['data']> => {
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
        detail: { requestId }
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
