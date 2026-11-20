import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packContext, messagesToSummarize, MEMORY_BLOCK_LEAD, SUMMARY_BLOCK_LEAD } from "./context-pack.ts";
import {
  applyMemoryOps,
  diffRemovedRows,
  isRejectedMemory,
  memoryHash,
  parseMemoryOps,
  redactSecrets,
} from "./memory-policy.ts";
import {
  conversationTitleFrom,
  decideAssistantRecord,
  ownedConversationWhere,
  selectOwnedConversation,
  truncateMessage,
} from "./conversation-policy.ts";
import { resolveUploadPath } from "./playground-files.ts";

describe("conversation isolation", () => {
  it("looks up a conversation only when both id and user match", () => {
    const where = ownedConversationWhere("user-a", "conv-1");
    assert.deepEqual(where, { id: "conv-1", userId: "user-a" });
    const rows = [
      { id: "conv-1", userId: "user-b", title: "别人的" },
      { id: "conv-1", userId: "user-a", title: "我的" },
    ];
    assert.equal(selectOwnedConversation(rows, "user-a", "conv-1")?.title, "我的");
    assert.equal(selectOwnedConversation(rows, "user-b", "conv-1")?.title, "别人的");
    assert.equal(selectOwnedConversation(rows, "user-a", "missing"), null);
  });
});

describe("context pack", () => {
  const history = [
    { id: "u1", role: "user" as const, content: "U1" },
    { id: "a1", role: "assistant" as const, content: "A1" },
    { id: "u2", role: "user" as const, content: "U2", images: ["data:old"] },
    { id: "a2", role: "assistant" as const, content: "A2" },
    { id: "u3", role: "user" as const, content: "U3" },
    { id: "a3", role: "assistant" as const, content: "A3" },
    { id: "u4", role: "user" as const, content: "U4" },
    { id: "a4", role: "assistant" as const, content: "A4" },
    { id: "u5", role: "user" as const, content: "U5", images: ["data:new"] },
  ];

  it("orders system, memory, summary, gap, then the recent window", () => {
    const packed = packContext({
      systemPrompt: "你是助手",
      memories: ["喜欢中文"],
      summary: "早期摘要",
      summaryThroughMessageId: "u1",
      messages: history,
    });
    const text = packed.messages.map((message) =>
      typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    );
    assert.equal(text[0], "你是助手");
    assert.ok(text[1].startsWith(MEMORY_BLOCK_LEAD));
    assert.ok(text[1].includes("喜欢中文"));
    assert.ok(text[2].startsWith(SUMMARY_BLOCK_LEAD));
    assert.ok(text[2].includes("早期摘要"));
    assert.equal(text[3], "A1");
    assert.equal(text[4], "U2");
    assert.equal(text.at(-1)?.includes("data:new"), true);
    assert.equal(text.join("\n").includes("U1"), false);
    assert.equal(text.join("\n").includes("data:old"), false);
    assert.equal(packed.summarized, true);
    assert.deepEqual(
      messagesToSummarize(history, "u1").map((message) => message.id),
      ["a1", "u2"],
    );
  });

  it("drops an oversized older turn and keeps the latest user message", () => {
    const huge = "巨".repeat(13_000);
    const packed = packContext({
      systemPrompt: "",
      memories: [],
      summary: "",
      summaryThroughMessageId: null,
      messages: [
        { id: "old", role: "user", content: huge },
        { id: "mid", role: "assistant", content: "中间" },
        { id: "new", role: "user", content: "最新问题" },
      ],
    });
    const flat = JSON.stringify(packed.messages);
    assert.equal(flat.includes("最新问题"), true);
    assert.equal(flat.includes(huge), false);
  });
});

describe("long-term memory", () => {
  it("rejects secrets and keeps an ordinary preference", () => {
    assert.equal(isRejectedMemory("密码是 hunter2"), true);
    assert.equal(isRejectedMemory("验证码 998877"), true);
    assert.equal(isRejectedMemory("密钥 sk-abcdef123456"), true);
    assert.equal(isRejectedMemory("用户希望用中文回答"), false);
    const next = applyMemoryOps(
      [],
      [
        { op: "add", content: "用户希望用中文回答" },
        { op: "add", content: "密码是 hunter2" },
        { op: "add", content: "验证码 998877" },
        { op: "add", content: "我的 API Key 是 sk-abcdef123456" },
        { op: "add", content: "用户希望用中文回答" },
      ],
      1,
    );
    assert.deepEqual(
      next.map((item) => item.content),
      ["用户希望用中文回答"],
    );
  });

  it("drops the oldest fact once the cap is exceeded", () => {
    const ops = Array.from({ length: 41 }, (_, index) => ({
      op: "add" as const,
      content: `偏好编号${index}`,
    }));
    const next = applyMemoryOps([], ops, 1);
    assert.equal(next.length, 40);
    assert.equal(next.some((item) => item.content === "偏好编号0"), false);
    assert.equal(next.some((item) => item.content === "偏好编号40"), true);
  });

  it("evicts only rows explicitly removed by ops, never the whole table", () => {
    const item = (id: string, content: string, createdAt: number) => ({
      id,
      content,
      hash: memoryHash(content),
      createdAt,
      updatedAt: createdAt,
    });
    const current = [item("m1", "叫小张", 1), item("m2", "喜欢中文", 2)];
    // drop 只命中匹配行，无关行不进淘汰集
    const next = applyMemoryOps(current, [{ op: "drop", match: "叫小张" }], 10);
    const removed = diffRemovedRows(current, next);
    assert.deepEqual(removed.map((r) => r.id), ["m1"]);
    assert.equal(removed[0].updatedAt, 1); // 携带快照时间戳，供写入侧 CAS
    // 空 ops / 纯 add 不产生淘汰；另一会话新写的行不在快照里，天然不受影响
    const added = applyMemoryOps(current, [{ op: "add", content: "在做网关项目" }], 10);
    assert.deepEqual(diffRemovedRows(current, added), []);
    assert.deepEqual(diffRemovedRows(current, applyMemoryOps(current, [], 10)), []);
    // update 保留原 id，不算移除
    const updated = applyMemoryOps(
      current,
      [{ op: "update", match: "喜欢中文", content: "喜欢中文回答" }],
      10,
    );
    assert.deepEqual(diffRemovedRows(current, updated), []);
  });

  it("cap trimming yields explicit removed ids for existing rows", () => {
    const current = Array.from({ length: 40 }, (_, i) => ({
      id: `m${i}`,
      content: `偏好编号${i}`,
      hash: memoryHash(`偏好编号${i}`),
      createdAt: i + 1,
      updatedAt: i + 1,
    }));
    const next = applyMemoryOps(current, [{ op: "add", content: "新偏好" }], 100);
    assert.equal(next.length, 40);
    const removed = diffRemovedRows(current, next);
    assert.deepEqual(removed.map((r) => r.id), ["m0"]); // 只明确移除最旧一条
  });

  it("parses a fenced JSON payload and redacts keys in summaries", () => {
    const ops = parseMemoryOps('说明\n```json\n{"ops":[{"op":"add","content":"叫小张"}]}\n```');
    assert.deepEqual(ops, [{ op: "add", content: "叫小张" }]);
    assert.equal(redactSecrets("记下 sk-abcdef123456 备用").includes("sk-"), false);
    assert.equal(memoryHash("  叫小张  "), memoryHash("叫小张"));
  });

  it("redacts passwords and verification codes from summaries", () => {
    const text = redactSecrets(
      "用户密码是 hunter2，验证码 998877，API Key 是 sk-abcdef123456；普通偏好保留。",
    );
    assert.equal(text.includes("hunter2"), false);
    assert.equal(text.includes("998877"), false);
    assert.equal(text.includes("sk-abcdef"), false);
    assert.ok(text.includes("普通偏好保留"));
  });
});

describe("assistant persistence", () => {
  it("stores a stopped reply, including an empty partial", () => {
    const partial = decideAssistantRecord({ aborted: true, failed: false, content: "半段" });
    assert.equal(partial.shouldPersist, true);
    assert.equal(partial.status, "aborted");
    assert.equal(partial.content, "半段");
    const empty = decideAssistantRecord({ aborted: true, failed: false, content: "" });
    assert.equal(empty.shouldPersist, true);
    assert.equal(empty.status, "aborted");
    const failed = decideAssistantRecord({ aborted: false, failed: true, content: "网关调用失败" });
    assert.equal(failed.status, "error");
  });
});

describe("message limits and upload paths", () => {
  it("truncates a pasted message and titles from the first 20 characters", () => {
    const long = "字".repeat(MAX_SAFE);
    const cut = truncateMessage(long);
    assert.equal(cut.truncated, true);
    assert.ok(cut.text.startsWith("字".repeat(16_000)));
    assert.ok(cut.text.endsWith("[内容过长，已截断]"));
    assert.equal(conversationTitleFrom(`  ${"标题".repeat(20)}\n第二行`), "标题".repeat(10));
  });

  it("refuses paths that leave the upload root", () => {
    const root = "C:\\data\\uploads";
    assert.equal(resolveUploadPath(root, "../etc/passwd"), null);
    assert.equal(resolveUploadPath(root, "/etc/passwd"), null);
    const kept = resolveUploadPath(root, "user/conv/0.png");
    assert.ok(kept);
    assert.equal(kept?.toLowerCase().endsWith("user\\conv\\0.png") || kept?.endsWith("user/conv/0.png"), true);
  });
});

const MAX_SAFE = 16_001;
