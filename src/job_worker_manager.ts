import type PgBoss from 'pg-boss'
import type { JobClass, WorkOptions, ScheduleOptions } from './types.js'
import type { ApplicationService } from '@adonisjs/core/types'

export class JobWorkerManager {
  constructor(
    private pgBoss: PgBoss,
    private app: ApplicationService
  ) {}

  async registerWorker(
    jobName: string,
    JobClass: JobClass,
    workOptions?: WorkOptions
  ): Promise<void> {
    const options = workOptions || {}
    await this.pgBoss.work(jobName, options, async (jobs: PgBoss.Job[]) => {
      for (const job of jobs) {
        const instance = await this.app.container.make(JobClass)
        await this.app.container.call(instance, 'handle', [job.data])
      }
    })
  }

  async scheduleJobIfCron(
    jobName: string,
    cron?: string,
    scheduleOptions?: ScheduleOptions
  ): Promise<void> {
    if (!cron) return

    const options = scheduleOptions || {}
    await this.pgBoss.schedule(jobName, cron, {}, options)
  }
}
