import type { CommandOptions } from '@adonisjs/core/types/ace'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type PgBoss from 'pg-boss'

export default class JobQueue extends BaseCommand {
  static commandName = 'job:queue'
  static description = 'Process jobs from a specific queue'
  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  @args.string({ description: 'Queue name to process' })
  declare name: string

  @flags.number({ description: 'Number of concurrent jobs', default: 5 })
  declare concurrency: number

  @flags.number({ description: 'Batch size for processing', default: 1 })
  declare batchSize: number

  @flags.number({ description: 'Polling interval in milliseconds', default: 2000 })
  declare interval: number

  async run() {
    const pgBoss = (await this.app.container.make('pgboss')) as PgBoss
    const router = await this.app.container.make('router')
    router.commit()

    this.logger.info(`🎯 Processing jobs from queue: "${this.name}"`)
    this.logger.info(`Concurrency: ${this.concurrency}, Batch: ${this.batchSize}`)

    try {
      await pgBoss.work(
        this.name,
        {
          batchSize: this.batchSize,
          pollingIntervalSeconds: Math.floor(this.interval / 1000),
        },
        async (jobs) => {
          this.logger.info(`📦 Processing ${jobs.length} job(s) from "${this.name}"`)

          for (const job of jobs) {
            try {
              this.logger.debug(`⚙️  Job ${job.id}: ${JSON.stringify(job.data)}`)

              await pgBoss.complete(this.name, job.id)
              this.logger.success(`✅ Completed job ${job.id}`)
            } catch (error) {
              this.logger.error(`❌ Failed job ${job.id}:`, error)
              await pgBoss.fail(this.name, job.id, error as Error)
            }
          }
        }
      )

      this.logger.success(`✅ Queue worker started for "${this.name}"`)
    } catch (error) {
      this.logger.error(`❌ Failed to start queue worker for "${this.name}":`, error)
      process.exit(1)
    }

    const shutdown = async () => {
      this.logger.info(`🛑 Shutting down queue worker for "${this.name}"...`)
      await pgBoss.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    this.logger.info('✋ Press Ctrl+C to stop.')
    await new Promise(() => {})
  }
}
