import type { CommandOptions } from '@adonisjs/core/types/ace'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type PgBoss from 'pg-boss'

export default class JobListen extends BaseCommand {
  static commandName = 'job:listen'
  static description = 'Process all registered jobs from all queues'
  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  @flags.number({ description: 'Number of concurrent jobs to process', default: 5 })
  declare concurrency: number

  @flags.number({ description: 'Polling interval in milliseconds', default: 2000 })
  declare interval: number

  @flags.boolean({ description: 'Enable verbose logging', default: false })
  declare verbose: boolean

  async run() {
    const pgBoss = (await this.app.container.make('pgboss')) as PgBoss
    const router = await this.app.container.make('router')
    router.commit()

    this.logger.info('🚀 Starting worker to process ALL jobs')
    this.logger.info(`Concurrency: ${this.concurrency}`)

    try {
      // Ensure pg-boss is started
      await pgBoss.start()
      this.logger.success('✅ Job worker started successfully')

      // Monitor all activity
      if (this.verbose) {
        const monitorInterval = setInterval(async () => {
          try {
            const queueSize = await pgBoss.getQueueSize('__default__')
            this.logger.debug(`Queue activity: ${queueSize} jobs`)
          } catch (error) {
            this.logger.debug('No queue activity detected')
          }
        }, 30000)

        // Cleanup on shutdown
        const cleanup = () => {
          clearInterval(monitorInterval)
        }
        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)
      }

      this.logger.info('🔄 Worker is processing all registered jobs...')
      this.logger.info('💡 Tip: Use job:queue <name> to process specific queues only')
    } catch (error) {
      this.logger.error('❌ Failed to start job worker:', error)
      process.exit(1)
    }

    // Graceful shutdown
    const shutdown = async () => {
      this.logger.info('🛑 Gracefully shutting down job worker...')
      await pgBoss.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Keep alive
    this.logger.info('✋ Press Ctrl+C to stop.')
    await new Promise(() => {})
  }
}
