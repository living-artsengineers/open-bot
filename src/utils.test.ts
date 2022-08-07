import { test, expect } from "vitest";
import { stripMarkdown, stripMarkdownTag } from "./utils";

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
