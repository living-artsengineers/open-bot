import { Enrollment } from '@prisma/client'
import assert = require('assert')
import { Course, Section } from '../../soc/entities'
import { sharedClient } from '../../soc/umichApi'
import client from '../../storage'

export async function hasEnrollments (user: bigint, term: number): Promise<boolean> {
  const entry = await client.enrollment.findFirst({
    where: {
      studentId: user,
      term
    },
    select: { id: true }
  })
  return entry !== null
}

export async function enrolledIn (user: bigint, term: number, course: Course): Promise<boolean> {
  const entry = await client.enrollment.findFirst({
    where: {
      studentId: user,
      term,
      courseCode: course.toString()
    },
    select: { id: true }
  })
  return entry !== null
}

export async function getEnrollments (user: bigint, term: number): Promise<Array<[Section<true>, Course]>> {
  const rows = await client.enrollment.findMany({
    where: {
      studentId: user,
      term
    },
    select: {
      courseCode: true,
      section: true
    }
  })
  return await Promise.all(
    rows.map(async ({ courseCode, section }) => {
      const course = Course.parse(courseCode)
      assert(course !== null, `Invalid course stored in database: ${courseCode}`)
      return [await sharedClient.getSectionBySectionNumber(course, section, term), course] as [Section<true>, Course]
    })
  )
}

export async function clearEnrollment (user: bigint, term: number): Promise<void> {
  await client.enrollment.deleteMany({
    where: {
      studentId: user,
      term
    }
  })
}

export async function addEnrollment (user: bigint, term: number, course: Course, section: number): Promise<Enrollment | undefined> {
  const rowData = {
    studentId: user,
    term,
    courseCode: course.toString(),
    section
  }

  const existing = await client.enrollment.findFirst({ where: rowData })
  if (existing !== null) return
  return await client.enrollment.create({ data: rowData })
}

export async function removeEnrollment (user: bigint, term: number, course: Course, section: number): Promise<void> {
  await client.enrollment.deleteMany({
    where: {
      studentId: user,
      term,
      courseCode: course.toString(),
      section
    }
  })
}

export interface PeerInfo {
  coursemates: { [course: string]: bigint[] }
  classmates: { [course: string]: Array<{ id: bigint, section: number }> }
  alumni: { [course: string]: Array<{ id: bigint, term: number }> }
}

export async function fetchCoursemates (user: bigint, term: number): Promise<PeerInfo['coursemates']> {
  const allCoursemates: Array<{ courseCode: string, studentId: bigint }> = await client.$queryRaw`
    SELECT DISTINCT p.courseCode, p.studentId FROM Enrollment p
      WHERE p.studentId != ${user} AND p.term = ${term} AND
      EXISTS (SELECT 1 FROM Enrollment s
        WHERE s.studentId = ${user} AND p.courseCode = s.courseCode AND p.term = s.term)`

  return rollUpAsObjectOfArrays(allCoursemates.map((mate) => [mate.courseCode, mate.studentId]))
}

export async function fetchSectionPeers (user: bigint, term: number): Promise<PeerInfo['classmates']> {
  const allSectionPeers: Array<{ courseCode: string, section: number, studentId: bigint }> = await client.$queryRaw`
    SELECT DISTINCT p.courseCode, p.section, p.studentId FROM Enrollment p
      WHERE p.studentId != ${user} AND p.term = ${term} AND
      EXISTS (SELECT 1 FROM Enrollment s
      WHERE s.studentId = ${user} AND p.courseCode = s.courseCode AND p.term = s.term AND p.section = s.section)`

  return rollUpAsObjectOfArrays(
    allSectionPeers.map((mate) => [mate.courseCode, { id: mate.studentId, section: mate.section }])
  )
}

export async function fetchCourseAlumni (user: bigint, term: number): Promise<PeerInfo['alumni']> {
  const alumniList: Array<{ studentId: bigint, courseCode: string, term: number }> = await client.$queryRaw`
    SELECT DISTINCT e.studentId, e.courseCode, e.term FROM Enrollment e
    WHERE e.studentId != ${user} AND e.term < ${term} AND
      EXISTS (SELECT 1 FROM Enrollment f
        WHERE f.studentId = ${user} AND e.courseCode = f.courseCode AND f.term = ${term})`

  return rollUpAsObjectOfArrays(alumniList.map((alum) => [alum.courseCode, { id: alum.studentId, term: alum.term }]))
}

export function rollUpAsObjectOfArrays<K extends string | number | symbol, V> (items: Array<[K, V]>): Record<K, V[]> {
  const out: Partial<Record<K, V[]>> = {}
  for (const [key, value] of items) {
    out[key] ??= []
    out[key]?.push(value)
  }
  return out as Record<K, V[]>
}
