import type { WorkOptions, ScheduleOptions } from 'pg-boss'
import type { JobQueues } from './jobs_types.js'

export abstract class Job {
  /**
   * Optional: Override the auto-generated job name
   * Default: kebab-case conversion of class name (SendEmailJob → 'send-email')
   */
  static jobName?: string

  /**
   * Optional: Specify which queue this job should run in
   * Default: 'default'
   * Must match one of the queues defined in config/jobs.ts
   */
  static queue?: JobQueues['queues']

  /**
   * Optional: Schedule this job to run on a cron schedule
   * Uses standard cron syntax: '0 2 * * *' = daily at 2 AM
   */
  static cron?: string

  /**
   * Optional: All pg-boss work options
   * See: https://github.com/timgit/pg-boss/blob/master/docs/readme.md#work
   */
  static workOptions?: WorkOptions

  /**
   * Optional: All pg-boss schedule options
   * See: https://github.com/timgit/pg-boss/blob/master/docs/readme.md#schedule
   */
  static scheduleOptions?: ScheduleOptions

  /**
   * Handle the job payload
   * This method must be implemented by job classes
   */
  abstract handle(payload: unknown): Promise<void>
}
