/**
 * Smoke for analytics aggregation (no DB / gateway).
 * Run: node scripts/analytics-agg-smoke.mjs
 */
import assert from "node:assert/strict";

/** Mirror of bucketKey / aggregateEvents core (keep in sync with src/lib/analytics.ts). */
function shanghaiParts(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
}

function part(parts, type) {
  return parts.find((p) => p.type === type)?.value ?? "00";
}

function bucketKey(d, granularity) {
  const parts = shanghaiParts(d);
  const y = part(parts, "year");
  const m = part(parts, "month");
  const day = part(parts, "day");
  if (granularity === "day") return `${y}-${m}-${day}`;
  return `${y}-${m}-${day} ${part(parts, "hour").padStart(2, "0")}:00`;
}

function aggregateEvents(events, from, to, granularity) {
  let count = 0;
  let spendCny = 0;
  let tokens = 0;
  const spendBy = {};
  const callBy = {};
  for (const ev of events) {
    if (ev.at < from || ev.at > to) continue;
    count += 1;
    spendCny += ev.spendCny;
    tokens += ev.totalTokens;
    const key = bucketKey(ev.at, granularity);
    spendBy[key] ??= {};
    callBy[key] ??= {};
    spendBy[key][ev.model] = (spendBy[key][ev.model] ?? 0) + ev.spendCny;
    callBy[key][ev.model] = (callBy[key][ev.model] ?? 0) + 1;
  }
  const minutes = Math.max(1, (to - from) / 60_000);
  return {
    kpis: { count, spendCny, tokens, rpm: count / minutes, tpm: tokens / minutes },
    spendBy,
    callBy,
  };
}

const from = new Date("2026-07-27T00:00:00+08:00");
const to = new Date("2026-07-28T00:00:00+08:00");
const events = [
  {
    at: new Date("2026-07-27T10:15:00+08:00"),
    model: "deepseek-v3",
    spendCny: 1.5,
    totalTokens: 100,
  },
  {
    at: new Date("2026-07-27T10:45:00+08:00"),
    model: "deepseek-v3",
    spendCny: 0.5,
    totalTokens: 50,
  },
  {
    at: new Date("2026-07-27T11:00:00+08:00"),
    model: "mimo",
    spendCny: 2,
    totalTokens: 200,
  },
];

const hour = aggregateEvents(events, from, to, "hour");
assert.equal(hour.kpis.count, 3);
assert.equal(hour.kpis.spendCny, 4);
assert.equal(hour.kpis.tokens, 350);
assert.equal(hour.spendBy["2026-07-27 10:00"]["deepseek-v3"], 2);
assert.equal(hour.callBy["2026-07-27 11:00"]["mimo"], 1);

const day = aggregateEvents(events, from, to, "day");
assert.equal(day.spendBy["2026-07-27"]["deepseek-v3"], 2);
assert.equal(day.spendBy["2026-07-27"]["mimo"], 2);

console.log("analytics-agg-smoke: ok");
