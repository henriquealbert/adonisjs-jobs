import { flags } from '@adonisjs/core/ace'
import { BaseWorkerCommand } from './base_worker_command.js'

export default class JobListen extends BaseWorkerCommand {
  static commandName = 'job:listen'
  static description = 'Process all registered jobs from all queues'

  @flags.boolean({ description: 'Enable verbose logging', default: false })
  declare verbose: boolean

  private monitorInterval?: NodeJS.Timeout

  protected logWorkerStart(): void {
    this.logger.info('🚀 Starting worker to process ALL jobs')
    this.logger.info(`Concurrency: ${this.concurrency}`)
  }

  protected async configureWorker(): Promise<void> {
    await this.pgBoss.start()

    if (this.verbose) {
      this.setupMonitoring()
    }

    this.logger.info('🔄 Worker is processing all registered jobs...')
    this.logger.info('💡 Tip: Use job:queue <name> to process specific queues only')
  }

  private setupMonitoring(): void {
    this.monitorInterval = setInterval(async () => {
      try {
        const queueSize = await this.pgBoss.getQueueSize('__default__')
        this.logger.debug(`Queue activity: ${queueSize} jobs`)
      } catch (error) {
        this.logger.debug('No queue activity detected')
      }
    }, 30000)

    const cleanup = () => {
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval)
      }
    }
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  }
}
