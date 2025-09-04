import type { PgBossConfig } from './types.js'
import type { LoggerService } from '@adonisjs/core/types'
import type { JobManager } from './job_manager.js'
import type { Dispatchable } from './dispatchable.js'
import type { Schedulable } from './schedulable.js'
import { JobFileScanner } from './job_file_scanner.js'
import { JobConfigExtractor } from './job_config_extractor.js'

export class JobAutoDiscovery {
  constructor(
    private fileScanner: JobFileScanner,
    private configExtractor: JobConfigExtractor,
    private jobManager: JobManager,
    private config: PgBossConfig,
    private logger: LoggerService
  ) {}

  async discover(): Promise<void> {
    this.validateDefaultQueue()

    // Discover dispatchable jobs
    const jobsPath = this.config.jobsPath || 'app/jobs'
    const jobFiles = await this.fileScanner.scanJobFiles(jobsPath)
    for (const jobFile of jobFiles) {
      await this.registerDispatchableFromFile(jobFile)
    }

    // Discover schedulable cron jobs
    const cronPath = this.config.cronPath || 'app/cron'
    const cronFiles = await this.fileScanner.scanCronFiles(cronPath)
    for (const cronFile of cronFiles) {
      await this.registerSchedulableFromFile(cronFile)
    }
  }

  private async registerDispatchableFromFile(filePath: string): Promise<void> {
    try {
      const JobClass = await this.importClass<Dispatchable>(filePath)
      if (!JobClass) return

      const jobConfig = this.configExtractor.extractJobConfig(JobClass)
      this.configExtractor.validateJobConfig(jobConfig, filePath)

      await this.jobManager.registerDispatchable(JobClass, jobConfig.workOptions)
    } catch (error) {
      this.logger.error(`Failed to register dispatchable job from ${filePath}:`, [error])
      throw error
    }
  }

  private async registerSchedulableFromFile(filePath: string): Promise<void> {
    try {
      const CronClass = await this.importClass<Schedulable>(filePath)
      if (!CronClass) return

      const jobConfig = this.configExtractor.extractCronConfig(CronClass)
      this.configExtractor.validateCronConfig(jobConfig, filePath)

      await this.jobManager.registerSchedulable(CronClass, jobConfig.scheduleOptions)
    } catch (error) {
      this.logger.error(`Failed to register schedulable cron from ${filePath}:`, [error])
      throw error
    }
  }

  private async importClass<T>(filePath: string): Promise<(new () => T) | null> {
    // Convert absolute path to file:// URL for proper ESM import
    const fileUrl = filePath.startsWith('/') ? `file://${filePath}` : filePath
    const jobModule = await import(fileUrl)
    const JobClass = jobModule.default as new () => T

    if (!JobClass || typeof JobClass !== 'function') {
      return null
    }

    return JobClass
  }

  private validateDefaultQueue(): void {
    if (this.config.defaultQueue && this.config.queues) {
      if (!this.config.queues.includes(this.config.defaultQueue)) {
        throw new Error(
          `Invalid defaultQueue "${this.config.defaultQueue}". Must be one of: ${this.config.queues.join(', ')}`
        )
      }
    }
  }
}
