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

    // Trigger auto-discovery before starting job processing
    this.logger.info('🔍 Discovering jobs...')
    const { JobDiscovery } = await import('../src/job_discovery.js')
    const discovery = new JobDiscovery(this.app)
    await discovery.discoverAll(jobs)
    this.logger.info('✅ Job discovery completed')

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
