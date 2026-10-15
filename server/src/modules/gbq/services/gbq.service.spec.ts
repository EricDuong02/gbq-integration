import { Test, TestingModule } from '@nestjs/testing'
import { GbqService } from './gbq.service'

describe('GbqService', () => {
  let service: GbqService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GbqService],
    }).compile()

    service = module.get<GbqService>(GbqService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
