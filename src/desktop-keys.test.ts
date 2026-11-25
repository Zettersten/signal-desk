import { describe, expect, it } from 'vitest'
import { listFocusTarget } from './desktop-keys'

describe('desktop list navigation', () => {
  it('moves to adjacent records without wrapping when a boundary is reached', () => {
    expect(listFocusTarget('ArrowDown', 0, 3)).toBe(1)
    expect(listFocusTarget('ArrowDown', 2, 3)).toBe(2)
    expect(listFocusTarget('ArrowUp', 2, 3)).toBe(1)
    expect(listFocusTarget('ArrowUp', 0, 3)).toBe(0)
  })
  it('supports Home and End, leaving other shortcuts and empty lists alone', () => {
    expect(listFocusTarget('Home', 1, 3)).toBe(0)
    expect(listFocusTarget('End', 1, 3)).toBe(2)
    expect(listFocusTarget('Enter', 0, 3)).toBeNull()
    expect(listFocusTarget('ArrowDown', 0, 0)).toBeNull()
  })
})
