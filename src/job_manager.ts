/**
 * @hschmaiske/jobs
 *
 * @license MIT
 */

import PgBoss from 'pg-boss'
import type { ApplicationService, LoggerService } from '@adonisjs/core/types'
import type { PgBossConfig } from './types.js'
import type { Dispatchable } from './dispatchable.js'
import type { Schedulable } from './schedulable.js'

export class JobManager {
  #app: ApplicationService
  #logger: LoggerService
  #config: PgBossConfig
  #pgBoss: PgBoss | null = null

  constructor(config: PgBossConfig, logger: LoggerService, app: ApplicationService) {
    this.#config = config
    this.#logger = logger
    this.#app = app
  }

  /**
   * Ensure PgBoss is started
   */
  async #ensureStarted(): Promise<PgBoss> {
    if (!this.#pgBoss) {
      const environment = this.#app.getEnvironment()
      const isTestEnvironment = environment === 'test' || process.env.NODE_ENV === 'test'

      if (isTestEnvironment) {
        const { PgBossMock } = await import('./mocks/pg_boss_mock.js')
        this.#pgBoss = new PgBossMock() as unknown as PgBoss
      } else {
        this.#pgBoss = new PgBoss(this.#config)
      }

      await this.#pgBoss.start()
      this.#logger.info('PgBoss started')
    }
    return this.#pgBoss
  }

  /**
   * Extract job name from class name
   * CreateDatabaseJob -> 'create-database'
   */
  private getJobName<T extends Dispatchable | Schedulable>(
    JobClass: new (...args: any[]) => T
  ): string {
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

  /**
   * Dispatch a job with type-safe payload
   * Jobs are already registered via auto-discovery
   */
  async dispatch<T extends Dispatchable>(
    JobClass: new (...args: any[]) => T,
    payload: Parameters<T['handle']>[0],
    options?: PgBoss.SendOptions
  ): Promise<string | null> {
    const pgBoss = await this.#ensureStarted()
    const jobName = this.getJobName(JobClass)
    return pgBoss.send(jobName, payload as object, options || {})
  }

  /**
   * Register a Dispatchable job (called by auto-discovery)
   * This registers the worker that will process jobs
   */
  async registerDispatchable<T extends Dispatchable>(
    JobClass: new () => T,
    options?: PgBoss.WorkOptions
  ): Promise<void> {
    const pgBoss = await this.#ensureStarted()
    const jobName = this.getJobName(JobClass)
    const staticOptions = (JobClass as any).workOptions || {}
    const queue = (JobClass as any).queue || 'default'

    // Merge static options with provided options
    const workOptions = { ...staticOptions, ...options, queue }

    const handler = async (jobs: PgBoss.Job<object>[]) => {
      for (const job of jobs) {
        try {
          // Use container.make to get instance with dependency injection
          const instance = await this.#app.container.make(JobClass)

          // Inject internal dependencies (logger, etc.)
          instance.$injectInternal({ logger: this.#logger })

          // Use container.call to ensure proper context
          await this.#app.container.call(instance, 'handle' as any, [job.data])
        } catch (error) {
          this.#logger.error(`Job ${jobName} failed:`, error)
          throw error // Let pg-boss handle retry
        }
      }
    }

    await pgBoss.work(jobName, workOptions, handler)
    this.#logger.info(`Worker registered for job: ${jobName} on queue: ${queue}`)
  }

  /**
   * Register a Schedulable cron job (called by auto-discovery)
   * This sets up both the worker and the schedule
   */
  async registerSchedulable<T extends Schedulable>(
    CronClass: new () => T,
    options?: PgBoss.ScheduleOptions
  ): Promise<void> {
    const pgBoss = await this.#ensureStarted()
    const jobName = this.getJobName(CronClass)
    const schedule = (CronClass as unknown as { schedule?: string }).schedule
    const queue = (CronClass as any).queue || 'default'
    const scheduleOptions = (CronClass as any).scheduleOptions || {}

    if (!schedule) {
      throw new Error(`Schedulable class ${CronClass.name} must have static schedule property`)
    }

    // Register worker for cron execution
    const handler = async () => {
      try {
        // Use container.make to get instance with dependency injection
        const instance = await this.#app.container.make(CronClass)

        // Inject internal dependencies (logger, etc.)
        instance.$injectInternal({ logger: this.#logger })

        // Use container.call to ensure proper context
        await this.#app.container.call(instance, 'handle' as any, [])
      } catch (error) {
        this.#logger.error(`Cron job ${jobName} failed:`, error)
        throw error
      }
    }

    await pgBoss.work(jobName, {}, async () => {
      await handler()
    })

    // Schedule the cron job
    const finalOptions = { ...scheduleOptions, ...options, queue }
    await pgBoss.schedule(jobName, schedule, {}, finalOptions)
    this.#logger.info(
      `Scheduled cron job: ${jobName} with schedule: ${schedule} on queue: ${queue}`
    )
  }

  /**
   * Start processing jobs from a specific queue
   * This is used by the job:listen command
   */
  async process({ queueName = 'default' }: { queueName?: string } = {}) {
    await this.#ensureStarted()
    this.#logger.info(`Processing queue [${queueName}]...`)
    // The actual processing is handled by registered workers
    // This method just ensures PgBoss is started
    return this
  }

  /**
   * Get the raw PgBoss instance for advanced usage
   */
  get raw(): PgBoss {
    if (!this.#pgBoss) {
      throw new Error('JobManager not started. Call dispatch() or an async method first.')
    }
    return this.#pgBoss
  }

  /**
   * Get the raw PgBoss instance (alias for raw getter)
   */
  get instance(): PgBoss {
    return this.raw
  }

  /**
   * Get the raw PgBoss instance (async version ensures it's started)
   */
  async getRaw(): Promise<PgBoss> {
    return this.#ensureStarted()
  }

  /**
   * Start the job manager
   */
  async start(): Promise<void> {
    await this.#ensureStarted()
  }

  /**
   * Stop the job manager
   */
  async stop(): Promise<void> {
    if (this.#pgBoss) {
      await this.#pgBoss.stop()
      this.#logger.info('PgBoss stopped')
      this.#pgBoss = null
    }
  }

  /**
   * Close all connections (alias for stop)
   */
  async closeAll(): Promise<void> {
    await this.stop()
  }
}
