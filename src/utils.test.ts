import { test, expect } from "vitest";
import { stripMarkdown, stripMarkdownTag, truncateText, zeroPad, reverseLookup } from "./utils";

test("stripMarkdown", () => {
  const cases = {
    "": "",
    "\t\t": " ",
    "\n": " ",
    text: "text",
    _text_: "\\_text\\_",
    "*text_": "\\*text\\_",
    "*text*": "\\*text\\*",
    "**text**": "\\*\\*text\\*\\*",
    "a*b_c": "a\\*b\\_c",
    "*_*~*_": "\\*\\_\\*\\~\\*\\_",
    "~~||text||~~": "\\~\\~\\|\\|text\\|\\|\\~\\~",
    "[a](xx)": "\\[a\\]\\(xx\\)",
    "\\_\\_": "\\\\\\_\\\\\\_",
  };
  for (const [input, expected] of Object.entries(cases)) {
    expect(stripMarkdown(input)).toEqual(expected);
  }
});

test("stripMarkdownTags", () => {
  const cases = {
    [stripMarkdownTag`_${"test"}_`]: "_test_",
    [stripMarkdownTag`*${"*test*"}*`]: "*\\*test\\**",
  };

  for (const [actual, expected] of Object.entries(cases)) {
    expect(actual).toEqual(expected);
  }
});

test("zeroPad", () => {
  expect(zeroPad(0)).toEqual("000");
  expect(zeroPad(5)).toEqual("005");
  expect(zeroPad(10)).toEqual("010");
  expect(zeroPad(88)).toEqual("088");
  expect(zeroPad(200)).toEqual("200");
  expect(zeroPad(999)).toEqual("999");
});

const law406 = `In this course, we consider the salient aspects of a variety of real estate transactions. Students (i) learn to identify the issues involved in each one, (ii) become familiar with the documents often utilized, (iii) determine the perspective the respective parties bring, and (iv) consider how various issues might be resolved. This course satisfies the "practicum" requirement.`;
test("truncateText", () => {
  // Right against the limit
  expect(truncateText(law406, 8)).toEqual("In this…");
  // Do not include any words that would make us break the limit
  expect(truncateText(law406, 10)).toEqual("In this…");
  // Do not include trailing commas
  expect(truncateText(law406, 16)).toEqual("In this course…");
  expect(truncateText(law406, 1)).toEqual("…");
  expect(truncateText("aaaaaaaaaaaaaaaaaaaaaaaaa", 4)).toEqual("…");
  expect(truncateText(law406, 9000)).toEqual(law406);
  expect(truncateText("hello", 5)).toEqual("hello");
});

test("reverseLookup", () => {
  const obj = {
    a: 2,
    b: 3,
    j: 10,
  };
  expect(reverseLookup(obj, 3)).toEqual("a");
  expect(reverseLookup(obj, 10)).toEqual("j");
  expect(reverseLookup(obj, 1)).toBeNull();
});
