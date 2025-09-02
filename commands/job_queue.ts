import { args, flags } from '@adonisjs/core/ace'
import { BaseWorkerCommand } from './base_worker_command.js'
import type PgBoss from 'pg-boss'

export default class JobQueue extends BaseWorkerCommand {
  static commandName = 'job:queue'
  static description = 'Process jobs from a specific queue'

  @args.string({ description: 'Queue name to process' })
  declare name: string

  @flags.number({ description: 'Batch size for processing', default: 1 })
  declare batchSize: number

  protected logWorkerStart(): void {
    this.logger.info(`🎯 Processing jobs from queue: "${this.name}"`)
    this.logger.info(`Concurrency: ${this.concurrency}, Batch: ${this.batchSize}`)
  }

  protected async configureWorker(): Promise<void> {
    await this.pgBoss.work(
      this.name,
      {
        batchSize: this.batchSize,
        pollingIntervalSeconds: Math.floor(this.interval / 1000),
      },
      async (jobs: PgBoss.Job[]) => {
        this.logger.info(`📦 Processing ${jobs.length} job(s) from "${this.name}"`)

        for (const job of jobs) {
          try {
            this.logger.debug(`⚙️  Job ${job.id}: ${JSON.stringify(job.data)}`)

            await this.pgBoss.complete(this.name, job.id)
            this.logger.success(`✅ Completed job ${job.id}`)
          } catch (error) {
            this.logger.error(`❌ Failed job ${job.id}:`, error)
            await this.pgBoss.fail(this.name, job.id, error as Error)
          }
        }
      }
    )

    this.logger.success(`✅ Queue worker started for "${this.name}"`)
  }
}
