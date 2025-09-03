import app from '@adonisjs/core/services/app'
import type { JobService } from '../providers/jobs_provider.js'

let job: JobService

await app.booted(async () => {
  job = await app.container.make('hschmaiske/jobs')
})

export { job as default }
