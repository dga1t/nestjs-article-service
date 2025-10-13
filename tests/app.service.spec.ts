import { describe, expect, it } from 'vitest'

import { AppService } from '../src/app.service'

describe('AppService', () => {
  it('returns the health payload', () => {
    const service = new AppService()

    expect(service.getHealth()).toEqual({ status: 'ok' })
  })
})
