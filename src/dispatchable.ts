import type { WorkOptions } from 'pg-boss'
import type { JobQueues, DefaultJobQueues } from './jobs_types.js'

export abstract class Dispatchable {
  /**
   * Optional: Override the auto-generated job name
   * Default: kebab-case conversion of class name (CreateDatabaseJob → 'create-database')
   */
  static jobName?: string

  /**
   * Optional: Specify which queue this job should run in
   * Default: 'default'
   * Must match one of the queues defined in config/jobs.ts
   */
  static queue?: JobQueues['queues'] extends any ? JobQueues['queues'] : DefaultJobQueues['queues']

  /**
   * Optional: All pg-boss work options
   * See: https://github.com/timgit/pg-boss/blob/master/docs/readme.md#work
   */
  static workOptions?: WorkOptions

  /**
   * Handle the job payload
   * This method must be implemented by job classes
   */
  abstract handle(payload: unknown): Promise<void>
}
