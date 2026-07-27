## Context

`web/` 已有手机号 Session 登录、服务端代理聊天、Virtual Key 加密存储、日/周预算，以及 `x-admin-token` 管理页。视觉未对齐设计规范 v1.7（深色钢青、双壳层、进入页宣言、调试台工作台）。产品决策已锁定：规范路由 A（`/keys` 与 `/dashboard` 分离）、皮肤 100% 跟规范、看板区块节奏学星智通截图、KEY 一次性揭示、月限额 ¥400、管理端全员用量同级双图空态且继续 Admin Token 门。

权威视觉：`AI网关平台-前端设计规范.md`。旧交接「Key 不下发浏览器」由本设计显式覆盖。

## Goals / Non-Goals

**Goals:**

- 令牌 + AuthShell / AppShell + 进入页，建立控制台产品壳
- Playground 达到调试台形态；`/models`、`/keys`、`/dashboard`、`/admin/usage` 可用
- KEY：未揭示可获取一次；之后仅重签；Dialog 警告
- 月限额 ¥400 真执法；日/周保持现有口径
- 用户看板与管理全员用量：同级双图，首期空态骨架

**Non-Goals:**

- Session 角色进用户侧栏（下期）
- 双图真实数据填充、多 Key 表格、文档站、SSO
- 浅色主题或照搬星智通皮肤

## Decisions

### D1 — 视觉与路由跟规范 A，看板节奏跟截图

- **选择**：深色钢青；`/keys` 与 `/dashboard` 分开；Dashboard 纵向为限额 → KPI → 双图（不含密钥卡）。
- **备选**：截图合一页（Key+用量）→ 拒绝，避免与规范 IA 漂移。
- **理由**：皮肤统一；信息栈仍可学截图。

### D2 — 壳层与进入页

- **选择**：`MarketingShell`/`AuthShell`（无侧栏）用于 `/`·`/login`；`AppShell`（顶栏 52 + 侧栏 64/240）用于登录后页。`/` 与 `/login` 同构。登录字段保持**手机号+密码**（对齐现网，而非 Master Key 文案）。
- **备选**：继续无壳堆页面 → 拒绝。
- **理由**：规范 §2 / §6.0；后端已是手机号体系。

### D3 — KEY 一次性揭示

- **选择**：`User.keyRevealedAt`（nullable）。`null` → `POST /api/keys/reveal` 解密现有 Key，返回明文一次并写时间戳；已揭示 → 仅 `POST` 重签（revoke 旧 Key + 发新 Key + 返回明文 + 更新 `keyRevealedAt`）。列表/`GET` 只回 `keyMasked`（前后缀）。前端 Dialog：全文、复制、警告「关闭后无法再看」。`app_enforced` 禁止对外揭示或明确不可用于 SDK。
- **备选**：首次强制重签才可见 → 更重；永不下发 → 无法 SDK。
- **理由**：用户已确认「没错」；服务端仍加密存 Key 供 Playground 代理。

### D4 — 月限额 ¥400

- **选择**：`MONTHLY_BUDGET_CNY` 默认 `400`；在 Web `assertWithinBudget` / `getBudgetUsage` 用 `SpendEvent` 按自然月（或滚动 30 天——**采用自然月 UTC+8 日历月**）聚合；超限拒绝聊天。Dashboard 三月格均显示进度。
- **备选**：仅 UI 展示不执法 → 已否决「真做」。
- **理由**：与周限额同模式，最少碰 LiteLLM。

### D5 — 管理端继续 Admin Token

- **选择**：`/admin/users` 与 `/admin/usage` 均 `x-admin-token`；不进 AppShell 侧栏；页内可 sessionStorage 记住本标签页 Token。
- **备选**：Session 角色进壳 → 下期；更适合「常看真数据」时。
- **理由**：零 schema 角色成本；与现网一致；双图首期空态不值得先做 RBAC。

### D6 — 双图首期空态

- **选择**：用户 `/dashboard` 与 `/admin/usage` 均渲染「消耗分布」「模型调用分析」容器与切换控件，数据区「暂无数据」；API 可返回空数组。不阻塞壳层与限额/KPI 骨架。
- **理由**：用户已确认；后续接 SpendEvent / LiteLLM logs 不改布局。

### D7 — 依赖增量

- **选择**：按规范引入字体（Instrument / Geist / IBM Plex Mono + 中文回退）、Radix（Dialog/Select/Switch/Slider）、Motion（规定动效）；图表可用轻量占位（空坐标系）或 Recharts 空态，首期不接真数据。
- **备选**：继续手写无原语 → 难对齐 Dialog/焦点环。

## Risks / Trade-offs

- [明文 Key 进浏览器内存] → 仅 Dialog 持有；关闭后组件卸载；无 localStorage；HTTPS；警告文案强制
- [reveal 接口被反复打到写 revealedAt 前] → 单次事务：读锁/条件更新 `WHERE keyRevealedAt IS NULL`
- [导入用户从未见 Key] → `keyRevealedAt=null` 允许首次 reveal，不强制重签
- [Admin Token 共享无审计] → 接受本期；下期 Session 角色补审计
- [自然月 vs 滚动 30 天口径] → 文档与 UI 标明「本月」；与周「近 7 天」并存时需文案区分
- [Tailwind v3 现状 vs 规范 v4] → 可用 CSS 变量 + 现有 Tailwind 3 实现令牌，不强制升 v4 阻塞本期

## Migration Plan

1. 加 Prisma 字段 `keyRevealedAt`、预算 env；迁移现有用户为 `null`（可首次获取）
2. 部署 API（reveal / 月限额 / admin usage 空响应）后再切前端壳
3. 重签路径改为返回明文（破坏仅影响依赖旧「不返回 key」的调用方——当前 Admin UI 未展示 key，可接受）
4. 回滚：保留加密 Key；去掉 reveal 路由即可恢复「不下发」；月限额开关可用 env 极大值临时放开

## Open Questions

- （已关闭）月限额金额 → **¥400**
- （已关闭）管理鉴权本期 → **Admin Token**
- （已关闭）双图 → **空态骨架**
- 日限额展示金额是否与 LiteLLM `max_budget` 配置同源只读——实现时读现有 budget 模块即可，不另开问题
