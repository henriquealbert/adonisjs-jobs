import type { JobClass, PgBossConfig, WorkOptions, ScheduleOptions } from './types.js'

export interface JobConfig {
  jobName: string
  queue: string
  cron?: string
  workOptions?: WorkOptions
  scheduleOptions?: ScheduleOptions
}

export class JobConfigExtractor {
  constructor(private config: PgBossConfig) {}

  extractJobConfig(JobClass: JobClass): JobConfig {
    const jobName = this.getJobName(JobClass)
    const specifiedQueue = this.getJobQueue(JobClass)
    const queue = this.resolveQueue(specifiedQueue)
    const cron = this.getJobCron(JobClass)
    const workOptions = this.getWorkOptions(JobClass)
    const scheduleOptions = this.getScheduleOptions(JobClass)

    return {
      jobName,
      queue,
      cron,
      workOptions,
      scheduleOptions,
    }
  }

  validateJobConfig(config: JobConfig, filePath: string): void {
    if (this.config.queues && !this.config.queues.includes(config.queue)) {
      throw new Error(
        `Invalid queue "${config.queue}" in ${filePath}. Available queues: ${this.config.queues.join(', ')}`
      )
    }
  }

  private getJobName(JobClass: JobClass): string {
    if ('jobName' in JobClass && typeof JobClass.jobName === 'string') {
      return JobClass.jobName
    }

    const className = JobClass.name
    return className
      .replace(/Job$/, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
  }

  private getJobQueue(JobClass: JobClass): string | undefined {
    if ('queue' in JobClass && typeof JobClass.queue === 'string') {
      return JobClass.queue
    }
    return undefined
  }

  private getJobCron(JobClass: JobClass): string | undefined {
    if ('cron' in JobClass && typeof JobClass.cron === 'string') {
      return JobClass.cron
    }
    return undefined
  }

  private getWorkOptions(JobClass: JobClass): WorkOptions | undefined {
    const options: Partial<WorkOptions> = {}

    if ('queue' in JobClass && typeof JobClass.queue === 'string') {
      options.queue = JobClass.queue
    }

    if (
      'workOptions' in JobClass &&
      typeof JobClass.workOptions === 'object' &&
      JobClass.workOptions
    ) {
      Object.assign(options, JobClass.workOptions)
    }

    return Object.keys(options).length > 0 ? (options as WorkOptions) : undefined
  }

  private getScheduleOptions(JobClass: JobClass): ScheduleOptions | undefined {
    const options: Partial<ScheduleOptions> = {}

    if ('queue' in JobClass && typeof JobClass.queue === 'string') {
      options.queue = JobClass.queue
    }

    if (
      'scheduleOptions' in JobClass &&
      typeof JobClass.scheduleOptions === 'object' &&
      JobClass.scheduleOptions
    ) {
      Object.assign(options, JobClass.scheduleOptions)
    }

    return Object.keys(options).length > 0 ? (options as ScheduleOptions) : undefined
  }

  private resolveQueue(specifiedQueue?: string): string {
    if (specifiedQueue) {
      return specifiedQueue
    }
    return this.config.defaultQueue || 'default'
  }
}
