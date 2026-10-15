import { getShopifyClient } from '@/decorators/shop-server.decorator'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { GraphqlClient } from '@shopify/shopify-api'
import { GbqService } from '../services/gbq.service'

@Injectable()
export class TasksService {
  private gbqService: GbqService

  constructor() {
    this.gbqService = new GbqService()
  }

  @Cron('0 0 10,12,14,16,18,20 * * *', { timeZone: 'Asia/Bangkok' })
  async handleDailyCron() {
    const gqlClient = (await getShopifyClient('gql')) as GraphqlClient
    await this.gbqService.syncAll(gqlClient, true) // true = incremental sync
  }

  // Full sync
  @Cron('0 0 3 * * *', { timeZone: 'Asia/Bangkok' })
  async handleFullSync() {
    const gqlClient = (await getShopifyClient('gql')) as GraphqlClient
    await this.gbqService.syncAll(gqlClient, false) // false = full sync
  }
}
