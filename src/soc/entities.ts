import { devAssert } from "../utils";
import { Duration } from "luxon";

export class Course {
  constructor(
    /**
     * The subject code of this course in uppercase.
     *
     * @example "EECS", "ENGLISH", "UARTS"
     */
    public readonly subject: string,
    /**
     * The catalog number of this course.
     *
     * @example 280, 124, 150
     */
    public readonly number: number
  ) {
    devAssert(subject.trim().toUpperCase() === subject);
    devAssert(Math.floor(number) === number);
    devAssert(number > 0 && number < 1000);
  }

  static parse(str: string): Course | null {
    const trimmed = str.trim();
    if (/\s/.test(trimmed)) {
      const [subject, numberStr] = trimmed.split(/\s+/g);
      const number = parseInt(numberStr.trim(), 10);
      if (isNaN(number)) return null;
      return new Course(subject.trim().toUpperCase(), number);
    }
    const numberMatch = /\d/.exec(trimmed);
    if (numberMatch !== null) {
      const number = parseInt(trimmed.substring(numberMatch.index), 10);
      if (isNaN(number)) return null;
      return new Course(trimmed.substring(0, numberMatch.index).trim().toUpperCase(), number);
    }
    return null;
  }

  toString(): string {
    return `${this.subject} ${this.number}`;
  }
}

export enum SectionType {
  /**
   * Lecture
   */
  LEC = "LEC",
  /**
   * Laboratory
   */
  LAB = "LAB",
  /**
   * Discussion
   */
  DIS = "DIS",
  /**
   * Recitation
   */
  REC = "REC",
  /**
   * Seminar
   */
  SEM = "SEM",
  /**
   * Clinic?
   */
  CLN = "CLN",
  /**
   * Midterm
   */
  MID = "MID",
  /**
   * Independent research
   */
  IND = "IND",
}

export enum EnrollmentStatus {
  Open = "Open",
  WaitList = "Wait List",
  Closed = "Closed",
}

export enum Weekday {
  Monday = "Mon",
  Tuesday = "Tue",
  Wednesday = "Wed",
  Thursday = "Thu",
  Friday = "Fri",
  Saturday = "Sat",
  Sunday = "Sun",
}

export interface Meeting {
  /**
   * The set of weekdays on which this meeting takes place.
   */
  days: Set<Weekday>;
  /**
   * The duration from midnight to the starting time of this meeting.
   */
  startTime: Duration;
  /**
   * The duration from midnight to the ending time of this meeting.
   */
  endTime: Duration;
}

export interface Section {
  readonly number: number;
  readonly type: SectionType;
  readonly enrolled: number;
  readonly capacity: number;
  /**
   * Number of seats available.
   * This is not always equal to `capacity - enrolled`.
   */
  readonly seatsAvailable: number;
  readonly credits: number;
  readonly classNumber: number;
  readonly meetings: Meeting[];
  readonly instructors: {
    uniqname: string;
    firstName: string;
    lastName: string;
  }[];
}
