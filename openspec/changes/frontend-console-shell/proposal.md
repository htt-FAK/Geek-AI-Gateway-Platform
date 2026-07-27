## Why

现有 `web/` 前端已具备手机号登录、Playground 代理与 Admin 导入，但视觉与信息架构仍是草稿，未对齐《AI网关平台-前端设计规范》的「精密仪器操作台」。同时产品需要：用户侧密钥一次性揭示（供 SDK 自接）、个人用量看板（含月限额 ¥400）、以及 Admin Token 门下的全员用量分析页。现在落地壳层与看板骨架，避免功能继续堆在无壳页面上造成样式漂移。

## What Changes

- 按设计规范落地深色钢青令牌、字体与双壳层（`AuthShell` / `AppShell`）
- `/` 与 `/login` 同构进入页（左宣言 / 右登录；手机号+密码）；登录成功默认进 `/playground`
- 升级 `/playground` 为开放平台调试台（System Prompt、右参数栏、role 消息流、Token 条、查看代码）
- 新增 `/models` 模型列表
- 新增 `/keys`：单凭证面板；从未揭示可「获取 KEY」一次；之后仅「重新生成」；Dialog 警告关闭后不可再见
- **BREAKING（策略）**：覆盖交接文档「Key 不下发浏览器」——明文仅在获取/重签 API 响应中下发一次；列表与 `/api/me` 只回脱敏
- 新增 `/dashboard`：限额（日/周/**月 ¥400**）→ KPI → 双图；双图首期空态骨架
- Web 侧新增月限额闸门 ¥400（与现有日/周并列）
- 新增 `/admin/usage`：与用户看板同级双图 + 成员排行骨架；继续 `x-admin-token` 门，不进用户侧栏
- `/usage` 重定向至 `/dashboard`；未登录受保护路由重定向进入页

## Capabilities

### New Capabilities

- `console-shell`: 设计令牌、AuthShell/AppShell、进入页登录、主导航与路由守卫
- `playground-workbench`: Kimi 开放平台风格调试台（System Prompt、参数栏、Token、查看代码）
- `models-catalog`: `/models` 网关模型列表与状态行
- `api-key-reveal`: `/keys` 单凭证、一次性揭示、重新生成与脱敏展示
- `usage-dashboard`: 个人 `/dashboard`（限额含月 ¥400、KPI、双图空态）与月限额执法
- `admin-usage`: Admin Token 门下 `/admin/usage` 全员用量同级双图空态与成员排行骨架

### Modified Capabilities

- （无既有 `openspec/specs/`；本 change 全部为新能力。业务上修改既有 Key 下发策略与预算闸门行为，由上述新 spec 承载。）

## Impact

- **前端**：`web/src/app/**`、`globals.css`、新增壳层与组件；依赖可能增加 Radix、Motion、字体、Recharts（图表可先占位）
- **API**：Key 揭示/重签需返回一次明文；`keyRevealedAt`（或等价）持久化；月限额读配置并在 `assertWithinBudget` 路径执法；Admin 用量只读 API（可先返回空序列）
- **数据**：Prisma `User` 增揭示标记；预算常量/环境变量 `MONTHLY_BUDGET_CNY=400`
- **文档**：交接文档「Key 不下发」改为一次性揭示契约；视觉以设计规范 v1.7 为准
- **非目标（本期）**：Session 角色进壳、多 Key 表格、双图真实数据填充、接入文档站、SSO
