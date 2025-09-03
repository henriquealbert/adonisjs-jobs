import type PgBoss from 'pg-boss'
import { Job } from './job.js'
import type { JobQueues } from './jobs_types.js'

export type {
  ConstructorOptions,
  SendOptions,
  ScheduleOptions as PgBossScheduleOptions,
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
  WorkOptions as PgBossWorkOptions,
} from 'pg-boss'

/**
 * Extended WorkOptions that includes queue property
 */
export interface WorkOptions extends PgBoss.WorkOptions {
  queue?: string
}

/**
 * Extended ScheduleOptions that includes queue property
 */
export interface ScheduleOptions extends PgBoss.ScheduleOptions {
  queue?: string
}

/**
 * Job class constructor type
 */
export interface JobClass {
  new (...args: unknown[]): Job
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
 * Re-export JobQueues interface for module augmentation
 */
export type { JobQueues } from './jobs_types.js'

/**
 * Type-safe Job interface for queue property
 */
export interface TypeSafeJobStatic {
  queue?: JobQueues['queues']
}

/**
 * JobService type alias for better naming
 * This is just a type alias for PgBoss, not a wrapper
 */
export type JobService = PgBoss

/**
 * Helper type to infer queue names from config
 */
export type InferQueues<T extends PgBossConfig> = T['queues'] extends readonly string[]
  ? T['queues'][number]
  : string
