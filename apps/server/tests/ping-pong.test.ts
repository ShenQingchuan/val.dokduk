import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppController } from '../src/app.controller'

describe('appController', () => {
  let controller: AppController
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AppController],
    })
      .compile()

    controller = module.get<AppController>(AppController)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('ping', () => {
    it('should return pong message without query parameter', () => {
      const result = controller.ping()
      expect(result).toEqual({
        msg: 'Pong: undefined',
      })
    })

    it('should return pong message with query parameter', () => {
      const result = controller.ping('test')
      expect(result).toEqual({
        msg: 'Pong: test',
      })
    })
  })
})
