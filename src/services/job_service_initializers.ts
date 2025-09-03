import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../types.js'
import { JobServiceInitializer } from '../contracts/job_service_contract.js'
import type PgBoss from 'pg-boss'
import { PgBossMock } from '../mocks/pg_boss_mock.js'

/**
 * Production job service initializer.
 * Single Responsibility: Initialize PgBoss for production environments.
 */
export class ProductionJobServiceInitializer extends JobServiceInitializer {
  async initialize(app: ApplicationService, config: PgBossConfig): Promise<PgBoss> {
    const PgBossClass = await import('pg-boss')
    const pgBoss = new PgBossClass.default(config)

    // Run auto-discovery if enabled
    if (config.enabled !== false) {
      await this.runAutoDiscovery(pgBoss, app, config)
    }

    return pgBoss
  }

  private async runAutoDiscovery(
    pgBoss: PgBoss,
    app: ApplicationService,
    config: PgBossConfig
  ): Promise<void> {
    try {
      const { JobAutoDiscovery } = await import('../auto_discovery.js')
      const { JobFileScanner } = await import('../job_file_scanner.js')
      const { JobConfigExtractor } = await import('../job_config_extractor.js')
      const { JobWorkerManager } = await import('../job_worker_manager.js')

      const logger = await app.container.make('logger')
      const fileScanner = new JobFileScanner()
      const configExtractor = new JobConfigExtractor(config)
      const workerManager = new JobWorkerManager(pgBoss, app)
      const autoDiscovery = new JobAutoDiscovery(
        fileScanner,
        configExtractor,
        workerManager,
        config,
        logger
      )
      await autoDiscovery.discover()
    } catch (error) {
      const logger = await app.container.make('logger').catch(() => null)
      if (logger) {
        ;(logger as { error: (msg: string, data?: unknown[]) => void }).error(
          'Jobs auto-discovery failed:',
          [error]
        )
      } else {
        console.error('Jobs auto-discovery failed:', error)
      }
    }
  }
}

/**
 * Test job service initializer.
 * Single Responsibility: Provide mock PgBoss for test environments.
 */
export class TestJobServiceInitializer extends JobServiceInitializer {
  initialize(): PgBoss {
    return new PgBossMock() as unknown as PgBoss
  }
}
