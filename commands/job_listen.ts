/**
 * @hschmaiske/jobs
 *
 * @license MIT
 */

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { PgBossConfig } from '../src/types.js'

export default class JobListen extends BaseCommand {
  static commandName = 'job:listen'
  static description = 'Listen to one or multiple queues'

  @flags.array({ alias: 'q', description: 'The queue(s) to listen on' })
  declare queue: string[]

  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  async run() {
    const config = this.app.config.get<PgBossConfig>('jobs')
    const jobs = await this.app.container.make('hschmaiske/jobs' as any)
    const router = await this.app.container.make('router')
    router.commit()

    // Auto-discover and register jobs and cron jobs
    this.logger.info('🔍 Discovering and registering jobs...')
    const { JobAutoDiscovery } = await import('../src/auto_discovery.js')
    const { JobFileScanner } = await import('../src/job_file_scanner.js')
    const { JobConfigExtractor } = await import('../src/job_config_extractor.js')

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor(config)
    const logger = await this.app.container.make('logger')
    const autoDiscovery = new JobAutoDiscovery(fileScanner, configExtractor, jobs, config, logger)

    await autoDiscovery.discover()

    let shouldListenOn = this.parsed.flags.queue as string[]

    if (!shouldListenOn) {
      // Listen to all configured queues or default
      shouldListenOn = config.queues ? [...config.queues] : ['default']
    }

    this.logger.info(`🚀 Starting job processing for queues: ${shouldListenOn.join(', ')}`)

    await Promise.all(
      shouldListenOn.map((queueName) =>
        jobs.process({
          queueName,
        })
      )
    )

    this.logger.info('✅ Job processing started. Press Ctrl+C to stop.')
  }
}
