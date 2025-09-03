import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../types.js'
import type PgBoss from 'pg-boss'

/**
 * Manages the lifecycle of PgBoss instances.
 * Single Responsibility: Handle start/stop operations for job services.
 */
export class JobLifecycleManager {
  private pgBossInstances: Set<PgBoss> = new Set()

  constructor(private readonly app: ApplicationService) {}

  /**
   * Register a PgBoss instance for lifecycle management
   */
  register(pgBoss: PgBoss): void {
    this.pgBossInstances.add(pgBoss)
  }

  /**
   * Start all registered PgBoss instances
   */
  async startAll(): Promise<void> {
    const isTestEnvironment = this.app.getEnvironment() === 'test'

    if (isTestEnvironment) {
      return // No need to start mock instances
    }

    const config = this.app.config.get<PgBossConfig>('jobs', {})

    if (config.enabled === false) {
      return // Jobs are disabled
    }

    const startPromises = Array.from(this.pgBossInstances).map(async (pgBoss) => {
      try {
        await pgBoss.start()
      } catch (error) {
        await this.logError('Failed to start PgBoss instance:', error)
      }
    })

    await Promise.all(startPromises)
  }

  /**
   * Stop all registered PgBoss instances
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.pgBossInstances).map(async (pgBoss) => {
      try {
        await pgBoss.stop()
      } catch (error) {
        await this.logError('Failed to stop PgBoss instance:', error)
      }
    })

    await Promise.all(stopPromises)
    this.pgBossInstances.clear()
  }

  /**
   * Log error using structured logger if available, fallback to console
   */
  private async logError(message: string, error: unknown): Promise<void> {
    try {
      const logger = await this.app.container.make('logger')
      ;(logger as { error: (msg: string, data?: unknown[]) => void }).error(message, [error])
    } catch {
      // Fallback to console if logger is not available
      console.error(message, error)
    }
  }

  /**
   * Get the number of registered instances
   */
  get instanceCount(): number {
    return this.pgBossInstances.size
  }
}
