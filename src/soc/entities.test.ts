import { expect, test } from "vitest";
import { Course } from "./entities";

const courseCodeToCourse = {
  "EECS 280": new Course("EECS", 280),
  "ENGLISH 124": new Course("ENGLISH", 124),
  "physics 241": new Course("PHYSICS", 241),
  "cHeM\t\t125": new Course("CHEM", 125),
  "\n\n\t\tUarts\t000150": new Course("UARTS", 150),
  engr100: new Course("ENGR", 100),
  UarTS175: new Course("UARTS", 175),
};

test("Conversion from string to Course", () => {
  for (const [str, course] of Object.entries(courseCodeToCourse)) {
    expect(Course.parse(str)).toEqual(course);
  }
  expect(Course.parse("UART S150")).toBeNull();
  expect(Course.parse("engr")).toBeNull();
  expect(Course.parse("")).toBeNull();
});

test("Conversion from Course to string", () => {
  expect(new Course("EECS", 183).toString()).toEqual("EECS 183");
  expect(new Course("BIOLOGY", 210).toString()).toEqual("BIOLOGY 210");
  expect(new Course("TCHNCLCM", 300).toString()).toEqual("TCHNCLCM 300");
});
