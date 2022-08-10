-- CreateTable
CREATE TABLE "Enrollment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "courseCode" TEXT NOT NULL,
    "section" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "studentId" BIGINT NOT NULL,
    CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
