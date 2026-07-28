## Context

产品已有暗色进入页（氛围图轮播、桌宠、GEEK 字标、直角白按钮）与钢青控制台。参考库 `Minimalist Copy/` 提供完整 `.dark` token（近黑主色、边框 framing、Geist + DM Serif Display、软圆角）。决策锁定：**A 方案**——Minimal 登录卡叠克制暗底；保留宣言文案；去掉装饰氛围与桌宠；登录后整站 Minimal 化。

## Goals / Non-Goals

**Goals:**

- 进入页与控制台共用一套 Minimal dark 语义 token。
- 保留品牌文案与「左宣言 / 右登录」桌面结构。
- 视觉从「营销门禁」收敛为「精密暗色仪表」。

**Non-Goals:**

- 不改登录 API、会话、记住密码逻辑。
- 不强制切到 light Minimal。
- 不引入新的插画/3D/粒子动效。
- 不在本 change 重做文档站。

## Decisions

1. **Token 来源**  
   以 `Minimalist Copy/colors_and_type.css` 的 `.dark` 语义层为准（`--background/#18181b` 系、`--primary` 近白、`--border` 灰阶），映射进 `web/src/app/globals.css` 现有 `--bg-*` / `--text-*` / `--accent-*` 或逐步替换为 Minimal 命名。  
   *备选*：保留钢青作 accent → 否决，与 Minimal「单主色近黑/近白」冲突。

2. **进入页结构**  
   保持桌面左右分栏；右侧登录区改为 bordered card（`border` + `radius-md` ≈ 0.75rem），字段用底边或轻边框输入，主按钮高对比填充（近白字或近白底，按 dark primary）。顶栏：GEEK 字标可保留为简标，或改为 Minimal brand-mark 方块 +「高科极客」；不加背景图层。  
   *备选*：居中单卡 → 可作为移动端回退，桌面仍左右。

3. **去氛围**  
   移除 `entry-bg*` 引用、`.entry-stars`、`EntryPet` 组件挂载；`prefers-reduced-motion` 仅保留极短入场淡入（可选）。

4. **控制台**  
   `AppShell` 侧栏/顶栏/面板/按钮/表格边框对齐 Minimal dark；选中态用 tonal fill 或左侧细条 + primary，不用钢青条。图表色取 brand 灰阶（`--chart-*`）。

5. **字体**  
   UI：Geist（已有）；强调标题（进入页宣言）：DM Serif Display（需自托管或系统 serif 回退，避免远程 Noto 依赖问题延续）。中文仍走系统/已有回退。

6. **规格演进**  
   新增 `minimal-theme`；delta 修改 `login-studio-gate` 与 `console-shell` 中与钢青/氛围冲突的要求。

## Risks / Trade-offs

- [品牌记忆断裂] → 保留宣言文案与暗色底，仅去掉插画噪音。  
- [钢青规范文档过时] → 实现后需同步或标注前端设计规范 vNext（本 change 可只改代码+openspec）。  
- [DM Serif 加载失败] → serif 栈回退到 Georgia / 系统 serif，不影响中文。  
- [大面积 class 散落] → 优先改 CSS 变量，减少逐页改色。

## Migration Plan

1. 落地 token + 进入页去氛围。  
2. AppShell / 通用组件。  
3. 逐页扫 playground / dashboard / models / keys / admin。  
4. 视觉验收后归档 specs。  
Rollback：回退该 change 的 CSS/组件提交即可，无数据迁移。

## Open Questions

- 顶栏品牌：保留矢量 **GEEK** 字标，还是改成 Minimal 方块 mark + 文案？（默认：保留 GEEK 字标，字重/间距按 Minimal 微调。）  
- 设计规范 MD 是否同 PR 更新？（默认：本 change 只保证 openspec + 代码；MD 可另开任务。）
