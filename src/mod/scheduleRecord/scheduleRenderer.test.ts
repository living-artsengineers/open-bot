import { expect, test } from 'vitest'
import { formatHour } from './scheduleRenderer'

test('formatHour', () => {
  const cases = {
    0: '12 AM',
    5: '5 AM',
    11: '11 AM',
    12: '12 PM',
    19: '7 PM',
    23: '11 PM',
    24: '12 AM'
  }
  for (const hour in cases) {
    expect(formatHour(Number(hour))).toEqual(cases[Number(hour) as keyof typeof cases])
  }
})
