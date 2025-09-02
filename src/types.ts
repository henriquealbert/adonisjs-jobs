import type PgBoss from 'pg-boss'

export type {
  ConstructorOptions,
  SendOptions,
  ScheduleOptions,
  JobWithMetadata,
  Job,
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
}
