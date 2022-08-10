import { Duration } from "luxon";
import { expect, test } from "vitest";
import { EnrollmentStatus, Section, SectionType, Weekday } from "./entities";
import { parseSection, SectionJson } from "./umichApi";

test("Parse Sections response", () => {
  const chem126Section: SectionJson = {
    SectionNumber: 300,
    SectionType: <SectionType>"LEC",
    SessionDescr: "Regular",
    InstructionMode: "In Person",
    EnrollmentStatus: "Closed",
    EnrollmentTotal: 0,
    EnrollmentCapacity: 0,
    AvailableSeats: 0,
    WaitTotal: 0,
    WaitCapacity: 0,
    CreditHours: 1,
    ClassNumber: 17132,
    Meeting: {
      MeetingNumber: 1,
      Days: "TBA",
      Times: "TBA",
      ClassMtgTopic: "TBA",
      Instructors: "Staff",
    },
  };
  expect(parseSection(chem126Section)).toEqual(<Section>{
    number: 300,
    type: SectionType.LEC,
    enrollStatus: EnrollmentStatus.Closed,
    enrolled: 0,
    capacity: 0,
    seatsAvailable: 0,
    credits: 1,
    classNumber: 17132,
    meetings: [],
    instructors: [],
  });

  const ners250Section: SectionJson = {
    SectionNumber: "001",
    SectionType: <SectionType>"LEC",
    SessionDescr: "Regular",
    InstructionMode: "In Person",
    EnrollmentStatus: "Open",
    EnrollmentTotal: 19,
    EnrollmentCapacity: 32,
    AvailableSeats: 13,
    WaitTotal: 0,
    WaitCapacity: 0,
    CreditHours: 4,
    ClassNumber: 16409,
    Meeting: [
      {
        MeetingNumber: 1,
        Days: "MoWe",
        Times: "10:30AM - 11:30AM",
        ClassMtgTopic: "TBA",
        Instructors: "Allen,Todd Randall ; Gui,Yifan ; Myers,Patrick Andrew",
      },
      {
        MeetingNumber: 3,
        Days: "Fr",
        Times: "9:30AM - 11:30AM",
        ClassMtgTopic: "TBA",
        Instructors: "Allen,Todd Randall ; Gui,Yifan ; Myers,Patrick Andrew",
      },
    ],
    ClassInstructors: [
      {
        InstrUniqname: "TRAUMICH",
        InstrName: "Allen,Todd Randall",
      },
      {
        InstrUniqname: "EVANGYF",
        InstrName: "Gui,Yifan",
      },
      {
        InstrUniqname: "MYERSPAT",
        InstrName: "Myers,Patrick Andrew",
      },
    ],
  };
  expect(parseSection(ners250Section)).toEqual(<Section>{
    number: 1,
    type: SectionType.LEC,
    enrollStatus: EnrollmentStatus.Open,
    enrolled: 19,
    capacity: 32,
    seatsAvailable: 13,
    credits: 4,
    classNumber: 16409,
    meetings: [
      {
        days: new Set([Weekday.Monday, Weekday.Wednesday]),
        startTime: Duration.fromObject({ hour: 10, minute: 30 }),
        endTime: Duration.fromObject({ hour: 11, minute: 30 }),
        location: null,
      },
      {
        days: new Set([Weekday.Friday]),
        startTime: Duration.fromObject({ hour: 9, minute: 30 }),
        endTime: Duration.fromObject({ hour: 11, minute: 30 }),
        location: null,
      },
    ],
    instructors: [
      {
        uniqname: "traumich",
        firstName: "Todd",
        lastName: "Allen",
      },
      {
        uniqname: "evangyf",
        firstName: "Yifan",
        lastName: "Gui",
      },
      {
        uniqname: "myerspat",
        firstName: "Patrick",
        lastName: "Myers",
      },
    ],
  });

  const chem215Section: SectionJson = {
    SectionNumber: 100,
    SectionType: <SectionType>"LEC",
    SessionDescr: "Regular",
    InstructionMode: "In Person",
    EnrollmentStatus: "Open",
    EnrollmentTotal: 439,
    EnrollmentCapacity: 450,
    AvailableSeats: 11,
    WaitTotal: 3,
    WaitCapacity: 0,
    CreditHours: 3,
    ClassNumber: 28336,
    Meeting: {
      MeetingNumber: 1,
      Days: "MoWeFr",
      Times: "9:00AM - 10:00AM",
      ClassMtgTopic: "TBA",
      Instructors: "Coppola,Brian P",
    },
    Instructor: {
      Uniqname: "BCOPPOLA",
      FirstName: "Brian",
      LastName: "Coppola",
    },
  };

  expect(parseSection(chem215Section)).toEqual(<Section>{
    number: 100,
    type: SectionType.LEC,
    enrollStatus: EnrollmentStatus.Open,
    enrolled: 439,
    capacity: 450,
    seatsAvailable: 11,
    credits: 3,
    classNumber: 28336,
    meetings: [
      {
        days: new Set([Weekday.Monday, Weekday.Wednesday, Weekday.Friday]),
        startTime: Duration.fromDurationLike({ hour: 9, minute: 0 }),
        endTime: Duration.fromDurationLike({ hour: 10, minute: 0 }),
        location: null,
      },
    ],
    instructors: [
      {
        firstName: "Brian",
        lastName: "Coppola",
        uniqname: "bcoppola",
      },
    ],
  });
});
