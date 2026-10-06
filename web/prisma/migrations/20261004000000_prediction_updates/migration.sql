ALTER TABLE "PredictionMarket" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "amendmentJson" TEXT, ADD COLUMN "amendTxHash" TEXT;
CREATE TABLE "PersonalRanking" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "marketId" TEXT NOT NULL REFERENCES "PredictionMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fanId" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "options" INTEGER[] NOT NULL,
  "labels" TEXT[] NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PersonalRanking_marketId_fanId_size_key" ON "PersonalRanking"("marketId", "fanId", "size");
CREATE TABLE "PageView" ("id" TEXT NOT NULL PRIMARY KEY, "path" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");
