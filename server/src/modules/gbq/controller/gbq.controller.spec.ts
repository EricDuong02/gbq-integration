import { Test, TestingModule } from '@nestjs/testing'
import { GbqController } from './gbq.controller'

describe('GbqController', () => {
  let controller: GbqController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GbqController],
    }).compile()

    controller = module.get<GbqController>(GbqController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
