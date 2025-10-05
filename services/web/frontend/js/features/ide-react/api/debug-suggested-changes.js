// 简化的调试工具，用于测试建议修改功能
window.debugSuggestedChanges = {
  // 基本功能测试
  async testBasicFunctionality() {
    console.log('=== Testing Basic Functionality ===')
    
    try {
      // 1. 测试创建单个修改
      console.log('1. Creating single change...')
      const result = await window.overleafEditorApi.suggestChange(0, 5, "Hello")
      console.log('Result:', result)
      
      if (result && result.success) {
        // 2. 检查DOM元素
        setTimeout(() => {
          console.log('2. Checking DOM elements...')
          const elements = this.checkElements()
          console.log('Elements found:', elements)
          
          // 3. 测试获取文档
          console.log('3. Testing getDocument...')
          this.testGetDocument()
        }, 500)
      }
    } catch (error) {
      console.error('Basic functionality test failed:', error)
    }
  },

  // 检查DOM元素
  checkElements() {
    const deleteElements = document.querySelectorAll('.ol-cm-suggested-change-delete')
    const insertElements = document.querySelectorAll('.ol-cm-suggested-insert-text')
    const widgetElements = document.querySelectorAll('.ol-cm-suggested-change-widget')
    
    return {
      delete: deleteElements.length,
      insert: insertElements.length,
      widgets: widgetElements.length,
      deleteElements,
      insertElements,
      widgetElements
    }
  },

  // 测试文档获取
  async testGetDocument() {
    try {
      const docWithChanges = await window.overleafEditorApi.getDocument(true)
      const originalDoc = await window.overleafEditorApi.getDocument(false)
      
      console.log('Document with changes:', docWithChanges)
      console.log('Original document:', originalDoc)
      
      return { docWithChanges, originalDoc }
    } catch (error) {
      console.error('getDocument test failed:', error)
    }
  },

  // 清理所有修改
  clearAll() {
    // 查找所有拒绝按钮并点击
    const rejectButtons = document.querySelectorAll('.ol-cm-suggested-change-reject')
    console.log('Found reject buttons:', rejectButtons.length)
    
    rejectButtons.forEach((button, index) => {
      setTimeout(() => {
        console.log(`Clicking reject button ${index + 1}`)
        button.click()
      }, index * 100)
    })
  },

  // 测试重叠修改
  async testOverlap() {
    console.log('=== Testing Overlap ===')
    
    try {
      // 创建第一个修改
      const result1 = await window.overleafEditorApi.suggestChange(0, 5, "Hello")
      console.log('First change:', result1)
      
      if (result1 && result1.success) {
        // 创建重叠修改
        setTimeout(async () => {
          const result2 = await window.overleafEditorApi.suggestChange(3, 8, "World")
          console.log('Second change:', result2)
          
          setTimeout(() => {
            console.log('Checking merged result...')
            const elements = this.checkElements()
            console.log('Elements after merge:', elements)
          }, 500)
        }, 500)
      }
    } catch (error) {
      console.error('Overlap test failed:', error)
    }
  },

  // 获取当前状态信息
  getStatus() {
    const elements = this.checkElements()
    console.log('Current status:')
    console.log('- Delete elements:', elements.delete)
    console.log('- Insert elements:', elements.insert)
    console.log('- Widget elements:', elements.widgets)
    
    // 检查全局状态
    if (window.overleafEditorApi) {
      console.log('- Editor API available: ✓')
    } else {
      console.log('- Editor API available: ✗')
    }
    
    return elements
  },

  // 诊断"幽灵"修改问题 - 专门测试合并修改
  async diagnoseGhostChanges() {
    console.log('=== Diagnosing Ghost Changes (Merged Changes) ===')
    
    try {
      // 1. 创建两个重叠的修改来触发合并
      console.log('1. Creating first overlapping change...')
      const result1 = await window.overleafEditorApi.suggestChange(0, 5, "Hello")
      
      if (result1 && result1.success) {
        console.log('First change created:', result1.changeId)
        
        setTimeout(async () => {
          console.log('2. Creating second overlapping change...')
          const result2 = await window.overleafEditorApi.suggestChange(3, 8, "World")
          
          if (result2 && result2.success) {
            console.log('Second change created:', result2.changeId)
            
            setTimeout(() => {
              console.log('3. Checking merged elements before acceptance...')
              const beforeElements = this.checkElements()
              console.log('Before acceptance:', beforeElements)
              
              // 4. 点击接受合并修改的按钮
              const acceptButton = document.querySelector('.ol-cm-suggested-change-accept')
              if (acceptButton) {
                const changeId = acceptButton.closest('.ol-cm-suggested-change-widget')?.getAttribute('data-widget-change-id')
                console.log('4. Clicking accept button for merged change:', changeId)
                acceptButton.click()
                
                // 5. 检查接受后的状态
                setTimeout(() => {
                  console.log('5. Checking elements after accepting merged change...')
                  const afterElements = this.checkElements()
                  console.log('After acceptance:', afterElements)
                  
                  if (afterElements.widgets > 0) {
                    console.log('❌ GHOST CHANGE DETECTED IN MERGED CHANGE!')
                    console.log('Remaining widgets:', afterElements.widgetElements)
                    
                    // 检查剩余的修改内容
                    afterElements.widgetElements.forEach((widget, index) => {
                      const ghostChangeId = widget.getAttribute('data-widget-change-id')
                      const content = widget.querySelector('.ol-cm-suggested-change-content')?.textContent
                      console.log(`Ghost widget ${index + 1}:`, {
                        changeId: ghostChangeId,
                        content: content,
                        isMerged: ghostChangeId?.startsWith('merged_')
                      })
                    })
                  } else {
                    console.log('✅ No ghost changes detected in merged change')
                  }
                }, 200)
              } else {
                console.log('No accept button found for merged change')
              }
            }, 1000) // 给合并逻辑更多时间
          }
        }, 500)
      }
    } catch (error) {
      console.error('Ghost change diagnosis failed:', error)
    }
  }
}

console.log('Debug tools loaded. Available methods:')
console.log('- window.debugSuggestedChanges.testBasicFunctionality()')
console.log('- window.debugSuggestedChanges.testOverlap()')
console.log('- window.debugSuggestedChanges.getStatus()')
console.log('- window.debugSuggestedChanges.clearAll()')
console.log('- window.debugSuggestedChanges.testGetDocument()')
console.log('- window.debugSuggestedChanges.diagnoseGhostChanges()')
