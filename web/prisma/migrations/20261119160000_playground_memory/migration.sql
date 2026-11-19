-- 用量区分：对话 / 滚动摘要 / 长期记忆。旧行保持 null。
ALTER TABLE "SpendEvent" ADD COLUMN "kind" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "stream" BOOLEAN NOT NULL DEFAULT true,
    "thinkingStop" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "summary" TEXT NOT NULL DEFAULT '',
    "summaryThroughMessageId" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reasoningContent" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'complete',
    "seq" INTEGER NOT NULL,
    "imagePaths" TEXT NOT NULL DEFAULT '[]',
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costCny" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceConversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserMemory_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_seq_idx" ON "Message"("conversationId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_seq_key" ON "Message"("conversationId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "UserMemory_userId_contentHash_key" ON "UserMemory"("userId", "contentHash");

-- CreateIndex
CREATE INDEX "UserMemory_userId_status_idx" ON "UserMemory"("userId", "status");
