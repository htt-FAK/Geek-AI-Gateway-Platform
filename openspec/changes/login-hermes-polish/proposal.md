## Why

当前进入页仍像通用 AI 暗色模板，且门面文案夹杂能力说明。需要以 **高科极客 AI 网关平台** 为门面，用工作室原句 **「有趣的人，在这里调用世界」** 压场；底部不再用中文副口号抢戏，改为该句的英文译写。同时补齐品牌图标（侧栏、favicon），经网关 `gpt-image-2` 生成后落盘为静态资源——API Key 仅运行时注入，**禁止写入仓库**。

## What Changes

- 重做 `/`·`/login`：Hermes 留白、少线少光、去掉厂商/协议报菜名
- 平台名锁定：**高科极客 AI 网关平台**
- 主标题锁定：**有趣的人，在这里调用世界**
- **删除**底栏中文「有趣的人，做有趣的事」；改为英文 **Interesting people. Calling the world from here.**（tertiary，≪ 主标题）
- 生成并接入图标集：侧栏（调试台/看板/模型/密钥）、浏览器 favicon / app icon；风格对齐精密仪器暗色控制台（线框几何、单色、非插画墙）
- 图标生成脚本用 OpenAI 兼容 `images.generate`（`base_url` 指向网关 `/v1`，`model=gpt-image-2`）；密钥来自环境变量，不进 `.env.example` 以外的真实值、不提交 Key
- **不做**：Playground 整页 Kimi 重做、鉴权变更、把 API Key 写入项目文件

## Capabilities

### New Capabilities

- `login-studio-gate`: 进入页门面视觉与文案（高科极客 AI 网关平台 + 中文主标题 + 英文副句）
- `brand-icon-set`: 控制台导航与站点 favicon 等品牌图标资源及接入

### Modified Capabilities

- （无已归档主规格；本 change 自包含。）

## Impact

- **前端**：`entry-login`、`AuthShell`、进入页 CSS；`AppShell` 导航改用图标资源；`app/favicon.ico` / `public/` 图标
- **工具**：一次性或可重复的生成脚本（Key 仅 env）；产物为 SVG/PNG 入库
- **安全**：用户提供的 Key 不得写入 git；若曾在聊天中暴露，建议轮换
