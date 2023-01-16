import { strict as assert } from 'assert'
import { BaseInteraction, Client } from 'discord.js'
import { DateTime, Duration } from 'luxon'
import environment from './environment'

export function stripMarkdown (s: string): string {
  return s.replace(/(\*|_|~|`|\[|\]|\(|\)|\||\\)/g, '\\$1').replace(/\s+/g, ' ')
}

export function stripMarkdownTag (strings: TemplateStringsArray, ...expr: unknown[]): string {
  return strings.reduce((acc, s, i) => acc + s + (i < expr.length ? stripMarkdown(String(expr[i])) : ''), '')
}

export async function fetchGuildNickname (client: Client, id: string): Promise<string | null> {
  const guild = await client.guilds.fetch(environment.guild)
  const member = await guild.members.fetch(id)
  return member.nickname
}

export async function fetchInteractionUserNickname<T extends BaseInteraction> (ix: Omit<T, 'reply' | 'showModal'>): Promise<string> {
  return (await fetchGuildNickname(ix.client, ix.user.id)) ?? ix.user.username
}

export function devAssert (condition: boolean, message?: string | Error | undefined): void {
  if (environment.name === 'dev') {
    assert(condition, message)
  }
}

export function zeroPad (num: number): string {
  let out = num.toString()
  while (out.length < 3) out = '0' + out
  return out
}

export function truncateText (text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  if (maxLength <= 1) return '…'

  const cuttingWord = /\S/.test(text[maxLength - 1]) && /\S/.test(text[maxLength - 2])
  let partCut = text.substring(0, maxLength - 1)

  if (cuttingWord) {
    // Remove the word that was cut in two
    partCut = partCut.replace(/\S+$/, '')
  }
  // Remove trailing punctuation and whitespace
  partCut = partCut.replaceAll(/[\s.,/#!$%^&*;:{}=\-_`~()]+$/g, '')

  return partCut + '…'
}

export function reverseLookup<V> (record: Record<string, V>, value: V): string | null {
  return Object.keys(record).find((key) => record[key] === value) ?? null
}

export function formatTime (dur: Duration | null): string {
  if (dur === null) return 'TBA'
  const date = DateTime.fromObject({ hour: dur.hours, minute: dur.minutes })
  return date.setLocale('en-US').toLocaleString(DateTime.TIME_SIMPLE)
}

export function groupItems<T> (items: T[], key: (item: T) => string): { [key: string]: T[] } {
  return items.reduce((groups: { [key: string]: T[] }, item: T) => {
    const itemKey = key(item)
    if (!(itemKey in groups)) groups[itemKey] = []
    groups[itemKey].push(item)
    return groups
  }, {})
}
