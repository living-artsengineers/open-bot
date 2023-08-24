-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "notifyPeers" BOOLEAN NOT NULL DEFAULT true,
    "Bmonth" INTEGER,
    "Bday" INTEGER
);
INSERT INTO "new_User" ("Bday", "Bmonth", "id", "notifyPeers", "username") SELECT "Bday", "Bmonth", "id", "notifyPeers", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
