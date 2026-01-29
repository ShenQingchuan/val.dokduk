import { describe, expect, it } from 'vitest'
import { add, greet } from './index'

describe('utils', () => {
  it('should greet correctly', () => {
    expect(greet('World')).toBe('Hello, World!')
  })

  it('should add numbers correctly', () => {
    expect(add(2, 3)).toBe(5)
    expect(add(-1, 1)).toBe(0)
  })
})
