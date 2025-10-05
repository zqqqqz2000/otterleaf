// 测试建议修改功能的辅助函数
// 在浏览器控制台中运行这些函数来测试功能

window.testSuggestedChanges = {
  // 创建一个简单的建议修改
  async createTestChange() {
    console.log('Creating test suggested change...')
    try {
      const result = await window.overleafEditorApi.suggestChange(0, 5, "Hello")
      console.log('Test change created:', result)
      return result
    } catch (error) {
      console.error('Failed to create test change:', error)
    }
  },

  // 创建替换修改
  async createReplaceChange() {
    console.log('Creating replace suggested change...')
    try {
      const result = await window.overleafEditorApi.replaceText(0, 10, "New text", true)
      console.log('Replace change created:', result)
      return result
    } catch (error) {
      console.error('Failed to create replace change:', error)
    }
  },

  // 获取当前文档内容
  async getDocument() {
    console.log('Getting document...')
    try {
      const doc = await window.overleafEditorApi.getDocument(true)
      console.log('Document with changes:', doc)
      return doc
    } catch (error) {
      console.error('Failed to get document:', error)
    }
  },

  // 获取原始文档内容
  async getOriginalDocument() {
    console.log('Getting original document...')
    try {
      const doc = await window.overleafEditorApi.getDocument(false)
      console.log('Original document:', doc)
      return doc
    } catch (error) {
      console.error('Failed to get original document:', error)
    }
  },

  // 接受修改
  async acceptChange(changeId) {
    console.log('Accepting change:', changeId)
    try {
      const result = await window.overleafEditorApi.acceptChange(changeId)
      console.log('Change accepted:', result)
      return result
    } catch (error) {
      console.error('Failed to accept change:', error)
    }
  },

  // 拒绝修改
  async rejectChange(changeId) {
    console.log('Rejecting change:', changeId)
    try {
      const result = await window.overleafEditorApi.rejectChange(changeId)
      console.log('Change rejected:', result)
      return result
    } catch (error) {
      console.error('Failed to reject change:', error)
    }
  },

  // 检查 DOM 中是否有建议修改的元素
  checkDOMElements() {
    console.log('Checking DOM for suggested change elements...')
    
    const deleteElements = document.querySelectorAll('.ol-cm-suggested-change-delete')
    console.log('Delete elements found:', deleteElements.length, deleteElements)
    
    const insertElements = document.querySelectorAll('.ol-cm-suggested-insert-text')
    console.log('Insert elements found:', insertElements.length, insertElements)
    
    const widgetElements = document.querySelectorAll('.ol-cm-suggested-change-widget')
    console.log('Widget elements found:', widgetElements.length, widgetElements)
    
    const acceptButtons = document.querySelectorAll('.ol-cm-suggested-change-accept')
    console.log('Accept buttons found:', acceptButtons.length, acceptButtons)
    
    const rejectButtons = document.querySelectorAll('.ol-cm-suggested-change-reject')
    console.log('Reject buttons found:', rejectButtons.length, rejectButtons)
    
    return {
      deleteElements: deleteElements.length,
      insertElements: insertElements.length,
      widgetElements: widgetElements.length,
      acceptButtons: acceptButtons.length,
      rejectButtons: rejectButtons.length
    }
  },

  // 测试悬停功能
  testHoverFunctionality() {
    console.log('Testing hover functionality...')
    
    const hoverableElements = document.querySelectorAll('.ol-cm-suggested-change-hoverable')
    console.log('Found hoverable elements:', hoverableElements.length)
    
    if (hoverableElements.length > 0) {
      const element = hoverableElements[0]
      const changeId = element.getAttribute('data-change-id')
      console.log('Testing hover on element with change ID:', changeId)
      
      // 模拟鼠标悬停
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      
      setTimeout(() => {
        const widget = document.querySelector(`[data-widget-change-id="${changeId}"]`)
        if (widget) {
          console.log('Widget display style after hover:', widget.style.display)
          console.log('Widget hover-active attribute:', widget.getAttribute('data-hover-active'))
          
          // 测试按钮持久性 - 模拟鼠标移动到按钮上
          console.log('Testing button persistence...')
          widget.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
          
          setTimeout(() => {
            console.log('Widget display after mouseenter on button:', widget.style.display)
            
            // 模拟从原始文本移开鼠标
            element.dispatchEvent(new MouseEvent('mouseout', { 
              bubbles: true, 
              relatedTarget: widget 
            }))
            
            setTimeout(() => {
              console.log('Widget display after mouseout from text (should still be visible):', widget.style.display)
              
              // 最后从按钮移开鼠标
              widget.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
              
              setTimeout(() => {
                console.log('Widget display after mouseleave from button (should be hidden):', widget.style.display)
              }, 250)
            }, 100)
          }, 100)
        } else {
          console.log('Widget not found for change ID:', changeId)
        }
      }, 100)
    } else {
      console.log('No hoverable elements found')
    }
  },

  // 完整测试流程
  async runFullTest() {
    console.log('=== Starting full suggested changes test ===')
    
    // 1. 检查初始状态
    console.log('1. Checking initial DOM state...')
    this.checkDOMElements()
    
    // 2. 创建建议修改
    console.log('2. Creating suggested change...')
    const result = await this.createTestChange()
    
    if (result && result.success) {
      // 3. 等待一下让 DOM 更新
      setTimeout(() => {
        console.log('3. Checking DOM after creating change...')
        this.checkDOMElements()
        
        // 4. 获取文档内容
        console.log('4. Getting document content...')
        this.getDocument()
        this.getOriginalDocument()
        
        // 5. 测试悬停功能
        console.log('5. Testing hover functionality...')
        this.testHoverFunctionality()
      }, 500)
    }
    
    return result
  }
}

console.log('Test functions loaded. Use window.testSuggestedChanges to test the functionality.')
console.log('Available methods:')
console.log('- createTestChange()')
console.log('- createReplaceChange()')
console.log('- getDocument()')
console.log('- getOriginalDocument()')
console.log('- acceptChange(changeId)')
console.log('- rejectChange(changeId)')
console.log('- checkDOMElements()')
console.log('- testHoverFunctionality()')
console.log('- runFullTest()')
