# AI Diff Mode 使用示例

## 功能说明

现在系统支持类似 Cursor 的 AI diff 模式，只有在 AI 生成建议修改时才会显示 diff 效果。

## 使用方法

### 1. 开启 AI Diff 模式

在浏览器控制台中运行：

```javascript
// 开启 AI diff 模式
window.overleafEditorApi.openAiDiff().then(success => {
  console.log('AI diff mode opened:', success)
})
```

### 2. 关闭 AI Diff 模式

在浏览器控制台中运行：

```javascript
// 关闭 AI diff 模式
window.overleafEditorApi.closeAiDiff().then(success => {
  console.log('AI diff mode closed:', success)
})
```

## 工作原理

1. **默认状态**：编辑器正常编辑，不显示任何 diff
2. **AI 模式开启**：当调用 `openAiDiff()` 后，系统开始计算用户文档和真实文档之间的差异
3. **显示差异**：只有在 AI 模式下，才会显示建议修改的视觉差异
4. **用户操作**：用户可以接受或拒绝 AI 建议的修改
5. **模式关闭**：调用 `closeAiDiff()` 后，所有 diff 装饰器被清除

## 技术实现

- **双文档架构**：用户文档（基准）vs 真实文档（当前编辑器内容）
- **条件显示**：只有在 `isAiDiffMode = true` 时才计算和显示 diff
- **全局控制**：通过 `window.overleafEditorApi` 提供全局控制接口
- **状态管理**：通过 React Context 管理 AI diff 模式状态

## 示例场景

```javascript
// 1. 用户在编辑器中输入内容，例如 "123456"
// 此时编辑器内容为 "123456"

// 2. 开启 AI 模式
await window.overleafEditorApi.openAiDiff()
// 系统会将当前内容 "123456" 设置为用户文档基准

// 3. 如果此时编辑器内容发生变化（比如 AI 修改为 "123456789"）
// 会显示 diff：删除线显示 "123456"，高亮显示 "123456789"

// 4. 用户可以点击 ✓ 接受或 ✗ 拒绝修改

// 5. 关闭 AI 模式
await window.overleafEditorApi.closeAiDiff()
// 所有 diff 装饰器被清除，编辑器恢复正常编辑模式
```

## 重要说明

- **用户文档基准**：当调用 `openAiDiff()` 时，系统会将当前编辑器内容设置为用户文档基准
- **实时更新**：在 AI 模式下，真实文档会实时更新为当前编辑器内容
- **差异计算**：只有在 AI 模式下，才会计算用户文档和真实文档之间的差异
- **模式切换**：关闭 AI 模式后，所有 diff 装饰器被清除
