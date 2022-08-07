-- CreateTable
CREATE TABLE "Message" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "author" BIGINT NOT NULL,
    "length" INTEGER NOT NULL,
    "channel" BIGINT NOT NULL,
    "time" DATETIME NOT NULL,
    CONSTRAINT "Message_author_fkey" FOREIGN KEY ("author") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "User" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_message__author" ON "Message"("author");
