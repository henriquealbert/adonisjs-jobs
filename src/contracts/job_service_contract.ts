import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../types.js'
import type PgBoss from 'pg-boss'

/**
 * Base class for job service initialization strategies.
 * Following the Strategy pattern and Template Method pattern.
 */
export abstract class JobServiceInitializer {
  abstract initialize(app: ApplicationService, config: PgBossConfig): Promise<PgBoss> | PgBoss
}

/**
 * Base class for auto-discovery functionality.
 * Single Responsibility: Only handles job discovery logic.
 */
export abstract class JobAutoDiscoveryBase {
  abstract discover(): Promise<void>
}

/**
 * Base factory class for creating job service instances.
 * Following the Factory pattern.
 */
export abstract class JobServiceFactory {
  abstract createJobService(app: ApplicationService): PgBoss
  abstract createAutoDiscovery(
    pgBoss: PgBoss,
    app: ApplicationService,
    config: PgBossConfig
  ): JobAutoDiscoveryBase
}
