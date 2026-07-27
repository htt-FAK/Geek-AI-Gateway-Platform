## Context

在已有 `login-hermes-polish` 草案上收敛文案与补齐品牌图标。平台全称改为 **高科极客 AI 网关平台**；取消底栏中文「有趣的人，做有趣的事」，改用主标题的英文译句；图标经网关 Image API（`gpt-image-2`）生成后作为静态资源使用。

## Goals / Non-Goals

**Goals:**

- 进入页：宣言中文主标题 + 英文副句 + 平台名；无厂商清单；Hermes 式留白
- 图标：侧栏四项 + favicon（及必要的 apple-touch / 标）风格统一、可在暗色 UI 使用
- Key 永不入库

**Non-Goals:**

- Playground 视觉大改（仅换导航图标）
- 把真实 API Key 写入 `.env` 提交或文档正文
- 彩色插画风、拟物吉祥物

## Decisions

### D1 — 文案锁定

```text
顶栏：高科极客 AI 网关平台（Small / 可配几何标）
主标题 Display XL：有趣的人，在这里调用世界
支撑：无厂商/协议句
登录：手机号 / 密码 / 进入
底部 tertiary：
  Geek · 高科极客工作室
  Interesting people. Calling the world from here.
```

- **删除**：有趣的人，做有趣的事（进入页不再出现）
- **英文译句**（锁定）：`Interesting people. Calling the world from here.`
- 平台名：**高科极客 AI 网关平台**（非「高科极客 AI 平台」短称，除非极窄空间省略「网关」——默认写全称）

### D2 — 视觉门面

- 近纯 `--bg-base`；禁噪点/强径向光主氛围
- 少卡少线；钢青仅主按钮
- 中文不依赖 Google Noto `next/font` 拉取

### D3 — 图标生成与落盘

- 调用：`OpenAI(base_url="<GATEWAY>/v1")` → `images.generate(model="gpt-image-2", prompt=...)`
- `GATEWAY` 默认可用 `https://aigw.finloopai.ai`（或本环境 `PUBLIC_GATEWAY_BASE_URL`）；**Key 仅** `process.env.AIGW_IMAGE_API_KEY`（或一次性 shell 环境），禁止写入仓库任何文件
- Prompt 约束：monochrome line icon, steel-cyan or white on transparent/dark, Lucide-like stroke, no text, no mascot, suitable for 24px sidebar / favicon
- 产出：`web/public/icons/`（nav-*.svg 或 png）+ `web/src/app/favicon.ico`（可由 PNG 转换）
- 侧栏：用生成图标替换「调/看/模/钥」单字；AppShell 仍保持结构，仅图标皮肤

### D4 — 范围

- 进入页全文案/视觉；AppShell 图标与 favicon
- 非目标：看板/模型页插图、文档站

## Risks / Trade-offs

- [Image API 产出偏插画] → Prompt 强制线框/单色；不合格则手改 SVG 或二次生成
- [Key 泄漏] → 不写进项目；聊天中已出现的 Key 建议用户轮换
- [英文副句与中文主标题同义] → 刻意：中文刊头 + 英文签名层，非第二句中文口号

## Migration Plan

1. 更新文案与 AuthShell/EntryLogin 样式
2. 用 env Key 跑生成脚本 → 提交**仅**静态图标文件
3. 接入 AppShell + favicon
4. 回滚：还原组件与 `public/icons`

## Open Questions

- （已关闭）平台名 → **高科极客 AI 网关平台**
- （已关闭）底栏中文口号 → **删除**，改英文译句
- （已关闭）图标来源 → **gpt-image-2 经网关**，Key 不入库
