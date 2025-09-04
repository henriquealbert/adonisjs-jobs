/**
 * @hschmaiske/jobs
 *
 * @license MIT
 */

import app from '@adonisjs/core/services/app'
import { JobManager } from '../src/job_manager.js'

let jobs: JobManager

await app.booted(async () => {
  jobs = await app.container.make('hschmaiske/jobs')
})

export { jobs as default }
