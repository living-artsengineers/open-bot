import { Course, Section } from "./entities";

// An oddity of the SOC API is that all arrays with one non-array element get reduced to just that element
// Use this liberally to account for edge cases where some singular value in one sample response suddenly becomes
// multiple in another.
function arrayify<T>(possiblyArray: T | T[]): T[] {
  return Array.isArray(possiblyArray) ? possiblyArray : [possiblyArray];
}

export interface ISocApiClient {
  fetchSection(course: Course, sectionNumber: number): Promise<Section | null>;
  fetchSection(classNumber: number): Promise<Section | null>;
  fetchAllSections(course: Course): Promise<Section[]>;
}
