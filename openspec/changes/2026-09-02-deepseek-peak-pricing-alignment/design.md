## Context

### 计费链路

LiteLLM 依据 `config.yaml` 里每个模型的 per-token 单价计算 `response_cost`（单位：CNY）。`gateway/callbacks.py` 的 `DeepSeekPeakPricingLogger`（自定义 `CustomLogger`）在成功事件里对 DeepSeek 模型：
1. 判断当前是否高峰（`is_peak`，北京时间）；
2. 若是，把 `kwargs["response_cost"]`（或 `standard_logging_object["response_cost"]`）乘 `PEAK_MULTIPLIER`；
3. 在 `metadata` 写入 `deepseek_peak=true`、`deepseek_peak_multiplier=2.0`、`currency=CNY`；

之后 spend 才写入 LiteLLM Postgres 的 `LiteLLM_SpendLogs`。所以默认路径下（回调启用）**入库值已含高峰乘数**，对账 SQL 用 `settled_mode='as_stored'` 直接信存入值即可。

`gateway/sql/daily_spend_summary.sql` 另提供 `settled_mode='apply_peak_in_sql'`：在 SQL 侧对 DeepSeek 且落在高峰时钟窗口的行 `base_spend * 2.0`。这两条路径的「高峰」语义**必须一致**，否则会产生“回调已乘、SQL 再乘”或“回调未乘、SQL 也不乘”的口径漂移。

### 现状代码（关键段）

`gateway/deepseek_peak.py`：

```python
SHANGHAI = ZoneInfo("Asia/Shanghai")
PEAK_MULTIPLIER = 2.0
PEAK_WINDOWS = (
    (time(9, 0), time(12, 0)),   # 09:00-12:00
    (time(14, 0), time(18, 0)),  # 14:00-18:00
)

def is_peak(moment=None) -> bool:
    local = to_shanghai(moment)
    clock = local.timetz().replace(tzinfo=None)
    for start, end in PEAK_WINDOWS:
        if start <= clock < end:
            return True
    return False
```

问题：`is_peak` 未对 `local.weekday()` 做判断。

`config.yaml` 相关配置（两个变量族必须同值）：

```yaml
# flash 示例
input_cost_per_token: 0.000001        # = 1.0 / 1e6
output_cost_per_token: 0.000002       # = 2.0 / 1e6
cache_read_input_token_cost: 0.00000002  # = 0.02 / 1e6
input_cost_per_million_cny: 1.0
cache_hit_cost_per_million_cny: 0.02
output_cost_per_million_cny: 2.0
```

## Goals / Non-Goals

### Goals

- 高峰只发生在 **工作日（周一至周五）** 的 09:00-12:00 / 14:00-18:00（北京）。周末任何时刻均不产生高峰乘数。
- `deepseek-v4-flash` / `deepseek-v4-pro` 的基准价 = **官方低谷价**（含缓存命中档），使现有 2× 乘数在高峰时精确等于官方高峰价。
- SQL 的 `apply_peak_in_sql` 模式与回调语义一致（也只在工作日高峰 ×2）。
- 测试同时锁定「工作日高峰 ×2」与「周末不 ×2」两种行为。
- 历史账单不回填；仅新产生的调用遵循新规则（作为明确约定记录在文档）。

### Non-Goals

- 不改 MiMo 系列定价，不加新模型，不做动态目录/价格同步。
- 高峰倍率不作用于非 DeepSeek 模型。
- 不做历史 `LiteLLM_SpendLogs` 的回量重算（backfill）。
- 不在本变更实现高峰/低谷标识的 UI（看板是否展示高峰档，另作变更）。
- 不建模中国法定调休工作日/节假日补班（规则仅按「周末」描述，见风险条）。

## Decisions

### 决策 1：工作日判断收口在 `is_peak()`

修改 `gateway/deepseek_peak.py`，在时间窗口判断前加一周内日期判断：

```python
import datetime as dt

def is_peak(moment=None) -> bool:
    """DeepSeek 高峰判定（北京时间）。仅工作日（周一~周五）的
    09:00-12:00 与 14:00-18:00 算高峰；周末整天按低谷价。"""
    local = to_shanghai(moment)
    if local.weekday() >= 5:   # Sat=5, Sun=6
        return False
    clock = local.timetz().replace(tzinfo=None)
    for start, end in PEAK_WINDOWS:
        if start <= clock < end:
            return True
    return False
```

- `weekday()`：周一=0 … 周日=6，故 `>=5` 即周六/日。
- `PEAK_WINDOWS`、`PEAK_MULTIPLIER=2.0`、`billable_cost()`、`to_shanghai()` **均不需改动**。
- 因为 `billable_cost()` 内部调用 `is_peak()`，回归无需改动调用方，`callbacks.py` 也自动对齐。

### 决策 2：基准价 = 官方低谷价（两个变量族同值）

两处都要改（`_per_token` 用于算细分、`_per_million_cny` 用于展示/记账，缺一不可），并保持一致。

`deepseek-v4-flash`（先旧→后新）：

```yaml
input_cost_per_token: 0.0000000015    # 1.5 / 1e6
output_cost_per_token: 0.0000000045   # 4.5 / 1e6
cache_read_input_token_cost: 0.0000000005  # 0.05 / 1e6
input_cost_per_million_cny: 1.5
cache_hit_cost_per_million_cny: 0.05
output_cost_per_million_cny: 4.5
```

`deepseek-v4-pro`：

```yaml
input_cost_per_token: 0.0000000045    # 4.5 / 1e6
output_cost_per_token: 0.0000000135   # 13.5 / 1e6
cache_read_input_token_cost: 0.0000000015  # 0.15 / 1e6
input_cost_per_million_cny: 4.5
cache_hit_cost_per_million_cny: 0.15
output_cost_per_million_cny: 13.5
```

校验期望（高峰 = 低谷 × 2）：

| 模型 | 低谷输入 | 低谷输出 | 低谷缓存命中 | 高峰输入 | 高峰输出 | 高峰缓存命中 |
|---|---|---|---|---|---|---|
| flash | 1.5 | 4.5 | 0.05 | 3.0 | 9.0 | 0.10 |
| pro | 4.5 | 13.5 | 0.15 | 9.0 | 27.0 | 0.30 |

这些值已与 DeepSeek 官方定价页（2026-08-17 版）逐一核对。

### 决策 3：SQL 回放模式与回调同语义

`gateway/sql/daily_spend_summary.sql` 的 `apply_peak_in_sql` 分支，在高峰时间谓词前增加工作日判断，仅对「工作日内高峰」乘 2：

```sql
-- 谓词新增：窗口内 且 周1-周5（ISODOW 1-5）
AND EXTRACT(ISODOW FROM r."startTime" AT TIME ZONE 'Asia/Shanghai') BETWEEN 1 AND 5
```

同样地，`in_peak_window` 标志列也加同一工作日条件，保证「周末高峰窗口的请求」统计为 `in_peak_window=false`、`settled_spend_cny` 保持 `base_spend`。

### 决策 4：测试策略与日期选型

- 现有用例日期 `2026-07-20` 恰为**周一**（已验证），其断言在加入工作日判断后仍成立，无需改日期。
- 新增用例采用 `2026-07-25`（**周六**）与 `2026-07-26`（**周日**），覆盖周末高峰窗口时间不乘 2。
- 测试直接调 `deepseek_peak.is_peak` / `billable_cost`，不依赖跑通整条 LiteLLM 链路。

### 决策 5：历史不回填

`LiteLLM_SpendLogs` 中 8-17 前的记录按旧价入账，**不回量重算**。理由：口径变更只影响之后发生的调用；既有对账/报表无需回溯改写，避免与已对过的账目产生偏差。此约定落在 `tasks.md` 与工单文档中。

### 备选方案与取舍

- **备选 A：直接把高峰值写死进 config，去乘数**——否决：高峰期随上游可能再变，保留「乘数 + 低谷基准」更易维护，且 `metadata` 里已有乘数透出便于审计。
- **备选 B：在 SQL 回放统一重算、回调归零**——否决：回调已按乘数写入是默认路径，改动更大、风险更高；保持「入库即含高峰」的单一口径更稳。
- **法定节假日取周末法**：不做补班/放假建模，仅天然区分周六日；与官方「工作日」字面规则一致，作为已知边界记录。

## Risks / Trade-offs

| 风险 | 说明 | 缓解 |
|---|---|---|
| 双路径语义漂移 | 回调已乘 + SQL 再乘，或反之 | 默认 `as_stored`；两处同源实现周末判断，并有对账冒烟 |
| 舍入漂移 | 对已舍入存值再乘，会累积 CNY 级分数差 | 小数取 8 位（SQL 已 `ROUND(…, 8)`）；推荐 `as_stored` |
| 法定调休未建模 | 补班周六会被当周末、节假日工作日当工作日 | 官方规则仅「工作日/周末」；记录为已知限制，可后续增强 |
| 变量族不一致 | `_per_token` 与 `_per_million_cny` 只改一处会账面漂移 | 变更清单两列都改并断言相等；
  新增 `assert` 用例如 `1e6 * token_cost == million_cny` |
| 缓存档漏改 | 缓存命中价格占比高，漏改会明显低估 | 三档（入/出/缓存命中）都列入改动与验收表 |

## Migration Plan

1. 改 `deepseek_peak.py` → 跑 `pytest gateway/test_deepseek_peak.py`（先回归，再加新用例）。
2. 改 `config.yaml` 两个模型各三档价格（`_per_token` + `_per_million_cny`）。
3. 改 `daily_spend_summary.sql` 的 `apply_peak_in_sql` 谓词与 `in_peak_window` 标志。
4. 冒烟：在周一高峰/低谷、周末高峰各发一次真实 DeepSeek 调用，核对 `LiteLLM_SpendLogs` 的 `spend` 与 `metadata.deepseek_peak`。
5. 在 `docs/后续工单-生产就绪.md` 追加已关闭 P0 项 + 历史不回填说明。

**回滚**：`is_peak` 的周末判断、config 价目、SQL 谓词三者必须**一起回退**（它们互相依赖，只回退一个会造成高峰口径不一致）。

## Open Questions

- 缓存命中档 `cache_read_input_token_cost` 需在运行时实测一次，确认 LiteLLM 是否把该字段计入 `response_cost`（若目前计费未含缓存命中，本次主要改入/出两档，缓存档同步更新但不强依赖）。
- 是否需要把「高峰/低谷」展示到管理端用量 UI（另开变更，本变更不实现）。