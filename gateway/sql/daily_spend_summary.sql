-- Daily spend rollup (LiteLLM Postgres Spend Logs)
-- Peak rule for DeepSeek (Beijing): 09:00-12:00 and 14:00-18:00 -> 2x
--
-- IMPORTANT: gateway/callbacks.py already multiplies DeepSeek spend at write
-- time when the callback is enabled. In that mode use settled_mode = 'as_stored'.
-- If you disable the callback, set settled_mode = 'apply_peak_in_sql'.

WITH params AS (
  SELECT 'as_stored'::text AS settled_mode  -- or 'apply_peak_in_sql'
),
raw AS (
  SELECT
    (("startTime" AT TIME ZONE 'Asia/Shanghai')::date) AS day_sh,
    "model" AS model,
    "api_key" AS api_key,
    spend AS base_spend,
    "prompt_tokens" AS prompt_tokens,
    "completion_tokens" AS completion_tokens,
    (("startTime" AT TIME ZONE 'Asia/Shanghai')::time) AS t_sh
  FROM "LiteLLM_SpendLogs"
  WHERE "startTime" >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date - INTERVAL '30 days'
),
priced AS (
  SELECT
    r.*,
    CASE
      WHEN p.settled_mode = 'apply_peak_in_sql'
       AND r.model ILIKE '%deepseek%'
       AND (
         (r.t_sh >= TIME '09:00' AND r.t_sh < TIME '12:00')
         OR (r.t_sh >= TIME '14:00' AND r.t_sh < TIME '18:00')
       )
      THEN r.base_spend * 2.0
      ELSE r.base_spend
    END AS settled_spend_cny,
    CASE
      WHEN r.model ILIKE '%deepseek%'
       AND (
         (r.t_sh >= TIME '09:00' AND r.t_sh < TIME '12:00')
         OR (r.t_sh >= TIME '14:00' AND r.t_sh < TIME '18:00')
       )
      THEN true
      ELSE false
    END AS in_peak_window
  FROM raw r
  CROSS JOIN params p
)
SELECT
  day_sh,
  model,
  COUNT(*) AS requests,
  SUM(prompt_tokens) AS prompt_tokens,
  SUM(completion_tokens) AS completion_tokens,
  ROUND(SUM(base_spend)::numeric, 8) AS stored_spend_cny,
  ROUND(SUM(settled_spend_cny)::numeric, 8) AS settled_spend_cny,
  SUM(CASE WHEN in_peak_window THEN 1 ELSE 0 END) AS peak_window_requests
FROM priced
GROUP BY day_sh, model
ORDER BY day_sh DESC, settled_spend_cny DESC;
