import app from '@adonisjs/core/services/app'
import type PgBoss from 'pg-boss'
import { JobAutoDiscovery } from '../src/auto_discovery.js'
import { PgBossConfig } from '../src/types.js'

let job: PgBoss

await app.booted(async () => {
  const pgBoss = (await app.container.make('pgboss')) as PgBoss
  const configService = await app.container.make('config')
  const jobsConfig = configService.get('jobs') as PgBossConfig

  // Auto-discover and register all jobs
  const autoDiscovery = new JobAutoDiscovery(pgBoss, jobsConfig)
  await autoDiscovery.discover()

  // Export pg-boss directly - zero abstractions!
  job = pgBoss
})

export { job as default }
