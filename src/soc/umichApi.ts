import { DateTime, Duration } from "luxon";
import environment from "../environment";
import axios, { AxiosInstance } from "axios";
import { Course, EnrollmentStatus, Meeting, Section, SectionType, Weekday } from "./entities";

export interface ISocApiClient {
  getSectionBySectionNumber(course: Course, sectionNumber: number, termCode: number): Promise<Section<true> | null>;
  fetchSectionByClassNumber(classNumber: number, termCode: number): Promise<[Section<true>, Course] | null>;
  fetchAllSections(course: Course, termCode: number): Promise<Section<false>[]>;
  getCourseDescription(course: Course, termCode: number): Promise<string | null>;
}

// We unfortunately cannot retrieve past term codes via the SOC API
export const termCodes = {
  "Fall 2022": 2410,
  "Winter 2022": 2370,
  "Fall 2021": 2360,
};

const endpointPrefix = "https://apigw.it.umich.edu/um/Curriculum/SOC";
export class UMichSocApiClient implements ISocApiClient {
  private accessToken: { value: string; expireAt: DateTime } | null = null;
  private axios: AxiosInstance = axios.create({ baseURL: endpointPrefix });
  // a null in the cache means that the course catalog doesn't have that value (don't ask for it again)
  private descriptionCache: { [term: number]: { [course: string]: string | null } } = {};
  private sectionCache: { [term: number]: { [course: string]: { [section: number]: Section<true> | null } } } = {};

  async fetchAllSections(course: Course, termCode: number): Promise<Section[]> {
    await this.refreshTokenIfNeeded();
    const res = await this.axios.get(
      `/Terms/${termCode}/Schools/UM/Subjects/${course.subject}/CatalogNbrs/${course.number}/Sections?IncludeAllSections=Y`
    );
    const sections = res.data.getSOCSectionsResponse.Section;
    if (sections === undefined) return [];
    return (<SectionJson[]>arrayify(sections)).map(parseSection);
  }

  async getSectionBySectionNumber(
    course: Course,
    sectionNumber: number,
    termCode: number
  ): Promise<Section<true> | null> {
    // FIXME: Enrollment is ephemeral and should expire
    const cached = this.sectionCache[termCode]?.[course.toString()]?.[sectionNumber];
    if (cached !== undefined) {
      return cached;
    }
    const section = await this.fetchSectionBySectionNumber(course, sectionNumber, termCode);
    // This careful walking into nested objects is repetitive and deserves a utility function
    if (this.sectionCache[termCode] === undefined) this.sectionCache[termCode] = {};
    if (this.sectionCache[termCode][course.toString()] === undefined)
      this.sectionCache[termCode][course.toString()] = {};
    this.sectionCache[termCode][course.toString()][sectionNumber] = section;
    return section;
  }

  async fetchSectionBySectionNumber(
    course: Course,
    sectionNumber: number,
    termCode: number
  ): Promise<Section<true> | null> {
    // The API endpoint requires left-padded section numbers
    let sectionNumberStr = sectionNumber.toString();
    while (sectionNumberStr.length < 3) sectionNumberStr = "0" + sectionNumberStr;

    await this.refreshTokenIfNeeded();
    const res = await this.axios.get(
      `/Terms/${termCode}/Schools/UM/Subjects/${course.subject}/CatalogNbrs/${course.number}/Sections/${sectionNumberStr}`
    );
    const section = res.data.getSOCSectionDetailResponse;
    if (section !== undefined && "SectionType" in section) {
      return { ...parseSection(section as SectionJson), number: sectionNumber };
    }
    return null;
  }

  async fetchSectionByClassNumber(classNumber: number, termCode: number): Promise<[Section<true>, Course] | null> {
    await this.refreshTokenIfNeeded();
    const res = await this.axios.get(`/Terms/${termCode}/Classes/${classNumber}`);
    const section = res.data.getSOCSectionListByNbrResponse.ClassOffered;
    if (section === undefined) return null;
    const sectionInfo = parseSection(section as SectionJson);
    const course = new Course(section.SubjectCode, section.CatalogNumber);
    return [sectionInfo, course];
  }

  async getCourseDescription(course: Course, termCode: number): Promise<string | null> {
    const cached = this.descriptionCache[termCode]?.[course.toString()];
    if (cached !== undefined) return cached;
    const fetched = await this.fetchCourseDescription(course, termCode);

    if (this.descriptionCache[termCode] === undefined) this.descriptionCache[termCode] = {};
    this.descriptionCache[termCode][course.toString()] = fetched;
    return fetched;
  }

  async fetchCourseDescription(course: Course, termCode: number): Promise<string | null> {
    await this.refreshTokenIfNeeded();
    const res = await this.axios.get(
      `/Terms/${termCode}/Schools/UM/Subjects/${course.subject}/CatalogNbrs/${course.number}`
    );
    const descr: string = res.data.getSOCCourseDescrResponse.CourseDescr;
    return descr === "No Course Description found." ? null : descr;
  }

  private async refreshTokenIfNeeded() {
    if (this.accessToken === null || this.accessToken.expireAt <= DateTime.now()) {
      await this.requestToken();
    }
  }

  private async requestToken() {
    const res = await axios.post(
      "https://apigw.it.umich.edu/um/aa/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: environment.umApi.clientId,
        client_secret: environment.umApi.clientSecret,
        scope: "umscheduleofclasses",
      }),
      {}
    );
    this.accessToken = {
      value: res.data.access_token,
      expireAt: DateTime.now().plus({ second: res.data.expires_in }),
    };
    this.axios.defaults.headers.get["Authorization"] = `Bearer ${this.accessToken.value}`;
    this.axios.defaults.headers.get["X-IBM-Client-Id"] = environment.umApi.clientId;
  }
}

// Exported for testing
export interface SectionJson {
  SectionNumber: string | number;
  SectionType: SectionType;
  SessionDescr: string;
  InstructionMode: string;
  EnrollmentStatus: "Open" | "Wait List" | "Closed";
  EnrollmentTotal: number;
  EnrollmentCapacity: number;
  AvailableSeats: number;
  WaitTotal: number;
  WaitCapacity: number;
  CreditHours: number;
  ClassNumber: number;
  Meeting?: MeetingElement[] | MeetingElement;
  // Reading by section number gives "Instructor", but reading by class number gives "ClassInstructors"
  Instructor?: Instructor[] | Instructor;
  ClassInstructors?: ClassInstructor[] | ClassInstructor;
}

export interface Instructor {
  InstructorName: string;
  Uniqname: string;
  FirstName?: string;
  LastName?: string;
}
export interface ClassInstructor {
  InstrUniqname: string;
  InstrName: string;
}

export interface MeetingElement {
  MeetingNumber: number;
  Days: string;
  Times: string;
  Location?: string;
  ClassMtgTopic: string;
  Instructors: string;
}

// Exported for testing
export function parseSection<Loc extends boolean>(sectionJson: SectionJson): Section<Loc> {
  return {
    number: integrify(sectionJson.SectionNumber),
    type: sectionJson.SectionType,
    enrollStatus: sectionJson.EnrollmentStatus as EnrollmentStatus,
    enrolled: sectionJson.EnrollmentTotal,
    capacity: sectionJson.EnrollmentCapacity,
    seatsAvailable: sectionJson.AvailableSeats,
    credits: sectionJson.CreditHours,
    classNumber: sectionJson.ClassNumber,
    meetings: arrayify(sectionJson.Meeting)
      .map((mtx) => ({
        days: parseDays(mtx.Days),
        startTime: null,
        endTime: null,
        location: mtx.Location && mtx.Location !== "TBA" ? mtx.Location : null,
        ...parseMeetingTimes(mtx.Times),
      }))
      .filter((it) => it.days.size > 0) as Meeting<Loc>[],
    instructors: (arrayify(sectionJson.ClassInstructors) ?? [])
      .map((instr) => (instr === undefined ? null : parseClassInstructor(instr)))
      .concat((arrayify(sectionJson.Instructor) ?? []).map(parseInstructor))
      .filter((it) => it !== null) as Section["instructors"],
  };
}

function parseDays(daysStr: string): Set<Weekday> {
  const daysCode = {
    Mo: Weekday.Monday,
    Tu: Weekday.Tuesday,
    We: Weekday.Wednesday,
    Th: Weekday.Thursday,
    Fr: Weekday.Friday,
    Sa: Weekday.Saturday,
    Su: Weekday.Sunday,
  };
  return new Set(
    Object.entries(daysCode)
      .filter(([code]) => daysStr.includes(code))
      .map(([, day]) => day)
  );
}

function parseMeetingTimes(times: string): Pick<Meeting, "startTime" | "endTime"> | null {
  if (!times.includes(" - ")) return null;
  const [start, end] = times.split(" - ");
  const timeFormat = "h:mma";

  const startTime = DateTime.fromFormat(start.trim(), timeFormat);
  const endTime = DateTime.fromFormat(end.trim(), timeFormat);
  return {
    startTime: Duration.fromDurationLike({ hour: startTime.hour, minute: startTime.minute }),
    endTime: Duration.fromDurationLike({ hour: endTime.hour, minute: endTime.minute }),
  };
}

function parseClassInstructor(instr: ClassInstructor): Section["instructors"][number] | null {
  const tokens = /^(?<last>.+),(?<first>\w+).*$/.exec(instr.InstrName);

  if (tokens?.groups === undefined || tokens?.groups.first === undefined || tokens?.groups.last === undefined) {
    return null;
  }
  return {
    uniqname: instr.InstrUniqname.toLowerCase(),
    firstName: tokens.groups.first,
    lastName: tokens.groups.last,
  };
}

function parseInstructor(instr: Instructor): Section["instructors"][number] | null {
  if (instr.FirstName !== undefined && instr.LastName !== undefined) {
    return {
      uniqname: instr.Uniqname.toLowerCase(),
      firstName: instr.FirstName,
      lastName: instr.LastName,
    };
  }

  return parseClassInstructor({
    InstrUniqname: instr.Uniqname,
    InstrName: instr.InstructorName,
  });
}

// An oddity of the SOC API is that all arrays with one non-array element get reduced to just that element
// Use this liberally to account for edge cases where some singular value in one sample response suddenly becomes
// multiple in another.
function arrayify<T>(possiblyArray: T | T[] | undefined): T[] {
  if (possiblyArray === undefined) return [];
  return Array.isArray(possiblyArray) ? possiblyArray : [possiblyArray];
}

// Another oddity of the SOC API is that SectionNumber can be both `100` and `"007"`
// Use this liberally on numbers that might be left-padded with zeros.
function integrify(possiblyString: number | string): number {
  return typeof possiblyString === "string" ? parseInt(possiblyString, 10) : possiblyString;
}

export const sharedClient: ISocApiClient = new UMichSocApiClient();
