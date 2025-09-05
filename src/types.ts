import type PgBoss from 'pg-boss'
import type { Dispatchable } from './dispatchable.js'
import type { Schedulable } from './schedulable.js'

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
 * Job handler constructor type (supports both Dispatchable and Schedulable)
 */
export interface JobHandlerConstructor {
  new (...args: any[]): Dispatchable | Schedulable
  queue?: string
  workOptions?: PgBoss.WorkOptions
  scheduleOptions?: PgBoss.ScheduleOptions
  schedule?: string
}

/**
 * Allowed job types for dispatch/schedule (class or lazy import)
 */
export type AllowedJobTypes =
  | JobHandlerConstructor
  | (() => Promise<{ default: JobHandlerConstructor }>)

/**
 * Type for Dispatchable jobs only (for type-safe dispatch)
 */
export type DispatchableJobType =
  | (new (...args: any[]) => Dispatchable)
  | (() => Promise<{ default: new (...args: any[]) => Dispatchable }>)

export interface PgBossConfig extends PgBoss.ConstructorOptions {
  /**
   * Graceful shutdown timeout in milliseconds
   */
  shutdownTimeoutMs?: number

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

  /**
   * Configurable directory paths for job discovery
   */
  paths?: {
    /**
     * Path to Dispatchable jobs directory
     * Default: 'app/jobs'
     */
    jobs?: string
    /**
     * Path to Schedulable jobs directory
     * Default: 'app/cron'
     */
    cron?: string
  }
}

/**
 * Re-export JobQueues interface for module augmentation
 */
export type { JobQueues } from './jobs_types.js'

/**
 * Helper type to infer queue names from config
 */
export type InferQueues<T extends PgBossConfig> = T['queues'] extends readonly string[]
  ? T['queues'][number]
  : string
