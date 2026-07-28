## Why

进入页与控制台已沉淀为「夜空氛围 + 钢青 CTA + 桌宠」的 Moonshot 式营销门禁，与产品「精密仪器 / 高科极客」身份以及 `Minimalist Copy` 的克制 Dashboard 语言冲突。现在需要在不毁掉品牌文案与暗色气质的前提下，整站切换到 Minimal `.dark` 视觉体系。

## What Changes

- 进入页（`/`、`/login`）改为：**克制暗底 + Minimal 登录卡**；保留宣言「有趣的人，在这里调用世界」与平台名「高科极客 AI 网关平台」。
- **去掉装饰性氛围**：背景轮播图、星点闪烁、桌宠动画及相关资源引用。
- 登录后 **AppShell / 调试台 / 看板 / 模型 / 密钥 / 管理页** 统一吃 Minimal dark token（近黑主色、边框对比、软圆角、Geist + DM Serif Display 强调）。
- 主 CTA / 选中态从钢青 `#3D8B9C` 迁到 Minimal dark primary（近白填充 / 近黑表面对比）；图表可用品牌灰阶或克制蓝阶，禁止紫系 SaaS 默认皮。
- Auth 行为（手机号登录、记住密码、忘记密码提示、跳转）保持不变。

## Capabilities

### New Capabilities

- `minimal-theme`: 定义 Minimal dark 设计令牌、字体配对、圆角/边框规则，以及进入页与控制台共用的视觉约束。

### Modified Capabilities

- `login-studio-gate`: 视觉门禁从 Hermes/Moonshot 氛围改为 Minimal dark 登录卡；移除钢青 CTA 与氛围层要求；保留文案与左右结构意图。
- `console-shell`: 控制台 chrome（侧栏、顶栏、面板、主按钮）改为 Minimal dark token，不再以钢青为唯一产品主色。

## Impact

- 前端：`web/src/app/globals.css`、`shell.tsx`、`entry-login.tsx`、去掉 `entry-pet`；控制台各页的 class/token 对齐。
- 资产：`public/brand/entry-bg*.jpg`、`entry-pet.png` 可保留文件但进入页不再引用；后续可清理。
- 规格：归档后的 `login-studio-gate` / `console-shell` 主规格将被 delta 更新。
- 无后端 API / 鉴权契约变更。
