import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type PgBoss from 'pg-boss'
import type { Job } from './job.js'
import type { JobClass, PgBossConfig } from './types.js'

export class JobAutoDiscovery {
  constructor(
    private pgBoss: PgBoss,
    private config: PgBossConfig
  ) {}

  /**
   * Auto-discover and register all job classes from the configured path
   */
  async discover(): Promise<void> {
    // Validate defaultQueue if specified
    this.validateDefaultQueue()

    const jobsPath = this.config.jobsPath || 'app/jobs'
    const jobFiles = await this.scanJobFiles(jobsPath)

    for (const jobFile of jobFiles) {
      await this.registerJobFromFile(jobFile)
    }
  }

  /**
   * Recursively scan for job files
   */
  private async scanJobFiles(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          await this.scanJobFiles(fullPath, files)
        } else if (this.isJobFile(entry.name)) {
          files.push(fullPath)
        }
      }

      return files
    } catch (error) {
      // Directory doesn't exist - that's ok, no jobs to register
      return []
    }
  }

  /**
   * Check if file is a job file
   */
  private isJobFile(filename: string): boolean {
    return filename.endsWith('_job.ts') || filename.endsWith('_job.js')
  }

  /**
   * Register a job class from file path
   */
  private async registerJobFromFile(filePath: string): Promise<void> {
    try {
      const jobModule = await import(filePath)
      const JobClass = jobModule.default as JobClass

      if (!JobClass || typeof JobClass !== 'function') {
        return // Skip invalid exports
      }

      const jobName = this.getJobName(JobClass)
      const specifiedQueue = this.getJobQueue(JobClass)
      const queue = this.resolveQueue(specifiedQueue)
      const cron = this.getJobCron(JobClass)
      const workOptions = this.getWorkOptions(JobClass)
      const scheduleOptions = this.getScheduleOptions(JobClass)

      // Validate queue
      if (this.config.queues && !this.config.queues.includes(queue)) {
        throw new Error(
          `Invalid queue "${queue}" in ${filePath}. Available queues: ${this.config.queues.join(', ')}`
        )
      }

      // Register job worker with options
      if (workOptions) {
        await this.pgBoss.work(jobName, workOptions, async (jobs: any[]) => {
          for (const job of jobs) {
            const instance = new JobClass() as Job
            // Note: DI will be handled by the provider when container is available
            await instance.handle(job.data)
          }
        })
      } else {
        await this.pgBoss.work(jobName, async (jobs: any[]) => {
          for (const job of jobs) {
            const instance = new JobClass() as Job
            // Note: DI will be handled by the provider when container is available
            await instance.handle(job.data)
          }
        })
      }

      // Schedule if cron is specified with options
      if (cron) {
        if (scheduleOptions) {
          await this.pgBoss.schedule(jobName, cron, {}, scheduleOptions)
        } else {
          await this.pgBoss.schedule(jobName, cron, {})
        }
      }
    } catch (error) {
      console.error(`Failed to register job from ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Get job name from class (static jobName or kebab-case conversion)
   */
  private getJobName(JobClass: JobClass): string {
    // Check for static jobName property
    if ('jobName' in JobClass && typeof JobClass.jobName === 'string') {
      return JobClass.jobName
    }

    // Convert class name to kebab-case
    const className = JobClass.name
    return className
      .replace(/Job$/, '') // Remove 'Job' suffix
      .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab-case
      .toLowerCase()
  }

  /**
   * Get queue from job class static property
   */
  private getJobQueue(JobClass: JobClass): string | undefined {
    if ('queue' in JobClass && typeof JobClass.queue === 'string') {
      return JobClass.queue
    }
    return undefined
  }

  /**
   * Get cron schedule from job class static property
   */
  private getJobCron(JobClass: JobClass): string | undefined {
    if ('cron' in JobClass && typeof JobClass.cron === 'string') {
      return JobClass.cron
    }
    return undefined
  }

  /**
   * Get work options from job class static properties
   */
  private getWorkOptions(JobClass: JobClass): any {
    const options: any = {}

    // Add queue if specified
    if ('queue' in JobClass && typeof JobClass.queue === 'string') {
      options.queue = JobClass.queue
    }

    // Merge workOptions object if it exists
    if (
      'workOptions' in JobClass &&
      typeof JobClass.workOptions === 'object' &&
      JobClass.workOptions
    ) {
      Object.assign(options, JobClass.workOptions)
    }

    return Object.keys(options).length > 0 ? options : undefined
  }

  /**
   * Get schedule options from job class static properties
   */
  private getScheduleOptions(JobClass: JobClass): any {
    const options: any = {}

    // Add queue if specified
    if ('queue' in JobClass && typeof JobClass.queue === 'string') {
      options.queue = JobClass.queue
    }

    // Merge scheduleOptions object if it exists
    if (
      'scheduleOptions' in JobClass &&
      typeof JobClass.scheduleOptions === 'object' &&
      JobClass.scheduleOptions
    ) {
      Object.assign(options, JobClass.scheduleOptions)
    }

    return Object.keys(options).length > 0 ? options : undefined
  }

  /**
   * Resolve queue name using defaultQueue fallback
   */
  private resolveQueue(specifiedQueue?: string): string {
    if (specifiedQueue) {
      return specifiedQueue
    }

    // Use configured defaultQueue or fall back to 'default'
    return this.config.defaultQueue || 'default'
  }

  /**
   * Validate that defaultQueue exists in queues array
   */
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
