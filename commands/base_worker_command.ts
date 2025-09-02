import type { CommandOptions } from '@adonisjs/core/types/ace'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type PgBoss from 'pg-boss'

export abstract class BaseWorkerCommand extends BaseCommand {
  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  @flags.number({ description: 'Number of concurrent jobs to process', default: 5 })
  declare concurrency: number

  @flags.number({ description: 'Polling interval in milliseconds', default: 2000 })
  declare interval: number

  protected pgBoss!: PgBoss

  async run() {
    await this.initializeServices()
    await this.startWorker()
    this.setupGracefulShutdown()
    await this.keepAlive()
  }

  private async initializeServices(): Promise<void> {
    this.pgBoss = (await this.app.container.make('pgboss')) as PgBoss
    const router = await this.app.container.make('router')
    router.commit()
  }

  private async startWorker(): Promise<void> {
    this.logWorkerStart()

    try {
      await this.configureWorker()
      this.logger.success('✅ Worker started successfully')
    } catch (error) {
      this.logger.error('❌ Failed to start worker:', error)
      process.exit(1)
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      this.logger.info('🛑 Gracefully shutting down worker...')
      await this.pgBoss.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    this.logger.info('✋ Press Ctrl+C to stop.')
  }

  private async keepAlive(): Promise<never> {
    await new Promise(() => {})
    return undefined as never
  }

  protected abstract logWorkerStart(): void
  protected abstract configureWorker(): Promise<void>
}
