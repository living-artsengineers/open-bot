import { expect, test } from "vitest";
import { Campus, campusOfFacility } from "./umCampus";

test("campusOfFacility", () => {
  expect(campusOfFacility("AH")).toEqual(Campus.Central);
  expect(campusOfFacility("BEYSTER")).toEqual(Campus.North);
  expect(campusOfFacility("DOW")).toEqual(Campus.North);
  expect(campusOfFacility("MOORE")).toEqual(Campus.North);
  expect(campusOfFacility("COOL")).toEqual(Campus.North);
  expect(campusOfFacility("REMOTE")).toEqual(Campus.Remote);
});
