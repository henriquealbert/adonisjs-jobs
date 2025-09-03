import type { ApplicationService } from '@adonisjs/core/types'
import type { LoggerService } from '@adonisjs/core/types'
import type PgBoss from 'pg-boss'
import type { PgBossConfig, WorkOptions, ScheduleOptions } from './types.js'
import type { Dispatchable } from './dispatchable.js'
import type { Schedulable } from './schedulable.js'

/**
 * JobManager provides a minimal wrapper around PgBoss for AdonisJS.
 *
 * Since Dispatchable and Schedulable classes auto-register (via static properties), users only need:
 * - dispatch() method for type-safe job dispatch
 * - raw property for direct PgBoss access
 *
 * Example:
 *   // Dispatchable classes auto-register workers
 *   export default class CreateDatabase extends Dispatchable {
 *     static queue = 'databases'
 *     async handle(payload) { ... }
 *   }
 *
 *   // Users dispatch jobs with type safety
 *   await jobs.dispatch(CreateDatabase, { name: 'mydb' })
 *   await jobs.raw.clearStorage() // Direct PgBoss for anything else
 */
export class JobManager {
  #pgBoss: PgBoss | null = null
  #app: ApplicationService
  #logger: LoggerService
  #config: PgBossConfig

  constructor(config: PgBossConfig, logger: LoggerService, app: ApplicationService) {
    this.#config = config
    this.#logger = logger
    this.#app = app
  }

  async initialize(): Promise<void> {
    const environment = this.#app.getEnvironment()
    const nodeEnv = process.env.NODE_ENV
    const isTestEnvironment = environment === 'test' || nodeEnv === 'test'

    if (isTestEnvironment) {
      const { PgBossMock } = await import('./mocks/pg_boss_mock.js')
      this.#pgBoss = new PgBossMock() as unknown as PgBoss
    } else {
      const PgBossClass = await import('pg-boss')
      this.#pgBoss = new PgBossClass.default(this.#config)
    }

    if (this.#config.autoStart !== false) {
      await this.start()
    }
  }

  get instance(): PgBoss {
    if (!this.#pgBoss) {
      throw new Error('JobManager not initialized. Call initialize() first.')
    }
    return this.#pgBoss
  }

  /**
   * Get the raw PgBoss instance for advanced usage.
   * This allows users to access any PgBoss API that may not be wrapped.
   */
  get raw(): PgBoss {
    return this.instance
  }

  async start(): Promise<void> {
    if (!this.#pgBoss) {
      throw new Error('JobManager not initialized. Call initialize() first.')
    }
    await this.#pgBoss.start()
    this.#logger.info('Job service started')
  }

  async stop(): Promise<void> {
    if (this.#pgBoss) {
      await this.#pgBoss.stop()
      this.#logger.info('Job service stopped')
    }
  }

  /**
   * Dispatch a job for immediate processing (type-safe)
   * @param JobClass Dispatchable job class
   * @param payload Job payload (type-safe based on handle method)
   * @param options PgBoss send options
   */
  async dispatch<T extends Dispatchable>(
    JobClass: new () => T,
    payload: Parameters<T['handle']>[0],
    options?: PgBoss.SendOptions
  ): Promise<string | null> {
    if (!this.#pgBoss) {
      throw new Error('JobManager not initialized')
    }
    const jobName = this.getJobName(JobClass)
    return this.#pgBoss.send(jobName, payload as object, options || {})
  }

  /**
   * Extract job name from class name
   * CreateDatabaseJob -> 'create-database'
   * @internal
   */
  private getJobName<T extends Dispatchable | Schedulable>(JobClass: new () => T): string {
    // Check for explicit jobName first
    const explicitName = (JobClass as unknown as { jobName?: string }).jobName
    if (explicitName) {
      return explicitName
    }

    // Convert class name to kebab-case
    let name = JobClass.name

    // Remove 'Job' or 'Cron' suffix
    name = name.replace(/Job$/, '').replace(/Cron$/, '')

    // Convert PascalCase to kebab-case
    return name
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
  }

  // === INTERNAL METHODS (used by framework, not end users) ===

  /** @internal Used by auto-discovery to register Dispatchable classes */
  async registerDispatchable<T extends Dispatchable>(
    JobClass: new () => T,
    options?: WorkOptions
  ): Promise<void> {
    const jobName = this.getJobName(JobClass)
    const handler = async (jobs: PgBoss.Job<object>[]) => {
      for (const job of jobs) {
        const instance = new JobClass()
        await instance.handle(job.data)
      }
    }

    await this.raw.work(jobName, options || {}, handler)
    this.#logger.info(`Worker registered for dispatchable job: ${jobName}`)
  }

  /** @internal Used by auto-discovery to register Schedulable classes */
  async registerSchedulable<T extends Schedulable>(
    CronClass: new () => T,
    options?: ScheduleOptions
  ): Promise<void> {
    const jobName = this.getJobName(CronClass)
    const schedule = (CronClass as unknown as { schedule?: string }).schedule

    if (!schedule) {
      throw new Error(`Schedulable class ${CronClass.name} must have static schedule property`)
    }

    // Register worker for cron execution
    const handler = async () => {
      const instance = new CronClass()
      await instance.handle()
    }

    await this.raw.work(jobName, {}, async () => {
      await handler()
    })

    // Schedule the cron job
    await this.raw.schedule(jobName, schedule, {}, options || {})
    this.#logger.info(`Scheduled cron job: ${jobName} with schedule: ${schedule}`)
  }

  async closeAll(): Promise<void> {
    await this.stop()
  }
}
