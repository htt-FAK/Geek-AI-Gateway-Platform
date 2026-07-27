# Web（手机号登录 + 控制台）

Next.js 15 App Router：预导入手机号、默认密码首登强制改密、Virtual Key、服务端代理对话，以及深色钢青控制台壳层。

## 本地

1. 复制 `.env.example` 为 `.env`，填入与 `gateway/.env` 一致的 `LITELLM_MASTER_KEY`，以及 `GATEWAY_BASE_URL`
2. `npm install`
3. `npx prisma migrate deploy`
4. 确保 LiteLLM Proxy 已在 `GATEWAY_BASE_URL` 运行
5. `npm run dev`（默认 http://localhost:3000）

## 页面

- `/` · `/login` 进入页（宣言 + 手机号登录）
- `/change-password` 强制改密
- `/playground` 调试台（System Prompt、参数栏、流式、查看代码）
- `/dashboard` 个人看板（日/周/月限额；双图首期空态）；`/usage` → 重定向至此
- `/models` 模型列表
- `/keys` 单凭证；从未揭示可「获取 KEY」一次，之后仅「重新生成」
- `/admin/users` 导入用户（`x-admin-token`）
- `/admin/usage` 全员用量空态骨架（同 Admin Token）

## 密钥策略

- 服务端仍加密保存 Virtual Key（Playground 代理使用）
- 明文仅在「获取 KEY」或「重新生成」响应中下发一次，并弹窗警告
- `/api/me` 与列表只返回脱敏 `keyMasked`

## 额度

- 日限额：LiteLLM Key `max_budget` + `budget_duration: 24h`（默认 ¥50）
- 周限额：Web 近 7 日累计（默认 ¥200）
- 月限额：Web 自然月（Asia/Shanghai）累计（默认 ¥400，`MONTHLY_BUDGET_CNY`）
- 本地 Proxy 若无 Postgres，导入写 `app_enforced` 占位 Key；不可作为外部 SDK 密钥揭示

## 服务器验收

见仓库 `scripts/` 与下方环境变量；`npm run test:server`。
