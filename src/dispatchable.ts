import type { WorkOptions } from 'pg-boss'
import type { JobQueues, DefaultJobQueues } from './jobs_types.js'
import type { LoggerService } from '@adonisjs/core/types'

export abstract class Dispatchable {
  #logger?: LoggerService

  /**
   * Inject internal dependencies (called by the job manager)
   */
  $injectInternal(internals: { logger: LoggerService }) {
    this.#logger = internals.logger
  }

  /**
   * Access to logger instance
   */
  get logger() {
    if (!this.#logger) {
      throw new Error(
        'Logger not available. Make sure the job is properly initialized by the job manager.'
      )
    }
    return this.#logger
  }

  /**
   * The file path of the job class - used for dynamic imports
   * This should be set to import.meta.url in the job class
   */
  static get $$filepath(): string {
    throw new Error('$$filepath must be implemented in the job class. Set it to: import.meta.url')
  }

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
