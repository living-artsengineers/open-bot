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
