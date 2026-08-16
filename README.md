# dsh-plugin-IamDeepseekV4ga

一个基于 **玄学** 的让 deepseek 思维链模仿灰测神必模型的 [deepseek harness 预览版](https://github.com/deepseek-ai/deepseek-harness) 的娱乐插件

### 机制

在每次模型请求（每轮对话 / 每个 agent step）的 system 字段最顶部注入一段固定的规则块，约束模型的思维链（chain of thought）：

```markdown
You are a helpful software engineer assistant. **When you thought, use English and start with `We need` or `I'm`**.
```
## 安装

1. 安装 `pnpm`
2. 运行
```powershell
npx @deepseek-ai/dsh plugin --profile web add github:XuezuoYS/dsh-IamDeepSeekV4ga
```

## 使用注意

目前，经过多轮测试，使用此插件会出现以下神必情况：

### 抽卡触发

- 对于 Deepseek V4 Pro 模型，在部分时间段有少半数情况可完全让思维链出现另一种更高效的形态，但多数时间仅能实现让 I'm 替换掉**部分** Let me 的纯图一乐效果。
- 对于 Deepseek V4 Flash，几乎没有触发过让思维链出现更高效的形态的情况，仅实现部分文本替换（还换不全）的情况。

### 性能下降

- 测试中部分场景会随机导致模型性能下降（但也可能是 Deepseek 服务器那边的问题），依旧抽卡。

### 破甲问题

- 在测试中，当思维链在 Deepseek V4 Pro 下被抽卡到完全变更的版本时，较大概率出现 D 小姐的 ~心之壁~ 自带甲变厚，导致破甲词完全失效、拒绝执行的情况。
- 在测试中，当 Deepseek V4 Flash 的思维链被有效影响的时候，出现了模型自主绕开破甲词所允许范围的情况。