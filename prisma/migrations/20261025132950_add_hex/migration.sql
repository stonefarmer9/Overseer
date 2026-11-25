-- CreateTable
CREATE TABLE "Hex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "ownerId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Hex_q_r_key" ON "Hex"("q", "r");
