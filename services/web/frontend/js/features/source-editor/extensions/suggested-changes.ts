import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view'
import { StateField, StateEffect, Extension, RangeSet } from '@codemirror/state'
import { SuggestedChange } from '../../ide-react/context/suggested-changes-context'

// 状态效果：更新建议修改
export const updateSuggestedChangesEffect = StateEffect.define<SuggestedChange[]>()

// 建议修改的装饰器状态字段
const suggestedChangesField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)
    
    for (const effect of tr.effects) {
      if (effect.is(updateSuggestedChangesEffect)) {
        decorations = buildSuggestedChangesDecorations(effect.value)
      }
    }
    
    return decorations
  },
  provide: f => EditorView.decorations.from(f)
})

// 建议插入文本组件
class SuggestedInsertWidget extends WidgetType {
  constructor(
    private text: string,
    private changeId: string
  ) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'ol-cm-suggested-insert-text'
    span.textContent = this.text
    span.setAttribute('data-change-id', this.changeId)
    return span
  }

  eq(other: SuggestedInsertWidget) {
    return this.text === other.text && this.changeId === other.changeId
  }

  ignoreEvent() {
    return false
  }
}

// 建议修改悬浮按钮组件
class SuggestedChangeWidget extends WidgetType {
  constructor(
    private change: SuggestedChange,
    private onAccept: (changeId: string) => void,
    private onReject: (changeId: string) => void
  ) {
    super()
  }

  toDOM() {
    const container = document.createElement('div')
    container.className = 'ol-cm-suggested-change-widget'
    
    const content = document.createElement('div')
    content.className = 'ol-cm-suggested-change-content'
    
    // 显示原文和建议文本
    const originalSpan = document.createElement('span')
    originalSpan.className = 'ol-cm-suggested-change-original'
    originalSpan.textContent = this.change.originalText
    
    const arrow = document.createElement('span')
    arrow.className = 'ol-cm-suggested-change-arrow'
    arrow.textContent = ' → '
    
    const suggestedSpan = document.createElement('span')
    suggestedSpan.className = 'ol-cm-suggested-change-suggested'
    suggestedSpan.textContent = this.change.suggestedText
    
    content.appendChild(originalSpan)
    content.appendChild(arrow)
    content.appendChild(suggestedSpan)
    
    // 按钮容器
    const buttons = document.createElement('div')
    buttons.className = 'ol-cm-suggested-change-buttons'
    
    const acceptBtn = document.createElement('button')
    acceptBtn.className = 'ol-cm-suggested-change-accept'
    acceptBtn.textContent = '✓'
    acceptBtn.title = '接受修改'
    acceptBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onAccept(this.change.id)
    }
    
    const rejectBtn = document.createElement('button')
    rejectBtn.className = 'ol-cm-suggested-change-reject'
    rejectBtn.textContent = '✗'
    rejectBtn.title = '拒绝修改'
    rejectBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onReject(this.change.id)
    }
    
    buttons.appendChild(acceptBtn)
    buttons.appendChild(rejectBtn)
    
    container.appendChild(content)
    container.appendChild(buttons)
    
    return container
  }

  eq(other: SuggestedChangeWidget) {
    return this.change.id === other.change.id && 
           this.change.status === other.change.status
  }

  get estimatedHeight() {
    return 40
  }

  ignoreEvent() {
    return false
  }
}

// 构建建议修改的装饰器
function buildSuggestedChangesDecorations(
  changes: SuggestedChange[],
  onAccept?: (changeId: string) => void,
  onReject?: (changeId: string) => void
): DecorationSet {
  const decorations: any[] = []
  
  for (const change of changes) {
    if (change.status !== 'pending') continue
    
    // 确保位置有效
    const from = Math.max(0, change.from)
    const to = Math.max(from, change.to)
    
    // 标记原始文本（删除样式）- 只有当有文本要删除时才添加
    if (from < to) {
      decorations.push(
        Decoration.mark({
          class: 'ol-cm-suggested-change-delete',
          attributes: {
            'data-change-id': change.id
          }
        }).range(from, to)
      )
    }
    
    // 添加建议文本
    if (change.suggestedText) {
      if (from < to) {
        // 替换情况：在删除的文本范围内显示建议文本
        decorations.push(
          Decoration.widget({
            widget: new SuggestedInsertWidget(change.suggestedText, change.id),
            side: 1
          }).range(to)
        )
      } else {
        // 纯插入情况：在指定位置插入建议文本
        decorations.push(
          Decoration.widget({
            widget: new SuggestedInsertWidget(change.suggestedText, change.id),
            side: 1
          }).range(from)
        )
      }
    }
    
    // 添加悬浮控制按钮
    if (onAccept && onReject) {
      decorations.push(
        Decoration.widget({
          widget: new SuggestedChangeWidget(change, onAccept, onReject),
          side: 1,
          block: false
        }).range(Math.max(from, to))
      )
    }
  }
  
  return RangeSet.of(decorations, true)
}

// CSS 样式主题
const suggestedChangesTheme = EditorView.baseTheme({
  '.ol-cm-suggested-change-delete': {
    textDecoration: 'line-through',
    backgroundColor: '#ffebee',
    color: '#c62828'
  },
  
  '.ol-cm-suggested-change-insert': {
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
    fontWeight: 'bold'
  },
  
  '.ol-cm-suggested-insert-text': {
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
    fontWeight: 'bold',
    padding: '1px 2px',
    borderRadius: '2px',
    border: '1px solid #c8e6c9'
  },
  
  '.ol-cm-suggested-change-widget': {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '4px 8px',
    margin: '2px',
    fontSize: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  
  '.ol-cm-suggested-change-content': {
    marginRight: '8px'
  },
  
  '.ol-cm-suggested-change-original': {
    textDecoration: 'line-through',
    color: '#c62828'
  },
  
  '.ol-cm-suggested-change-arrow': {
    color: '#666',
    fontWeight: 'bold'
  },
  
  '.ol-cm-suggested-change-suggested': {
    color: '#2e7d32',
    fontWeight: 'bold'
  },
  
  '.ol-cm-suggested-change-buttons': {
    display: 'flex',
    gap: '4px'
  },
  
  '.ol-cm-suggested-change-accept, .ol-cm-suggested-change-reject': {
    border: 'none',
    borderRadius: '2px',
    padding: '2px 6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  
  '.ol-cm-suggested-change-accept': {
    backgroundColor: '#4caf50',
    color: 'white',
    '&:hover': {
      backgroundColor: '#45a049'
    }
  },
  
  '.ol-cm-suggested-change-reject': {
    backgroundColor: '#f44336',
    color: 'white',
    '&:hover': {
      backgroundColor: '#da190b'
    }
  }
})

// 创建建议修改扩展
export function suggestedChanges(
  changes: SuggestedChange[] = [],
  onAccept?: (changeId: string) => void,
  onReject?: (changeId: string) => void
): Extension {
  return [
    suggestedChangesField.init(() => buildSuggestedChangesDecorations(changes, onAccept, onReject)),
    suggestedChangesTheme
  ]
}

// 更新建议修改的辅助函数
export function updateSuggestedChanges(
  view: EditorView,
  changes: SuggestedChange[],
  onAccept?: (changeId: string) => void,
  onReject?: (changeId: string) => void
) {
  view.dispatch({
    effects: updateSuggestedChangesEffect.of(changes)
  })
}

