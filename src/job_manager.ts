import type { ApplicationService } from '@adonisjs/core/types'
import type { LoggerService } from '@adonisjs/core/types'
import type PgBoss from 'pg-boss'
import type { PgBossConfig, JobClass, WorkOptions, ScheduleOptions } from './types.js'

/**
 * JobManager provides a minimal wrapper around PgBoss for AdonisJS.
 *
 * Since Job classes auto-register (via static properties), users only need:
 * - send() methods to dispatch jobs
 * - raw property for direct PgBoss access
 *
 * Example:
 *   // Job classes auto-register workers and cron schedules
 *   export default class CreateDatabase extends Job {
 *     static queue = 'databases'
 *     async handle(payload) { ... }
 *   }
 *
 *   // Users just send jobs
 *   await jobs.send('create-database', { name: 'mydb' })
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
   * Send a job for immediate processing
   * @param name Job name (matching Job class)
   * @param data Job payload
   * @param options PgBoss send options
   */
  async send(name: string, data?: object, options?: PgBoss.SendOptions): Promise<string | null> {
    if (!this.#pgBoss) {
      throw new Error('JobManager not initialized')
    }
    return this.#pgBoss.send(name, data || {}, options || {})
  }

  /**
   * Send a job to run after a delay
   * @param name Job name (matching Job class)
   * @param delay Delay in seconds, date string, or Date object
   * @param data Job payload
   * @param options PgBoss send options
   */
  async sendAfter(
    name: string,
    delay: number | string | Date,
    data?: object,
    options?: PgBoss.SendOptions
  ): Promise<string | null> {
    if (!this.#pgBoss) {
      throw new Error('JobManager not initialized')
    }
    const afterDate = typeof delay === 'number' ? new Date(Date.now() + delay * 1000) : delay
    return this.#pgBoss.send(name, data || {}, { ...options, startAfter: afterDate })
  }

  // === INTERNAL METHODS (used by framework, not end users) ===

  /** @internal Used by auto-discovery to register Job classes */
  async work(
    name: string,
    JobClassOrHandler: JobClass | PgBoss.WorkHandler<object>,
    options?: WorkOptions
  ): Promise<void> {
    const handler =
      typeof JobClassOrHandler === 'function' && !JobClassOrHandler.prototype?.handle
        ? (JobClassOrHandler as PgBoss.WorkHandler<object>)
        : async (jobs: PgBoss.Job<object>[]) => {
            for (const job of jobs) {
              const JobConstructor = JobClassOrHandler as JobClass
              const instance = new JobConstructor()
              await instance.handle(job.data)
            }
          }

    await this.raw.work(name, options || {}, handler)
    this.#logger.info(`Worker registered for job: ${name}`)
  }

  /** @internal Used by auto-discovery to schedule cron jobs */
  async schedule(
    name: string,
    cron: string,
    data?: object,
    options?: ScheduleOptions
  ): Promise<void> {
    await this.raw.schedule(name, cron, data || {}, options || {})
    this.#logger.info(`Scheduled job: ${name} with cron: ${cron}`)
  }

  async closeAll(): Promise<void> {
    await this.stop()
  }
}
