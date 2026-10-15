import { Module } from '@nestjs/common'
import { GbqController } from './controller/gbq.controller'
import { GbqService } from './services/gbq.service'
import { TasksService } from './tasks/tasks.service'

@Module({
  controllers: [GbqController],
  providers: [GbqService, TasksService],
})
export class GbqModule {}
