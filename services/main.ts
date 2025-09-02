import app from '@adonisjs/core/services/app'
import type PgBoss from 'pg-boss'
import { JobAutoDiscovery } from '../src/auto_discovery.js'
import { JobFileScanner } from '../src/job_file_scanner.js'
import { JobConfigExtractor } from '../src/job_config_extractor.js'
import { JobWorkerManager } from '../src/job_worker_manager.js'
import { PgBossConfig } from '../src/types.js'

let job: PgBoss

await app.booted(async () => {
  const pgBoss = (await app.container.make('pgboss')) as PgBoss
  const configService = await app.container.make('config')
  const jobsConfig = configService.get('jobs') as PgBossConfig

  const logger = await app.container.make('logger')
  const fileScanner = await app.container.make(JobFileScanner)
  const configExtractor = await app.container.make(JobConfigExtractor, [jobsConfig])
  const workerManager = await app.container.make(JobWorkerManager, [pgBoss, app])
  const autoDiscovery = await app.container.make(JobAutoDiscovery, [
    fileScanner,
    configExtractor,
    workerManager,
    jobsConfig,
    logger,
  ])
  await autoDiscovery.discover()

  job = pgBoss
})

export { job as default }
