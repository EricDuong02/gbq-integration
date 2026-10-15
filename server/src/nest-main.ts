import { VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express'
import { Express } from 'express'
import { AppModule } from './app.module'

async function bootstrap(server?: Express) {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
  )
  app.setGlobalPrefix('api')
  app.enableCors()

  app.enableVersioning({
    type: VersioningType.URI,
  })

  // await app.init();
  return app
}
export default bootstrap
