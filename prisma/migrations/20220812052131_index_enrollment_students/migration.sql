-- DropIndex
DROP INDEX "Enrollment_courseCode_term_idx";

-- CreateIndex
CREATE INDEX "Enrollment_studentId_courseCode_term_idx" ON "Enrollment"("studentId", "courseCode", "term");
