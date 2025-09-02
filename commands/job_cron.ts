import type { CommandOptions } from '@adonisjs/core/types/ace'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type PgBoss from 'pg-boss'

export default class JobCron extends BaseCommand {
  static commandName = 'job:cron'
  static description = 'Process cron/scheduled jobs only'
  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  @flags.number({ description: 'Monitoring interval in seconds', default: 30 })
  declare interval: number

  @flags.boolean({ description: 'Enable verbose logging', default: false })
  declare verbose: boolean

  async run() {
    const pgBoss = (await this.app.container.make('pgboss')) as PgBoss
    const router = await this.app.container.make('router')
    router.commit()

    this.logger.info('📅 Processing cron/scheduled jobs only')

    try {
      // Ensure pg-boss is started
      await pgBoss.start()
      this.logger.success('✅ Cron job worker started successfully')

      // Monitor scheduled jobs
      const monitorInterval = setInterval(async () => {
        try {
          if (this.verbose) {
            const queueSize = await pgBoss.getQueueSize('__default__')
            this.logger.debug(`📊 Scheduled jobs activity: ${queueSize}`)
          } else {
            this.logger.debug('🔍 Monitoring scheduled jobs...')
          }
        } catch (error) {
          this.logger.debug('No scheduled jobs detected')
        }
      }, this.interval * 1000)

      this.logger.info('🕐 Monitoring cron/scheduled jobs...')
      this.logger.info('💡 Tip: pg-boss automatically processes scheduled jobs when due')

      // Cleanup interval on shutdown
      const cleanup = () => {
        clearInterval(monitorInterval)
      }

      // Graceful shutdown
      const shutdown = async () => {
        this.logger.info('🛑 Shutting down cron worker...')
        cleanup()
        await pgBoss.stop()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    } catch (error) {
      this.logger.error('❌ Failed to start cron worker:', error)
      process.exit(1)
    }

    // Keep alive
    this.logger.info('✋ Press Ctrl+C to stop.')
    await new Promise(() => {})
  }
}
