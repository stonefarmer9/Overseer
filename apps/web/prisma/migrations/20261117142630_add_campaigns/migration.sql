/*
  Warnings:

  - Added the required column `campaignId` to the `Hex` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    CONSTRAINT "Player_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Hex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "campaignId" TEXT NOT NULL,
    "ownerId" TEXT,
    CONSTRAINT "Hex_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Hex_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Hex" ("id", "ownerId", "q", "r") SELECT "id", "ownerId", "q", "r" FROM "Hex";
DROP TABLE "Hex";
ALTER TABLE "new_Hex" RENAME TO "Hex";
CREATE UNIQUE INDEX "Hex_campaignId_q_r_key" ON "Hex"("campaignId", "q", "r");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Player_campaignId_role_key" ON "Player"("campaignId", "role");
