import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { formatCompactDuration } from './utils.js'

describe('formatCompactDuration', () => {
  it('keeps minutes for short windows', () => {
    assert.equal(formatCompactDuration(7 * 60), '7m')
  })

  it('keeps hours and minutes under a day', () => {
    assert.equal(formatCompactDuration((4 * 3600) + (29 * 60)), '4h 29m')
  })

  it('drops minutes for multi-day windows', () => {
    assert.equal(formatCompactDuration((4 * 86_400) + (17 * 3600) + (7 * 60)), '4d 17h')
  })
})
