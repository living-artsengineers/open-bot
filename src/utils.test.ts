import { test, expect } from "vitest";
import { stripMarkdown, stripMarkdownTag, zeroPad } from "./utils";

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
