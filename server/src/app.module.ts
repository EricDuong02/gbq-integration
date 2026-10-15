import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SharedModule } from './shared/shared.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'
import { DevtoolsModule } from '@nestjs/devtools-integration'
import { GbqModule } from './modules/gbq/gbq.module'
import { ScheduleModule } from '@nestjs/schedule'

@Module({
  imports: [
    DevtoolsModule.register({
      http: process.env.NODE_ENV !== 'production',
      port: 5434,
    }),
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    SharedModule,
    WebhooksModule,
    GbqModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
