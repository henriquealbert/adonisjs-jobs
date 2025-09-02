import type PgBoss from 'pg-boss'
import type { Job } from './job.js'

export type {
  ConstructorOptions,
  SendOptions,
  ScheduleOptions,
  JobWithMetadata,
  Job as PgBossJob,
  DatabaseOptions,
  MaintenanceOptions,
  SchedulingOptions,
  Worker,
  WorkHandler,
  WorkWithMetadataHandler,
  QueueOptions,
  JobOptions,
  JobInsert,
  JobStates,
  WorkOptions,
} from 'pg-boss'

/**
 * Job class constructor type
 */
export interface JobClass {
  new (...args: any[]): Job
}

export interface PgBossConfig extends PgBoss.ConstructorOptions {
  /**
   * Enable/disable the service
   */
  enabled?: boolean

  /**
   * Auto-start the service when the application starts
   */
  autoStart?: boolean

  /**
   * Graceful shutdown timeout in milliseconds
   */
  shutdownTimeoutMs?: number

  /**
   * Path to scan for job classes
   * Default: 'app/jobs'
   */
  jobsPath?: string

  /**
   * Available queue names for type safety
   * Jobs can specify static queue property that must match one of these
   */
  queues?: readonly string[]

  /**
   * Default queue for jobs that don't specify a static queue
   * Must be one of the queues defined above
   * Default: 'default'
   */
  defaultQueue?: string
}

/**
 * Infer queue types from job configuration
 */
export type InferQueues<T extends { queues?: readonly string[] }> =
  T['queues'] extends readonly string[] ? T['queues'][number] : string
