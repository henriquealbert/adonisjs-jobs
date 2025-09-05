/**
 * @hschmaiske/jobs
 *
 * @license MIT
 */

import PgBoss from 'pg-boss'
import { isClass } from '@sindresorhus/is'
import { RuntimeException } from '@poppinss/utils'
import type { ApplicationService, LoggerService } from '@adonisjs/core/types'
import type {
  PgBossConfig,
  AllowedJobTypes,
  JobHandlerConstructor,
  DispatchableJobType,
} from './types.js'

export class JobManager {
  #app: ApplicationService
  #logger: LoggerService
  #config: PgBossConfig
  #pgBoss: PgBoss | null = null
  #jobRegistry = new Map<JobHandlerConstructor, string>()
  #workers = new Map<string, { JobClass: JobHandlerConstructor; options?: PgBoss.WorkOptions }>()

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
    }
    return this.#pgBoss
  }

  /**
   * Resolve a job class from either a class or lazy import
   */
  async #resolveJob(job: AllowedJobTypes): Promise<JobHandlerConstructor> {
    if (isClass(job)) {
      return job as JobHandlerConstructor
    }

    const jobModule = await job()
    return jobModule['default'] || jobModule
  }

  /**
   * Get the filepath from internal registry (no $$filepath needed!)
   */
  #getJobPath(job: JobHandlerConstructor): string {
    const jobPath = this.#jobRegistry.get(job)
    if (!jobPath) {
      throw new RuntimeException(
        `Job ${job.name} not registered. Is it in the configured job directories?`
      )
    }
    return jobPath
  }

  /**
   * Register a job with its filepath and optionally create a worker
   */
  async registerJob(
    jobPath: string,
    JobClass: JobHandlerConstructor,
    options?: PgBoss.WorkOptions
  ): Promise<void> {
    this.#jobRegistry.set(JobClass, jobPath)

    if (options !== undefined) {
      await this.registerWorker(jobPath, JobClass, options)
    }
  }

  /**
   * Register a worker for a specific job path
   */
  async registerWorker(
    jobPath: string,
    JobClass: JobHandlerConstructor,
    options?: PgBoss.WorkOptions
  ): Promise<void> {
    const pgBoss = await this.#ensureStarted()

    await pgBoss.work(jobPath, options || {}, async (jobs: PgBoss.Job<any>[]) => {
      for (const job of jobs) {
        const instance = await this.#app.container.make(JobClass)
        await instance.handle(job.data)
      }
    })

    this.#workers.set(jobPath, { JobClass, options })
    this.#logger.info(`Registered worker for job: ${jobPath}`)
  }

  /**
   * Instantiate a job class with dependency injection
   */
  async #instantiateJob(job: { name: string; data: any }) {
    // Job name IS the filepath (like Romain's approach)
    const { default: jobClass } = await import(job.name)
    const jobInstance = await this.#app.container.make(jobClass)
    jobInstance.$injectInternal({ job, logger: this.#logger })
    return jobInstance
  }

  /**
   * Dispatch a job with type-safe payload (Dispatchable only)
   */
  async dispatch<T extends DispatchableJobType>(
    job: T,
    payload: any,
    options: PgBoss.SendOptions = {}
  ): Promise<string | null> {
    const pgBoss = await this.#ensureStarted()

    const jobClass = await this.#resolveJob(job)
    const jobPath = this.#getJobPath(jobClass)

    // Note: PgBoss SendOptions doesn't have a queue property
    // Jobs are sent using the file path as job name following @rlanz pattern

    // Use filepath as job name (exactly like Romain does)
    return pgBoss.send(jobPath, payload, options)
  }

  /**
   * Schedule a cron job
   */
  async schedule<T extends AllowedJobTypes>(
    job: T,
    schedule: string,
    payload: any = {},
    options: PgBoss.ScheduleOptions = {}
  ): Promise<void> {
    const pgBoss = await this.#ensureStarted()

    const jobClass = await this.#resolveJob(job)
    const jobPath = this.#getJobPath(jobClass)

    // Use filepath as job name (exactly like Romain does)
    await pgBoss.schedule(jobPath, schedule, payload, options)

    this.#logger.info(`Scheduled cron job: ${jobPath} with schedule: ${schedule}`)
  }

  /**
   * Schedule a cron job using direct job path (for auto-discovery)
   */
  async scheduleByPath(
    jobPath: string,
    schedule: string,
    queueName: string,
    payload: any = {},
    options: PgBoss.ScheduleOptions = {}
  ): Promise<void> {
    const pgBoss = await this.#ensureStarted()

    // Ensure the queue exists before scheduling
    try {
      await pgBoss.createQueue(queueName)
      this.#logger.info(`Created/verified queue: ${queueName}`)
    } catch (error) {
      this.#logger.warn(`Queue creation failed for ${queueName}: ${error.message}`)
      throw error
    }

    // PgBoss schedule params: (queueName, schedule, data, options)
    // We need to pass the job path in the data so the worker knows which job to execute
    const jobData = {
      ...payload,
      __jobPath: jobPath, // Include job path in payload
    }

    this.#logger.info(`Attempting to schedule: ${jobPath}`)
    this.#logger.info(`  Queue: ${queueName}`)
    this.#logger.info(`  Schedule: ${schedule}`)
    this.#logger.info(`  Data:`, jobData)
    this.#logger.info(`  Options:`, options)

    try {
      await pgBoss.schedule(queueName, schedule, jobData, options)
      this.#logger.info(`✅ Successfully scheduled cron job: ${jobPath} in queue: ${queueName}`)
    } catch (error) {
      this.#logger.error(`❌ Failed to schedule cron job: ${jobPath}`)
      this.#logger.error(`  Error: ${error.message}`)
      this.#logger.error(`  Stack:`, error.stack)
      throw error
    }
  }

  /**
   * Start processing jobs from a specific queue (matches Romain's pattern)
   */
  process({ queueName }: { queueName?: string }) {
    this.#logger.info(`Queue [${queueName || 'default'}] processing started...`)

    // Create a worker for all jobs (PgBoss pattern)
    this.#ensureStarted().then(async (pgBoss) => {
      await pgBoss.work('*', async (jobs: PgBoss.Job<any>[]) => {
        for (const job of jobs) {
          try {
            // Job name IS the filepath (like Romain's approach)
            const jobInstance = await this.#instantiateJob({
              name: job.name,
              data: job.data,
            })

            this.#logger.info(`Job ${job.name} started`)
            await this.#app.container.call(jobInstance, 'handle', [job.data])
            this.#logger.info(`Job ${job.name} finished`)
          } catch (error) {
            this.#logger.error(`Job ${job.name} failed:`, error)
            throw error
          }
        }
      })
    })

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
