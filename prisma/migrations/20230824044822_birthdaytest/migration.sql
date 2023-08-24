/*
  Warnings:

  - Added the required column `Bday` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Bmonth` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "notifyPeers" BOOLEAN NOT NULL DEFAULT true,
    "Bmonth" INTEGER NOT NULL,
    "Bday" INTEGER NOT NULL
);
INSERT INTO "new_User" ("id", "notifyPeers", "username") SELECT "id", "notifyPeers", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
