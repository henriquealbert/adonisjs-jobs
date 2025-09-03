import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../types.js'
import { JobServiceFactory, JobAutoDiscoveryBase } from '../contracts/job_service_contract.js'
import type PgBoss from 'pg-boss'
import {
  ProductionJobServiceInitializer,
  TestJobServiceInitializer,
} from '../services/job_service_initializers.js'

class NoOpAutoDiscovery extends JobAutoDiscoveryBase {
  async discover(): Promise<void> {
    // No-op for test environments
  }
}

export class EnvironmentJobServiceFactory extends JobServiceFactory {
  constructor(_app: ApplicationService) {
    super()
  }

  createJobService(app: ApplicationService): PgBoss {
    const environment = app.getEnvironment()
    const nodeEnv = process.env.NODE_ENV
    const isTestEnvironment = environment === 'test' || nodeEnv === 'test'

    if (isTestEnvironment) {
      const initializer = new TestJobServiceInitializer()
      return initializer.initialize()
    }

    const config = app.config.get<PgBossConfig>('jobs', {})
    const initializer = new ProductionJobServiceInitializer()

    return this.createLazyPgBoss(() => initializer.initialize(app, config))
  }

  private createLazyPgBoss(factory: () => Promise<PgBoss>): PgBoss {
    let pgBossInstance: PgBoss | null = null
    let initPromise: Promise<PgBoss> | null = null

    const lazyInitialize = async (): Promise<PgBoss> => {
      if (pgBossInstance) return pgBossInstance
      if (!initPromise) {
        initPromise = factory()
      }
      pgBossInstance = await initPromise
      return pgBossInstance
    }

    return new Proxy({} as PgBoss, {
      get(target, prop) {
        if (typeof prop === 'string') {
          return async (...args: unknown[]) => {
            const instance = await lazyInitialize()
            const method = (instance as unknown as Record<string, unknown>)[prop]
            if (typeof method === 'function') {
              return method.apply(instance, args)
            }
            return method
          }
        }
        return (target as unknown as Record<PropertyKey, unknown>)[prop]
      },
    })
  }

  createAutoDiscovery(
    _pgBoss: PgBoss,
    _app: ApplicationService,
    _config: PgBossConfig
  ): JobAutoDiscoveryBase {
    // This is a placeholder - in production this would be handled by ProductionJobServiceInitializer
    // In tests, no auto-discovery is needed
    return new NoOpAutoDiscovery()
  }
}

export class SingletonJobServiceFactory {
  private static instance: PgBoss | null = null

  static create(app: ApplicationService): PgBoss {
    if (!SingletonJobServiceFactory.instance) {
      const factory = new EnvironmentJobServiceFactory(app)
      SingletonJobServiceFactory.instance = factory.createJobService(app)
    }
    return SingletonJobServiceFactory.instance
  }

  static reset(): void {
    SingletonJobServiceFactory.instance = null
  }
}
