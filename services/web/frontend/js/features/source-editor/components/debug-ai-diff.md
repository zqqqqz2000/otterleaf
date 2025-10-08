# AI Diff 调试指南

## 问题描述

当在 test2 中开启 AI 模式后，不管怎么修改，userDocument 和 realDocument 都始终是 "test2"。

## 调试步骤

### 1. 检查当前文件状态

在浏览器控制台中运行：

```javascript
// 获取当前文件的所有状态
console.log('Current file states:', window.overleafEditorApi.getCurrentDocumentId())
```

### 2. 开启 AI 模式并观察日志

```javascript
// 开启当前文件的 AI 模式
window.overleafEditorApi.openAiDiff().then(success => {
  console.log('AI diff opened:', success)
})
```

观察控制台输出，应该看到：
- "Opening AI diff mode for file: [file-id]"
- "Setting user document baseline: [current-content]"

### 3. 修改内容并观察状态变化

在编辑器中修改内容，观察控制台输出：
- "Updating real document for file: [file-id] content: [new-content]"
- "Current file ID: [file-id]"
- "AI diff mode: true"
- "user: [baseline-content]"
- "real: [current-content]"

### 4. 检查文件状态

```javascript
// 手动检查当前文件的状态（需要在 React DevTools 中查看）
// 或者添加临时的调试代码
```

## 预期行为

1. **开启 AI 模式时**：
   - userDocument 设置为当前编辑器内容（如 "test2"）
   - realDocument 也设置为当前编辑器内容（如 "test2"）
   - isAiDiffMode 设置为 true

2. **修改内容时**：
   - userDocument 保持不变（如 "test2"）
   - realDocument 更新为新的编辑器内容（如 "test2 modified"）
   - 计算差异并显示 diff

3. **切换文件时**：
   - 每个文件保持独立的状态
   - 只有开启了 AI 模式的文件才会显示 diff

## 可能的问题

1. **文件 ID 不正确**：确保 `currentDocumentId` 正确获取
2. **状态更新不及时**：确保 `useEffect` 正确触发
3. **内容变化未检测到**：确保 `view.state.doc.toString()` 返回最新内容

## 调试命令

```javascript
// 强制刷新当前文件状态
window.location.reload()

// 检查所有文件的状态（需要在 React DevTools 中）
// 查看 SuggestedChangesProvider 的 fileAiDiffStates
```
