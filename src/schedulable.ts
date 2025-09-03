import type { ScheduleOptions } from 'pg-boss'
import type { JobQueues, DefaultJobQueues } from './jobs_types.js'

export abstract class Schedulable {
  /**
   * Required: Cron schedule expression
   * Uses standard cron syntax: '0 2 * * *' = daily at 2 AM
   */
  static readonly schedule: string

  /**
   * Optional: Override the auto-generated job name
   * Default: kebab-case conversion of class name (CleanupTokensCron → 'cleanup-tokens')
   */
  static jobName?: string

  /**
   * Optional: Specify which queue this job should run in
   * Default: 'default'
   * Must match one of the queues defined in config/jobs.ts
   */
  static queue?: JobQueues['queues'] extends any ? JobQueues['queues'] : DefaultJobQueues['queues']

  /**
   * Optional: All pg-boss schedule options
   * See: https://github.com/timgit/pg-boss/blob/master/docs/readme.md#schedule
   */
  static scheduleOptions?: ScheduleOptions

  /**
   * Handle the scheduled job execution
   * Cron jobs do not receive payload data
   */
  abstract handle(): Promise<void>
}
