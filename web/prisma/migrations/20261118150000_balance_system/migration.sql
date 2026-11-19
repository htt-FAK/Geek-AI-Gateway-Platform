-- AlterTable
ALTER TABLE "User" ADD COLUMN "balanceGrantedCny" REAL NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "balanceUnlimited" BOOLEAN NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BalanceTopUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amountCny" REAL NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BalanceTopUp_userId_createdAt_idx" ON "BalanceTopUp"("userId", "createdAt");

-- 测试账号不限额
UPDATE "User" SET "balanceUnlimited" = 1 WHERE "phone" = '13800138000';
