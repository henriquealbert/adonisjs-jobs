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
      // First import to get the class and its $$filepath
      const JobClass = await this.importClassInitial<Dispatchable>(filePath)
      if (!JobClass) return

      // Check if the class has $$filepath property - this is required
      const hasFilepath = this.hasFilepathProperty(JobClass)
      if (!hasFilepath) {
        throw new Error(
          `Job class from ${filePath} is missing required static $$filepath property. Add: static get $$filepath() { return import.meta.url }`
        )
      }

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
      // First import to get the class and its $$filepath
      const CronClass = await this.importClassInitial<Schedulable>(filePath)
      if (!CronClass) return

      // Check if the class has $$filepath property - this is required
      const hasFilepath = this.hasFilepathProperty(CronClass)
      if (!hasFilepath) {
        throw new Error(
          `Cron class from ${filePath} is missing required static $$filepath property. Add: static get $$filepath() { return import.meta.url }`
        )
      }

      const jobConfig = this.configExtractor.extractCronConfig(CronClass)
      this.configExtractor.validateCronConfig(jobConfig, filePath)

      await this.jobManager.registerSchedulable(CronClass, jobConfig.scheduleOptions)
    } catch (error) {
      this.logger.error(`Failed to register schedulable cron from ${filePath}:`, [error])
      throw error
    }
  }

  private async importClassInitial<T>(filePath: string): Promise<(new () => T) | null> {
    try {
      // Convert absolute path to file:// URL for proper ESM import
      const fileUrl = filePath.startsWith('/') ? `file://${filePath}` : filePath
      const jobModule = await import(fileUrl)
      const JobClass = jobModule.default as new () => T

      if (!JobClass || typeof JobClass !== 'function') {
        return null
      }

      return JobClass
    } catch (error) {
      this.logger.error(`Failed to import ${filePath}: ${error.message}`)
      throw error
    }
  }

  private hasFilepathProperty(JobClass: any): boolean {
    try {
      // Check if the class has the $$filepath getter
      return typeof JobClass.$$filepath === 'string'
    } catch {
      return false
    }
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
