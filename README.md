# dsh-plugin-iam-deepseek

DeepSeek Harness 插件：在每次模型请求的 system 字段**最顶部**注入一段规则提示词，约束模型的思维链（chain of thought）：

1. 整条思维链**全英文**（即使对话语言是中文）；
2. 整条思维链开头的**第一个词**必须是 **I'm**；
3. 通篇**鼓励多用 I'm、少用 Let me / Let's**。

## 结构

```
dsh-IamDeepSeekV4ga/
├── package.json     # 包元数据（type: module，main: lib/index.js）
├── lib/index.js     # 插件入口：export { name, apply }
├── README.md
└── .gitignore
```

按官方插件包规范（[develop/basic](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.zh.md)）编写：ESM、`main` 指向 `lib/index.js`、导出 `name` + `apply(ctx, config)`（兼容 Cordis loader 的 `unwrapExports`，见 [adding-a-package](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)）。

## 机制

- 通过 `systemPrompt.section({ name, order, text })` 注册一个全局提示词段。
- sections 按 `order` 升序拼接：`-100` 是 harness 身份段、`0` 是人格段（见 [system-prompt 子系统文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/system-prompt.md)），因此默认 `order: -1000` 保证该段位于 system 字段最顶部。
- 数据流：`systemPrompt.assemble()` → `renderPrompt(assembly)` → `GenerateOptions.system`，即每个 agent step 请求的 system 字段。
- 注册包在 `ctx.effect(...)` 中：插件被 stop / 更新 / 卸载时自动移除注入段。

## 配置

组合行 `config` 支持：

| 字段      | 类型     | 默认值    | 说明                             |
| --------- | -------- | --------- | -------------------------------- |
| `enabled` | boolean  | `true`    | `false` 时完全禁用注入            |
| `order`   | number   | `-1000`   | 提示词段排序值（越小越靠前）      |
| `text`    | string   | 内置文本  | 自定义注入内容，覆盖默认规则文本  |

## 挂载到 Harness

### 方式一：本地路径直接挂载（无需安装）

在部署 profile 的补丁层 `C:\Users\xuezu\.dsh\profiles\web\cordis.patch.yml` 追加一行：

```yaml
- id: iam-deepseek
  name: 'file:///D:/0-code-project/dsh-IamDeepSeekV4ga/lib/index.js'
```

（loader 支持 `cordis:` 内置、相对路径（相对组合文件目录）与裸包名；跨盘符场景建议用 `file://` URL。）

### 方式二：作为依赖安装（推荐）

1. 将包加入 profile 依赖并安装：

```powershell
cd C:\Users\xuezu\.dsh\profiles\web
pnpm add "file:D:/0-code-project/dsh-IamDeepSeekV4ga"
```

2. 在 `cordis.patch.yml` 中按包名挂载：

```yaml
- id: iam-deepseek
  name: 'dsh-plugin-iam-deepseek'
```

### 生效

修改组合后需要 DSH 进程重启（或触发 full reload）才会挂载新的文件型插件。挂载成功后，**所有会话/子代理**的每次模型请求都会在 system 顶部收到该规则段。

## 验证

发送任意消息，观察模型思维链：

- 整条思维链以 **I'm** 开头；
- 全英文；
- 通篇以 "I'm" 表达为主，避免 "Let me" 开头。

## 说明

- 动态 Cordis 插件（`cordis_define`/`cordis_run`）是进程内存态、重启即失；本包是其**持久化文件版**。
- 插件进程全局生效（全局 prompt 段），与动态版行为一致。
