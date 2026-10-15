import { Controller, Get } from '@nestjs/common'
import { GraphqlClient } from '@shopify/shopify-api'
import { ShopifyServer } from '@/decorators/shop-server.decorator'
import { GbqService } from '../services/gbq.service'

@Controller({
  path: 'gbq',
  version: '1',
})
export class GbqController {
  constructor(private readonly gbqService: GbqService) {}

  @Get('sync')
  async sync(@ShopifyServer('gql') gqlClient: GraphqlClient) {
    return await this.gbqService.syncAll(gqlClient, true)
  }

  @Get('logs')
  async getLogs() {
    return this.gbqService.getLogs()
  }
}
