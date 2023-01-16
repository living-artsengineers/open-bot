import { termCodes } from './umichApi'

export function splitDescription (description: string): { title: string, details: string | null } {
  const knownSeparators = ['---', '\n']
  for (const sep of knownSeparators) {
    const sepIndex = description.indexOf(sep)
    if (sepIndex !== -1) {
      return {
        title: description.substring(0, sepIndex).trim(),
        details: description.substring(sepIndex + sep.length).trim()
      }
    }
  }
  return { title: description, details: null }
}

// Change every term
export const defaultTerm: keyof typeof termCodes = 'Winter 2023'
