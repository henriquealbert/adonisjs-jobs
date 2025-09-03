import type { JobClass, PgBossConfig } from './types.js'
import type { LoggerService } from '@adonisjs/core/types'
import type { JobManager } from './job_manager.js'
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

    const jobsPath = this.config.jobsPath || 'app/jobs'
    const jobFiles = await this.fileScanner.scanJobFiles(jobsPath)

    for (const jobFile of jobFiles) {
      await this.registerJobFromFile(jobFile)
    }
  }

  private async registerJobFromFile(filePath: string): Promise<void> {
    try {
      const JobClass = await this.importJobClass(filePath)
      if (!JobClass) return

      const jobConfig = this.configExtractor.extractJobConfig(JobClass)
      this.configExtractor.validateJobConfig(jobConfig, filePath)

      await this.jobManager.work(jobConfig.jobName, JobClass, jobConfig.workOptions)
      if (jobConfig.cron) {
        await this.jobManager.schedule(
          jobConfig.jobName,
          jobConfig.cron,
          {},
          jobConfig.scheduleOptions
        )
      }
    } catch (error) {
      this.logger.error(`Failed to register job from ${filePath}:`, [error])
      throw error
    }
  }

  private async importJobClass(filePath: string): Promise<JobClass | null> {
    const jobModule = await import(filePath)
    const JobClass = jobModule.default as JobClass

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
