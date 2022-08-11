import { strict as assert } from "assert";
import { Client } from "discord.js";
import environment from "./environment";

export function stripMarkdown(s: string): string {
  return s.replace(/(\*|_|~|`|\[|\]|\(|\)|\||\\)/g, "\\$1").replace(/\s+/g, " ");
}

export function stripMarkdownTag(strings: TemplateStringsArray, ...expr: unknown[]) {
  return strings.reduce((acc, s, i) => acc + s + (i < expr.length ? stripMarkdown(String(expr[i])) : ""), "");
}

export async function fetchGuildNickname(client: Client, id: string): Promise<string | null> {
  const guild = await client.guilds.fetch(environment.guild);
  const member = await guild.members.fetch(id);
  return member.nickname;
}

export function devAssert(condition: boolean, message?: string | Error | undefined) {
  if (environment.name === "dev") {
    assert(condition, message);
  }
}

export function zeroPad(num: number): string {
  let out = num.toString();
  while (out.length < 3) out = "0" + out;
  return out;
}
