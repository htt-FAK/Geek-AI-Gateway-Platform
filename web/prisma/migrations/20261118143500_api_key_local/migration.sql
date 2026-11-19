-- CreateTable
CREATE TABLE "ApiKeyLocal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "litellmToken" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "keyEnc" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKeyLocal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyLocal_litellmToken_key" ON "ApiKeyLocal"("litellmToken");

-- CreateIndex
CREATE INDEX "ApiKeyLocal_userId_idx" ON "ApiKeyLocal"("userId");
