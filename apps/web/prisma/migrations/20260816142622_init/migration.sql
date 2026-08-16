-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "radius" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "turnOrder" INTEGER NOT NULL,
    CONSTRAINT "Player_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanetMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    CONSTRAINT "PlanetMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "terrain" TEXT NOT NULL DEFAULT 'plain',
    "ownerId" TEXT,
    CONSTRAINT "Hex_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "PlanetMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Hex_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPlayerId" TEXT,
    CONSTRAINT "CampaignTurn_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignTurn_currentPlayerId_fkey" FOREIGN KEY ("currentPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turnId" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "fromHexId" TEXT,
    "toHexId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defenderId" TEXT,
    CONSTRAINT "Attack_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "CampaignTurn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attack_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attack_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_campaignId_turnOrder_key" ON "Player"("campaignId", "turnOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlanetMap_campaignId_key" ON "PlanetMap"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Hex_mapId_q_r_key" ON "Hex"("mapId", "q", "r");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTurn_campaignId_turnNumber_key" ON "CampaignTurn"("campaignId", "turnNumber");
