import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../src/types.js'
import PgBoss from 'pg-boss'

// Type alias for better naming
export type JobService = PgBoss

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'pgboss': PgBoss
    'hschmaiske/jobs': JobService
  }
}

export default class JobsProvider {
  #pgBoss: PgBoss | null = null

  constructor(protected app: ApplicationService) {}

  register(): void {
    // Register the core pgboss instance
    this.app.container.singleton('pgboss', () => {
      const config = this.app.config.get<PgBossConfig>('jobs', {})
      this.#pgBoss = new PgBoss(config)
      return this.#pgBoss
    })

    // Register the jobs service (with auto-discovery)
    this.app.container.singleton('hschmaiske/jobs', async () => {
      const pgBoss = await this.app.container.make('pgboss')
      const config = this.app.config.get<PgBossConfig>('jobs', {})

      // Only run auto-discovery if not in test environment and enabled
      if (this.app.getEnvironment() !== 'test' && config.enabled !== false) {
        try {
          const { JobAutoDiscovery } = await import('../src/auto_discovery.js')
          const { JobFileScanner } = await import('../src/job_file_scanner.js')
          const { JobConfigExtractor } = await import('../src/job_config_extractor.js')
          const { JobWorkerManager } = await import('../src/job_worker_manager.js')

          const logger = await this.app.container.make('logger')
          const fileScanner = new JobFileScanner()
          const configExtractor = new JobConfigExtractor(config)
          const workerManager = new JobWorkerManager(pgBoss, this.app)
          const autoDiscovery = new JobAutoDiscovery(
            fileScanner,
            configExtractor,
            workerManager,
            config,
            logger
          )
          await autoDiscovery.discover()
        } catch (error) {
          console.error('Jobs auto-discovery failed:', error)
        }
      }

      return pgBoss
    })
  }

  async start(): Promise<void> {
    if (this.#pgBoss && this.app.getEnvironment() !== 'test') {
      const config = this.app.config.get<PgBossConfig>('jobs', {})

      if (config.enabled !== false) {
        await this.#pgBoss.start()
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.#pgBoss) {
      await this.#pgBoss.stop()
    }
  }
}
