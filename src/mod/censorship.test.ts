import { test, expect } from 'vitest'
import { censoredWord } from './censorship'

test('censorship, case sensitive', () => {
  expect(censoredWord('a good sniping location')).toEqual('sniping')
  expect(censoredWord('I could snipe so many people')).toEqual('snipe')
  expect(censoredWord('snpe')).toEqual('snipe')
  expect(censoredWord('Oh also cockbot was deployed last/this night.')).toEqual('cockbot')
  expect(censoredWord('cockkkkbot')).toEqual('cockbot')
  expect(censoredWord("reset the cock     bot's time zone")).toEqual('cockbot')
})

test('censorship, space insensitive', () => {
  expect(censoredWord('a good s n i p i n g location')).toEqual('sniping')
  expect(censoredWord('I could s  n    i  pe so many people')).toEqual('snipe')
  expect(censoredWord('s    n    p       e')).toEqual('snipe')
  expect(censoredWord('Oh also c o c k b o t was deployed last/this night.')).toEqual('cockbot')
  expect(censoredWord('the cock be botting')).toEqual(null)
  expect(censoredWord('cock k k k bot')).toEqual('cockbot')
  expect(censoredWord("reset the cock     bot's time zone")).toEqual('cockbot')
})

test('censorship, case insensitive', () => {
  expect(censoredWord('a good SNIPING location')).toEqual('sniping')
  expect(censoredWord('I could SNIPE so many people')).toEqual('snipe')
  expect(censoredWord('SnPe')).toEqual('snipe')
  expect(censoredWord('Oh also CocKBoT was deployed last/this night.')).toEqual('cockbot')
  expect(censoredWord('cockKkKkK bot')).toEqual('cockbot')
  expect(censoredWord("reset the COCKKKKbot's time zone")).toEqual('cockbot')
})
