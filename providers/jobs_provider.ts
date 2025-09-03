import type { ApplicationService } from '@adonisjs/core/types'
import type PgBoss from 'pg-boss'
import { EnvironmentJobServiceFactory } from '../src/factories/job_service_factory.js'
import { JobLifecycleManager } from '../src/services/job_lifecycle_manager.js'

// Type alias for better naming
export type JobService = PgBoss

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'pgboss': PgBoss
    'hschmaiske/jobs': JobService
  }
}

/**
 * Jobs Provider following SOLID principles.
 *
 * Single Responsibility: Manages job service registration in the IoC container
 * Open/Closed: Extensible through different factory implementations
 * Liskov Substitution: Uses interfaces and can substitute different implementations
 * Interface Segregation: Depends only on what it needs
 * Dependency Inversion: Depends on abstractions (factories) not concrete implementations
 */
export default class JobsProvider {
  private readonly jobServiceFactory: EnvironmentJobServiceFactory
  private readonly lifecycleManager: JobLifecycleManager

  constructor(protected app: ApplicationService) {
    this.jobServiceFactory = new EnvironmentJobServiceFactory(app)
    this.lifecycleManager = new JobLifecycleManager(app)
  }

  /**
   * Register job services in the IoC container.
   * Uses factory pattern to create appropriate implementation based on environment.
   */
  register(): void {
    // Register the core pgboss instance
    this.app.container.singleton('pgboss', () => {
      const pgBoss = this.jobServiceFactory.createJobService(this.app)
      this.lifecycleManager.register(pgBoss)
      return pgBoss
    })

    // Register the jobs service (alias for pgboss with auto-discovery)
    this.app.container.singleton('hschmaiske/jobs', async () => {
      const pgBoss = await this.app.container.make('pgboss')
      return pgBoss
    })
  }

  /**
   * Start all registered job services.
   * Delegates to lifecycle manager for proper separation of concerns.
   */
  async start(): Promise<void> {
    await this.lifecycleManager.startAll()
  }

  /**
   * Shutdown all registered job services.
   * Delegates to lifecycle manager for proper separation of concerns.
   */
  async shutdown(): Promise<void> {
    await this.lifecycleManager.stopAll()
  }
}
