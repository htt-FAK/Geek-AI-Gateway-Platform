> 目标：按官方 2026-08-17 峰谷价目 + 2026-08-23 周末低谷规则，对齐 DeepSeek 峰谷计费。
> 验收基线：`gateway/test_deepseek_peak.py` 全绿；真实调用冒烟核对达标。

## 1. 周末豁免（`is_peak` 工作日判断）

- [ ] 1.1 在 `gateway/deepseek_peak.py` 的 `is_peak()` 中，时间窗口判断前加入 `if local.weekday() >= 5: return False`
- [ ] 1.2 为 `is_peak` / `billable_cost` 补充中文 docstring，说明「仅工作日（周一~周五）高峰；周末低谷」
- [ ] 1.3 确认无任何调用方需改动：`billable_cost()`、`callbacks.py` 仍走 `is_peak()`，语义自动对齐
- [ ] 1.4 本地实测日期：`python3 -c "from datetime import date;print(date(2026,7,20).weekday())"` 应输出 0（周一），确保现有用例日期是工作日

## 2. 基准价更新为官方低谷价

> 两族变量（`_per_token` 与 `_per_million_cny`）必须同值；改完用 python 断言 `1e6 * token == million`。

- [ ] 2.1 `deepseek-v4-flash` 三档：入 1.5 / 出 4.5 / 缓存命中 0.05
  - [ ] 2.1.1 `input_cost_per_token: 0.0000000015` 且 `input_cost_per_million_cny: 1.5`
  - [ ] 2.1.2 `output_cost_per_token: 0.0000000045` 且 `output_cost_per_million_cny: 4.5`
  - [ ] 2.1.3 `cache_read_input_token_cost: 0.0000000005` 且 `cache_hit_cost_per_million_cny: 0.05`
- [ ] 2.2 `deepseek-v4-pro` 三档：入 4.5 / 出 13.5 / 缓存命中 0.15
  - [ ] 2.2.1 `input_cost_per_token: 0.0000000045` 且 `input_cost_per_million_cny: 4.5`
  - [ ] 2.2.2 `output_cost_per_token: 0.0000000135` 且 `output_cost_per_million_cny: 13.5`
  - [ ] 2.2.3 `cache_read_input_token_cost: 0.0000000015` 且 `cache_hit_cost_per_million_cny: 0.15`
- [ ] 2.3 断言一致性：`1e6 * input_cost_per_token == input_cost_per_million_cny`（两模型同样对 output / cache 断言）
- [ ] 2.4 复核期望值 = 官方高峰的 ½（flash 高峰 3.0/9.0/0.10；pro 高峰 9.0/27.0/0.30）

## 3. SQL 对账对齐

- [ ] 3.1 `gateway/sql/daily_spend_summary.sql`：`apply_peak_in_sql` 分支的高峰时间谓词，新增 `AND EXTRACT(ISODOW FROM r."startTime" AT TIME ZONE 'Asia/Shanghai') BETWEEN 1 AND 5`
- [ ] 3.2 `in_peak_window` 标志列加同一工作日条件，保证周末高峰窗口行统计为 false、`settled_spend_cny = base_spend`
- [ ] 3.3 在 SQL 注释中标注「与 `callbacks.py` 同语义：仅工作日高峰 ×2」，避免后续改一侧而忘另一侧

## 4. 单元测试

- [ ] 4.1 回归现有用例（`2026-07-20` 周一）：高峰窗口 09:00/11:59/14:00/17:59 → `is_peak=True`；12:00/18:00/08:59 → `False`
- [ ] 4.2 新增周末用例（`2026-07-25` 周六 / `2026-07-26` 周日）：
  - 高峰窗口时刻（周六 10:00、周日 15:00）→ `is_peak is False`
  - `billable_cost(0.01, "deepseek-v4-flash", 周六10:00) == 0.01`（不 ×2）
  - 低谷时刻（周六 20:00）→ `is_peak is False`
- [ ] 4.3 新增「非 DeepSeek 不被高峰影响」回归（沿用 `mimo-v2.5-pro` 高峰时刻 = 原值）
- [ ] 4.4 运行 `cd gateway && python3 -m pytest test_deepseek_peak.py -q` 全绿

## 5. 冒烟验证（可选，需真实 Key 与网关）

- [ ] 5.1 已知工作日高峰时刻（配合真实 `DEEPSEEK_API_KEY`）发一次调用，核对 `LiteLLM_SpendLogs`：`spend` 为官方高峰价对应值、`metadata.deepseek_peak=true`
- [ ] 5.2 周末高峰时刻发一次，核对 `metadata.deepseek_peak` 不置真、`spend` 为低谷价

## 6. 文档与工单

- [ ] 6.1 `docs/后续工单-生产就绪.md` 新增已关闭 P0 项：「DeepSeek 峰谷计费对齐（周末豁免 + 官方低谷价）WO-P0-05」，链接本变更目录
- [ ] 6.2 在工单中注明「历史 `LiteLLM_SpendLogs` 不回填，新规则仅作用于后续调用」
- [ ] 6.3 在工单「明确不做」中登记已知边界：中国法定调休/节假日补班未建模，仅周末豁免

## 验收清单（全部满足即完成）

- [ ] `is_peak()` 周末（周六/日）任意时刻均 `False`
- [ ] 工作日高峰窗口 `is_peak=True`，其余时刻 `False`，与官方 09:00-12:00 / 14:00-18:00（北京）一致
- [ ] `config.yaml` 两模型三档 = 官方低谷价，且 `_per_token × 1e6 == _per_million_cny`
- [ ] SQL `apply_peak_in_sql` 与回调同语义（含周末豁免）
- [ ] 单测全绿（含新增周末用例）
- [ ] 工单已登记关闭项 + 历史不回填 + 法定调休边界