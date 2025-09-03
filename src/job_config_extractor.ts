import type { PgBossConfig, WorkOptions, ScheduleOptions } from './types.js'
import type { Dispatchable } from './dispatchable.js'
import type { Schedulable } from './schedulable.js'

export interface JobConfig {
  jobName: string
  queue: string
  workOptions?: WorkOptions
}

export interface CronConfig {
  jobName: string
  queue: string
  schedule: string
  scheduleOptions?: ScheduleOptions
}

export class JobConfigExtractor {
  constructor(private config: PgBossConfig) {}

  extractJobConfig(JobClass: new () => Dispatchable): JobConfig {
    const jobName = this.getJobName(JobClass)
    const specifiedQueue = this.getJobQueue(JobClass)
    const queue = this.resolveQueue(specifiedQueue)
    const workOptions = this.getWorkOptions(JobClass)

    return {
      jobName,
      queue,
      workOptions,
    }
  }

  extractCronConfig(CronClass: new () => Schedulable): CronConfig {
    const jobName = this.getJobName(CronClass)
    const specifiedQueue = this.getJobQueue(CronClass)
    const queue = this.resolveQueue(specifiedQueue)
    const schedule = this.getSchedule(CronClass)
    const scheduleOptions = this.getScheduleOptions(CronClass)

    if (!schedule) {
      throw new Error(`Schedulable class ${CronClass.name} must have static schedule property`)
    }

    return {
      jobName,
      queue,
      schedule,
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

  validateCronConfig(config: CronConfig, filePath: string): void {
    if (this.config.queues && !this.config.queues.includes(config.queue)) {
      throw new Error(
        `Invalid queue "${config.queue}" in ${filePath}. Available queues: ${this.config.queues.join(', ')}`
      )
    }
  }

  private getJobName(JobClass: new () => Dispatchable | Schedulable): string {
    if ('jobName' in JobClass && typeof JobClass.jobName === 'string') {
      return JobClass.jobName
    }

    // Convert class name to kebab-case
    let name = JobClass.name
    // Remove Job/Cron suffix
    name = name.replace(/Job$/, '').replace(/Cron$/, '')
    return name
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
  }

  private getJobQueue(JobClass: new () => Dispatchable | Schedulable): string | undefined {
    if ('queue' in JobClass && typeof JobClass.queue === 'string') {
      return JobClass.queue
    }
    return undefined
  }

  private getSchedule(CronClass: new () => Schedulable): string | undefined {
    if ('schedule' in CronClass && typeof CronClass.schedule === 'string') {
      return CronClass.schedule
    }
    return undefined
  }

  private getWorkOptions(JobClass: new () => Dispatchable): WorkOptions | undefined {
    if (
      'workOptions' in JobClass &&
      typeof JobClass.workOptions === 'object' &&
      JobClass.workOptions
    ) {
      return JobClass.workOptions
    }
    return undefined
  }

  private getScheduleOptions(CronClass: new () => Schedulable): ScheduleOptions | undefined {
    if (
      'scheduleOptions' in CronClass &&
      typeof CronClass.scheduleOptions === 'object' &&
      CronClass.scheduleOptions
    ) {
      return CronClass.scheduleOptions
    }
    return undefined
  }

  private resolveQueue(specifiedQueue?: string): string {
    if (specifiedQueue) {
      return specifiedQueue
    }
    return this.config.defaultQueue || 'default'
  }
}
